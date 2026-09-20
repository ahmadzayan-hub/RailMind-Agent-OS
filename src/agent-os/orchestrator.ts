import type { AuditEvent, AuditLog } from '../audit/log.ts';
import type { DecisionLedger } from '../ledger/contracts.ts';
import { evaluateModelInvocation, type ModelInvocationPolicyConfig } from '../llm/policy.ts';
import type {
  AgentDefinition,
  AgentRunRecord,
  AgentTask,
  DataClassification,
  GroundedAgentOutput,
  ModelGateway,
  ToolCallRecord,
} from './contracts.ts';
import type { CapabilityHandler } from './handlers.ts';
import { createExecutionPlan } from './kernel.ts';
import type { MemoryStore } from './memory.ts';
import { hasDecisionGradeEvidence, isOutputReleaseReady } from './policy.ts';
import { InMemoryRunStore, type RunStore } from './run-store.ts';
import { ToolAccessError, ToolRegistry, createScopedInvoker } from './tools.ts';

/**
 * Agent OS runtime (orchestrator).
 *
 *   intake -> deterministic routing -> policy -> scoped tools -> model policy
 *   -> capability handler -> evidence verification -> approval gate
 *   -> audit + memory -> run record
 *
 * The runtime never executes a write, never issues a control action, and never
 * lets a handler reach a tool outside its plan. Every step is audited.
 */
export interface AgentRuntimeDependencies {
  catalog: readonly AgentDefinition[];
  tools: ToolRegistry;
  handlers: readonly CapabilityHandler[];
  auditLog: AuditLog;
  memoryStore: MemoryStore;
  modelGateway: ModelGateway | null;
  modelPolicy: ModelInvocationPolicyConfig;
  /** Optional append-only ledger; every completed run records a recommendation entry. */
  ledger?: DecisionLedger;
  /** Run record store; defaults to in-memory. PostgreSQL keeps records across restarts. */
  runStore?: RunStore;
  now?: () => string;
  runId?: () => string;
}

export interface RunOptions {
  classification?: DataClassification;
}

/** Pulls KPI id to formula version pairs out of a handler value when it carries KPI observations. */
function extractKpiVersions(value: unknown): Readonly<Record<string, string>> {
  if (typeof value !== 'object' || value === null) return {};
  const record = value as { kpis?: unknown; definitionVersion?: unknown };
  if (Array.isArray(record.kpis)) {
    const pairs = record.kpis.flatMap((kpi) => (typeof kpi === 'object' && kpi !== null && typeof (kpi as { id?: unknown }).id === 'string' && typeof (kpi as { formulaVersion?: unknown }).formulaVersion === 'string' ? [[(kpi as { id: string }).id, (kpi as { formulaVersion: string }).formulaVersion] as const] : []));
    if (pairs.length > 0) return Object.fromEntries(pairs);
  }
  return typeof record.definitionVersion === 'string' ? { '*': record.definitionVersion } : {};
}

export class AgentRuntime {
  readonly #deps: AgentRuntimeDependencies;
  readonly #handlers = new Map<string, CapabilityHandler>();
  readonly #runs: RunStore;
  readonly #now: () => string;
  readonly #runId: () => string;
  #counter = 0;

  constructor(deps: AgentRuntimeDependencies) {
    this.#deps = deps;
    for (const handler of deps.handlers) {
      if (this.#handlers.has(handler.capability)) throw new Error(`Duplicate handler for capability ${handler.capability}`);
      this.#handlers.set(handler.capability, handler);
    }
    this.#runs = deps.runStore ?? new InMemoryRunStore();
    this.#now = deps.now ?? (() => new Date().toISOString());
    this.#runId = deps.runId ?? (() => { this.#counter += 1; return `RUN-${Date.parse(this.#now()).toString(36).toUpperCase()}-${this.#counter}`; });
  }

  capabilities(): readonly string[] {
    return [...this.#handlers.keys()];
  }

  runs(): Promise<readonly AgentRunRecord[]> {
    return this.#runs.all();
  }

  record(runId: string): Promise<AgentRunRecord | null> {
    return this.#runs.get(runId);
  }

  async run(task: AgentTask, options: RunOptions = {}): Promise<AgentRunRecord> {
    const classification = options.classification ?? 'synthetic';
    const runId = this.#runId();
    const startedAt = this.#now();
    const sequences: number[] = [];
    const audit = async (input: Omit<Parameters<AuditLog['append']>[0], 'actorId' | 'subjectType' | 'subjectId'>): Promise<AuditEvent> => {
      const event = await this.#deps.auditLog.append({ ...input, actorId: task.actorId, subjectType: 'run', subjectId: runId });
      sequences.push(event.sequence);
      return event;
    };
    const finish = async (partial: Omit<AgentRunRecord, 'runId' | 'task' | 'classification' | 'startedAt' | 'completedAt' | 'auditSequences'>): Promise<AgentRunRecord> => {
      const record: AgentRunRecord = { runId, task, classification, startedAt, completedAt: this.#now(), auditSequences: [...sequences], ...partial };
      await this.#runs.append(record);
      return record;
    };

    const planning = createExecutionPlan(task, this.#deps.catalog);
    if (!planning.ok) {
      await audit({ action: 'agent.run_blocked', at: startedAt, reason: `${planning.reason}: ${planning.detail}` });
      return finish({ agentId: null, status: 'blocked', toolCalls: [], modelUsed: false, output: null, approvalRequired: false, releaseReady: false, reason: planning.detail });
    }
    const { plan } = planning;
    await audit({ action: 'agent.run_started', at: startedAt, toState: plan.agent.id, reason: `${task.capability} (${task.actionMode}, ${task.riskClass}); ${plan.policy.reason}` });

    const handler = this.#handlers.get(task.capability);
    if (!handler) {
      const reason = `Capability ${task.capability} is registered in the catalog but has no executable handler in this deployment.`;
      await audit({ action: 'agent.run_failed', at: this.#now(), reason });
      return finish({ agentId: plan.agent.id, status: 'failed', toolCalls: [], modelUsed: false, output: null, approvalRequired: plan.policy.approvalRequired, releaseReady: false, reason });
    }

    let model: ModelGateway | null = null;
    if (plan.agent.mayUseModel && this.#deps.modelGateway) {
      const decision = evaluateModelInvocation(classification, this.#deps.modelPolicy);
      await audit({ action: decision.allowed ? 'model.invoked' : 'model.blocked', at: this.#now(), reason: `${decision.endpoint}: ${decision.reason}` });
      if (decision.allowed) model = this.#deps.modelGateway;
    }

    const toolCalls: ToolCallRecord[] = [];
    const invoker = createScopedInvoker(this.#deps.tools, plan, async (record) => {
      toolCalls.push(record);
      await audit({ action: 'tool.called', at: record.at, reason: `${record.toolId}: ${record.summary}` });
    }, this.#now);

    try {
      const result = await handler.execute({ task, plan, tools: invoker, model, memory: this.#deps.memoryStore, now: this.#now });
      const output: GroundedAgentOutput<unknown> = {
        taskId: task.taskId,
        agentId: plan.agent.id,
        value: result.value,
        evidence: result.evidence,
        assumptions: result.assumptions,
        generatedAt: this.#now(),
      };
      if (!hasDecisionGradeEvidence(output)) {
        const reason = `${plan.agent.id} produced output without decision-grade evidence; discarded.`;
        await audit({ action: 'agent.run_failed', at: this.#now(), reason });
        return finish({ agentId: plan.agent.id, status: 'failed', toolCalls, modelUsed: Boolean(result.modelUsed), output: null, approvalRequired: plan.policy.approvalRequired, releaseReady: false, reason });
      }
      const releaseReady = isOutputReleaseReady(output, plan.policy);
      const reason = plan.policy.approvalRequired
        ? 'Output is grounded; named human approval is required before release.'
        : 'Output is grounded and within the read/analysis boundary.';
      await audit({ action: 'agent.run_completed', at: output.generatedAt, toState: releaseReady ? 'release_ready' : 'awaiting_approval', reason: `${reason} tools=${toolCalls.length} model=${Boolean(result.modelUsed)} evidence=${output.evidence.length}`, evidence: output.evidence.slice(0, 50) });
      if (this.#deps.ledger) {
        const kpiVersions = extractKpiVersions(result.value);
        const completedEvent = sequences[sequences.length - 1];
        await this.#deps.ledger.append({ kind: 'recommendation', subjectType: 'run', subjectId: runId, at: output.generatedAt, actorId: task.actorId, payload: { capability: task.capability, agentId: plan.agent.id, goal: task.goal, assumptions: output.assumptions, releaseReady, approvalRequired: plan.policy.approvalRequired, value: output.value }, evidence: output.evidence, kpiVersions, auditSequence: completedEvent });
      }
      await this.#deps.memoryStore.append({
        id: `${runId}:decision`,
        kind: 'decision',
        taskId: task.taskId,
        subject: `${plan.agent.id} · ${task.capability}`,
        content: JSON.stringify({ goal: task.goal, assumptions: output.assumptions, releaseReady, value: output.value }),
        createdAt: output.generatedAt,
        evidence: output.evidence,
        tags: [task.capability, plan.agent.id, releaseReady ? 'release-ready' : 'awaiting-approval'],
      });
      return finish({ agentId: plan.agent.id, status: 'completed', toolCalls, modelUsed: Boolean(result.modelUsed), output, approvalRequired: plan.policy.approvalRequired, releaseReady, reason });
    } catch (error) {
      const reason = error instanceof ToolAccessError
        ? `Tool boundary violation: ${error.message}`
        : `Handler failed: ${error instanceof Error ? error.message : String(error)}`;
      await audit({ action: 'agent.run_failed', at: this.#now(), reason });
      return finish({ agentId: plan.agent.id, status: 'failed', toolCalls, modelUsed: false, output: null, approvalRequired: plan.policy.approvalRequired, releaseReady: false, reason });
    }
  }
}
