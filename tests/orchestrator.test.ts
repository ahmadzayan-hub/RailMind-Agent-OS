import test from 'node:test';
import assert from 'node:assert/strict';

import { AGENT_CATALOG } from '../src/agent-os/catalog.ts';
import type { AgentTask, ModelGateway } from '../src/agent-os/contracts.ts';
import type { CapabilityHandler } from '../src/agent-os/handlers.ts';
import { createExecutionPlan } from '../src/agent-os/kernel.ts';
import { InMemoryMemoryStore } from '../src/agent-os/memory.ts';
import { AgentRuntime } from '../src/agent-os/orchestrator.ts';
import { buildStandardTools } from '../src/agent-os/standard-tools.ts';
import { ToolRegistry } from '../src/agent-os/tools.ts';
import { createStandardHandlers } from '../src/agents/index.ts';
import { InMemoryAuditLog } from '../src/audit/log.ts';
import { InMemoryDecisionLedger } from '../src/ledger/contracts.ts';
import type { RetryPolicy } from '../src/agent-os/tools.ts';
import { SourceUnavailableError } from '../src/providers/contracts.ts';
import type { MaximoP0Port } from '../src/connectors/maximo/port.ts';
import { InMemoryConditionReadPort } from '../src/connectors/condition/port.ts';
import { InMemoryContractReadPort } from '../src/connectors/contract/port.ts';
import { MockMaximoReadPort } from '../src/connectors/maximo/mock.ts';
import { DEMO_ASSETS, DEMO_CONDITION_PROFILES, DEMO_CONTRACT_KPI_SET, DEMO_CONTRACT_TWIN, DEMO_INVOICES, DEMO_PM_RECORDS, DEMO_SCOPE, DEMO_WORK_ORDERS } from '../src/demo.ts';

function task(overrides: Partial<AgentTask> = {}): AgentTask {
  return { taskId: 'T-1', actorId: 'engineer-1', goal: 'demo', capability: 'maintenance-kpi', riskClass: 'operational', actionMode: 'analyse', requestedAt: '2026-09-09T10:00:00Z', ...overrides };
}

const NO_WAIT: RetryPolicy = { maxAttempts: 3, sleep: async () => {} };

function runtime(options: { handlers?: readonly CapabilityHandler[]; model?: ModelGateway | null; baseUrl?: string | null; tools?: ToolRegistry; maximo?: MaximoP0Port; retry?: RetryPolicy } = {}) {
  const auditLog = new InMemoryAuditLog();
  const memoryStore = new InMemoryMemoryStore();
  const ledger = new InMemoryDecisionLedger();
  const maximo = options.maximo ?? new MockMaximoReadPort({ assets: DEMO_ASSETS, workOrders: DEMO_WORK_ORDERS, preventiveMaintenance: DEMO_PM_RECORDS, invoices: DEMO_INVOICES });
  const tools = options.tools ?? buildStandardTools({ maximo, contract: new InMemoryContractReadPort([DEMO_CONTRACT_KPI_SET], [DEMO_CONTRACT_TWIN]), condition: new InMemoryConditionReadPort(DEMO_CONDITION_PROFILES), memory: memoryStore });
  let tick = 0;
  const rt = new AgentRuntime({ catalog: AGENT_CATALOG, tools, handlers: options.handlers ?? createStandardHandlers(DEMO_SCOPE), auditLog, memoryStore, ledger, modelGateway: options.model ?? null, modelPolicy: { baseUrl: options.baseUrl ?? null, remoteApprovedForInternal: false, remoteApprovedForConfidential: false }, retry: options.retry ?? NO_WAIT, now: () => new Date(Date.parse('2026-09-09T10:00:00Z') + (tick++) * 1000).toISOString() });
  return { rt, auditLog, memoryStore, ledger };
}

/** Maximo port whose work-order listing fails a set number of times before answering. */
function flakyMaximo(failures: number, message: string): MaximoP0Port & { attempts: number } {
  const inner = new MockMaximoReadPort({ assets: DEMO_ASSETS, workOrders: DEMO_WORK_ORDERS, preventiveMaintenance: DEMO_PM_RECORDS, invoices: DEMO_INVOICES });
  const port = {
    attempts: 0,
    getAsset: (id: string) => inner.getAsset(id),
    listPreventiveMaintenance: (id: string) => inner.listPreventiveMaintenance(id),
    listMeterReadings: (id: string, since?: string) => inner.listMeterReadings(id, since),
    listInvoices: (id: string, since?: string) => inner.listInvoices(id, since),
    async listWorkOrders(id: string, since?: string) {
      port.attempts += 1;
      if (port.attempts <= failures) throw new SourceUnavailableError('maximo', message);
      return inner.listWorkOrders(id, since);
    },
  };
  return port;
}

test('kernel escalates a task to the capability minimum risk class', () => {
  const result = createExecutionPlan(task({ capability: 'monthly-report', riskClass: 'routine', actionMode: 'draft' }), AGENT_CATALOG);
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.plan.task.riskClass, 'contractual');
    assert.equal(result.plan.policy.approvalRequired, true);
  }
});

test('maintenance KPI run computes the same numbers as the engine, with evidence and an audited tool trail', async () => {
  const { rt, auditLog } = runtime();
  const record = await rt.run(task());
  assert.equal(record.status, 'completed');
  assert.equal(record.agentId, 'maintenance-kpi');
  assert.equal(record.releaseReady, true);
  const value = record.output?.value as { kpis: { id: string; value: number; status: string }[]; workOrderCount: number };
  assert.equal(value.workOrderCount, 8);
  assert.deepEqual(value.kpis.map((k) => [k.id, k.value, k.status]), [['availability', 98.522, 'breach'], ['failures', 4, 'within_target'], ['mtbf', 183.25, 'within_target'], ['mttr', 2.75, 'breach'], ['backlog', 3, 'within_target'], ['pm_compliance', 50, 'breach']]);
  assert.equal(record.output?.evidence.length, 9);
  assert.deepEqual(record.toolCalls.map((c) => c.toolId), ['contract.read', 'maximo.read', 'maximo.read', 'maximo.read']);
  const trail = await auditLog.bySubject('run', record.runId);
  assert.deepEqual(trail.map((e) => e.action), ['agent.run_started', 'tool.called', 'tool.called', 'tool.called', 'tool.called', 'agent.run_completed']);
  assert.deepEqual(await auditLog.verifyChain(), { valid: true });
});

test('a handler cannot reach a tool outside its plan; the violation is audited and the run fails closed', async () => {
  const rogue: CapabilityHandler = { capability: 'finance-context', execute: async (ctx) => { await ctx.tools.call('maximo.read', { kind: 'asset', assetId: 'ATC-ZC-01' }); return { value: 1, evidence: [], assumptions: [] }; } };
  const { rt, auditLog } = runtime({ handlers: [rogue] });
  const record = await rt.run(task({ capability: 'finance-context', riskClass: 'routine' }));
  assert.equal(record.status, 'failed');
  assert.match(record.reason, /Tool boundary violation/);
  assert.equal(record.toolCalls.length, 0);
  const trail = await auditLog.bySubject('run', record.runId);
  assert.equal(trail[trail.length - 1]?.action, 'agent.run_failed');
});

test('output without decision-grade evidence is discarded', async () => {
  const hollow: CapabilityHandler = { capability: 'maintenance-kpi', execute: async () => ({ value: 'availability is fine', evidence: [], assumptions: [] }) };
  const { rt } = runtime({ handlers: [hollow] });
  const record = await rt.run(task());
  assert.equal(record.status, 'failed');
  assert.equal(record.output, null);
  assert.match(record.reason, /without decision-grade evidence/);
});

test('blocked action modes never reach a handler', async () => {
  let executed = false;
  const spy: CapabilityHandler = { capability: 'asset-health', execute: async () => { executed = true; return { value: 1, evidence: [], assumptions: [] }; } };
  const { rt, auditLog } = runtime({ handlers: [spy] });
  const record = await rt.run(task({ capability: 'asset-health', actionMode: 'execute_write' }));
  assert.equal(record.status, 'blocked');
  assert.equal(executed, false);
  assert.equal((await auditLog.all())[0]?.action, 'agent.run_blocked');
});

test('catalog capability without a handler fails closed', async () => {
  const { rt } = runtime({ handlers: [] });
  const record = await rt.run(task({ capability: 'contract-context', riskClass: 'contractual' }));
  assert.equal(record.status, 'failed');
  assert.match(record.reason, /no executable handler/);
});

test('contractual report run is grounded but not release-ready until approved; deterministic narrative without a model', async () => {
  const { rt } = runtime();
  const record = await rt.run(task({ capability: 'monthly-report', riskClass: 'routine', actionMode: 'draft' }));
  assert.equal(record.status, 'completed');
  assert.equal(record.approvalRequired, true);
  assert.equal(record.releaseReady, false);
  assert.equal(record.modelUsed, false);
  const value = record.output?.value as { narrativeSource: string; report: { exceptions: unknown[] } };
  assert.equal(value.narrativeSource, 'deterministic');
  assert.equal(value.report.exceptions.length, 3);
});

test('model is granted only when policy allows: confidential data and a remote endpoint are blocked', async () => {
  const model: ModelGateway = { generate: async () => ({ text: 'Model narrative (interpretation).', model: 'test' }) };
  const remote = runtime({ model, baseUrl: 'https://api.example.com/v1' });
  const blocked = await remote.rt.run(task({ capability: 'monthly-report', actionMode: 'draft' }), { classification: 'confidential' });
  assert.equal(blocked.modelUsed, false);
  assert.ok((await remote.auditLog.all()).some((e) => e.action === 'model.blocked'));

  const local = runtime({ model, baseUrl: 'http://127.0.0.1:8080/v1' });
  const allowed = await local.rt.run(task({ capability: 'monthly-report', actionMode: 'draft' }), { classification: 'confidential' });
  assert.equal(allowed.modelUsed, true);
  assert.equal((allowed.output?.value as { narrative: string }).narrative, 'Model narrative (interpretation).');
  assert.ok((await local.auditLog.all()).some((e) => e.action === 'model.invoked'));
});

test('executive briefing consumes decision memory produced by a governed exception-analysis run', async () => {
  const { rt } = runtime();
  const empty = await rt.run(task({ capability: 'executive-briefing', actionMode: 'draft' }));
  assert.equal(empty.status, 'completed');
  assert.equal((empty.output?.value as { decisions: unknown[] }).decisions.length, 0);

  await rt.run(task({ taskId: 'T-2', capability: 'exception-analysis' }));
  const briefing = await rt.run(task({ taskId: 'T-3', capability: 'executive-briefing', actionMode: 'draft' }));
  const value = briefing.output?.value as { headline: string; decisions: { severity: string; owner: string }[] };
  assert.equal(value.headline, '3 decision(s) required; 1 critical.');
  assert.deepEqual(value.decisions.map((d) => [d.severity, d.owner]), [['critical', 'contract-owner'], ['high', 'maintenance-manager'], ['high', 'maintenance-manager']]);
  assert.deepEqual(briefing.toolCalls.map((c) => c.toolId), ['contract.read', 'memory.read']);
  assert.equal(briefing.approvalRequired, true);
});

test('data quality agent flags the open in-progress failure and missing timestamps', async () => {
  const { rt } = runtime();
  const record = await rt.run(task({ capability: 'data-quality', riskClass: 'routine' }));
  const value = record.output?.value as { findings: { code: string; workOrderId: string | null }[]; provisional: boolean };
  assert.ok(value.findings.some((f) => f.code === 'open_beyond_period' && f.workOrderId === 'WO-1004'));
  assert.equal(value.provisional, false);
});

test('asset health run assembles inputs from condition and Maximo ports and scores with the migrated engine', async () => {
  const { rt } = runtime();
  const record = await rt.run(task({ capability: 'asset-health', riskClass: 'operational' }));
  assert.equal(record.status, 'completed');
  assert.equal(record.agentId, 'asset-intelligence');
  const value = record.output?.value as { summary: { total: number; highRisk: number; awaitingReview: number }; assets: { id: string; riskBand: string; healthBand: string; openWorkOrders: number }[]; engineVersion: string };
  assert.equal(value.engineVersion, 'railmind-legacy-v1');
  assert.equal(value.summary.total, 3);
  assert.equal(value.assets[0]?.id, 'ATC-ZC-02');
  assert.equal(value.assets[0]?.healthBand, 'critical');
  assert.equal(value.assets[0]?.riskBand, 'high');
  assert.equal(value.assets.find((a) => a.id === 'TRAM-APS-03')?.openWorkOrders, 2);
  assert.ok(record.toolCalls.every((c) => ['condition.read', 'maximo.read'].includes(c.toolId)));
  assert.ok(record.output!.evidence.some((e) => e.sourceSystem === 'condition_monitoring'));
  assert.ok(record.output!.evidence.some((e) => e.entityType === 'pm'));
});

test('failure risk exposes ranked drivers and flags high-risk recommendations for engineer review', async () => {
  const { rt } = runtime();
  const record = await rt.run(task({ capability: 'failure-risk', riskClass: 'operational' }));
  const value = record.output?.value as { assessments: { assetId: string; riskBand: string; drivers: { name: string; contribution: number }[]; recommendation: { requiresEngineerReview: boolean; action: string } }[] };
  const worst = value.assessments[0]!;
  assert.equal(worst.assetId, 'ATC-ZC-02');
  assert.ok(worst.drivers.length >= 3);
  assert.ok(Math.abs(worst.drivers.reduce((s, d) => s + d.contribution, 0) - 1) < 1e-5);
  assert.equal(worst.recommendation.requiresEngineerReview, true);
});

test('maintenance priority proposals are gated: analyse mode never proposes; propose_write needs approval and a named review for high risk', async () => {
  const { rt } = runtime();
  const analyse = await rt.run(task({ capability: 'maintenance-priority', riskClass: 'operational' }));
  assert.equal((analyse.output?.value as { proposals: unknown[] }).proposals.length, 0);
  assert.equal(analyse.releaseReady, true);

  const unreviewed = await rt.run(task({ taskId: 'T-9', capability: 'maintenance-priority', actionMode: 'propose_write' }));
  assert.equal(unreviewed.approvalRequired, true);
  assert.equal(unreviewed.releaseReady, false);
  const blocked = (unreviewed.output?.value as { proposals: { assetId: string; blocked?: string }[] }).proposals;
  assert.equal(blocked.find((p) => p.assetId === 'ATC-ZC-02')?.blocked, 'engineer_review_required');

  const reviewed = await rt.run(task({ taskId: 'T-10', capability: 'maintenance-priority', actionMode: 'propose_write', context: { review: { reviewerId: 'a.zaian', reviewerRole: 'Chief Engineer', decision: 'approved', at: '2026-09-09T09:00:00Z' } } }));
  const proposals = (reviewed.output?.value as { proposals: { assetId: string; priority?: number; submittedToMaximo?: boolean; blocked?: string }[] }).proposals;
  const worst = proposals.find((p) => p.assetId === 'ATC-ZC-02');
  assert.equal(worst?.priority, 1);
  assert.equal(worst?.submittedToMaximo, false);
  assert.equal(reviewed.releaseReady, false, 'a proposal is never release-ready without the runtime approval gate');
});

test('contract context copies the approved definition set through contract.read only and labels a demo set as non-contractual', async () => {
  const { rt } = runtime();
  const record = await rt.run(task({ capability: 'contract-context', riskClass: 'routine', actionMode: 'analyse' }));
  assert.equal(record.status, 'completed');
  assert.equal(record.agentId, 'contract-context');
  assert.equal(record.approvalRequired, true, 'the kernel escalates contract context to contractual, so approval is required');
  assert.equal(record.releaseReady, false);
  assert.equal(record.modelUsed, false);
  assert.deepEqual(record.toolCalls.map((c) => [c.toolId, c.summary]), [['contract.read', 'kpi-set DEMO-CONTRACT'], ['contract.read', 'twin DEMO-CONTRACT']]);
  const value = record.output?.value as { twin: { twinVersion: string; approvalStatus: string; contractual: boolean; obligations: unknown[]; reportingDuties: unknown[]; unboundKpiIds: string[] } | null; contractual: boolean; approvalStatus: string; definitions: { id: string; threshold: number | null; clauseRef: string | null; approvalStatus: string }[]; notEffective: string[]; plannedServiceMinutes: number; assetIds: string[] };
  assert.equal(value.contractual, false);
  assert.equal(value.approvalStatus, 'demo_only');
  assert.deepEqual(value.definitions.map((d) => d.id), ['availability', 'failures', 'mtbf', 'mttr', 'backlog', 'pm_compliance']);
  assert.equal(value.definitions[0]?.threshold, 99.5);
  assert.match(value.definitions[0]?.clauseRef ?? '', /DEMO-CLAUSE/);
  assert.deepEqual(value.notEffective, []);
  assert.equal(value.plannedServiceMinutes, 31 * 24 * 60 - 1 + 1);
  assert.equal(value.assetIds.length, 3);
  assert.equal(record.output?.evidence[0]?.sourceSystem, 'contract_repository');
  assert.ok(record.output?.assumptions.some((a) => /NOT a contractual authority/.test(a)));
  // The digital twin is copied, never redefined, and a demo twin is labelled as such.
  assert.equal(value.twin?.twinVersion, 'demo-twin-v1');
  assert.equal(value.twin?.approvalStatus, 'demo_only');
  assert.equal(value.twin?.contractual, false);
  assert.equal(value.twin?.obligations.length, DEMO_CONTRACT_TWIN.obligations.length);
  assert.equal(value.twin?.reportingDuties.length, 2);
  assert.deepEqual(value.twin?.unboundKpiIds, []);
  assert.equal(record.output?.evidence[1]?.entityType, 'contract-twin');
  assert.ok(record.output?.assumptions.some((a) => /Contract twin demo-twin-v1 is demo_only and is NOT a contractual authority/.test(a)));
});

test('finance context reads invoices through finance.read only, flags disputes and takes no financial action', async () => {
  const { rt } = runtime();
  const record = await rt.run(task({ capability: 'finance-context', riskClass: 'routine', actionMode: 'analyse' }));
  assert.equal(record.status, 'completed');
  assert.equal(record.agentId, 'finance-context');
  assert.equal(record.approvalRequired, true, 'finance context is escalated to financial');
  assert.equal(record.modelUsed, false);
  assert.deepEqual(record.toolCalls.map((c) => c.toolId), ['finance.read']);
  const value = record.output?.value as { invoiceCount: number; byStatus: Record<string, number>; byWorkflowState: Record<string, number>; totals: { gross: number; approved: number; currency: string | null }; flags: unknown[]; provisional: boolean };
  assert.equal(value.invoiceCount, 3);
  assert.deepEqual(value.byStatus, { APPR: 1, WAPPR: 1, HOLD: 1 });
  assert.equal(value.byWorkflowState.DISPUTED, 1);
  assert.deepEqual(value.totals, { gross: 264000, approved: 125000, currency: 'AED' });
  assert.equal(value.provisional, false);
  assert.equal(record.output?.evidence.length, 3);
  assert.ok(record.output?.evidence.every((e) => e.sourceSystem === 'maximo_finance' && e.entityType === 'invoice'));
});

test('finance context stays grounded on an empty invoice set and flags contradictory amounts', async () => {
  const { summariseInvoices } = await import('../src/agents/finance-context.ts');
  const summary = summariseInvoices([{ invoiceId: 'I-1', status: 'APPR', grossAmount: 10, approvedAmount: 12, currency: 'AED' }, { invoiceId: 'I-2', status: '', currency: 'USD', invoiceDate: '2026-08-01T00:00:00Z' }]);
  assert.deepEqual([...summary.flags.map((f) => f.code)].sort(), ['approved_exceeds_gross', 'missing_invoice_date', 'mixed_currency', 'unknown_status']);
  assert.equal(summary.provisional, true);
  assert.equal(summary.totals.currency, null);

  const tools = buildStandardTools({ maximo: new MockMaximoReadPort({ assets: DEMO_ASSETS, workOrders: DEMO_WORK_ORDERS }), contract: new InMemoryContractReadPort([DEMO_CONTRACT_KPI_SET]), memory: new InMemoryMemoryStore() });
  const { rt } = runtime({ tools });
  const record = await rt.run(task({ capability: 'finance-context', riskClass: 'financial' }));
  assert.equal(record.status, 'completed');
  assert.equal((record.output?.value as { invoiceCount: number }).invoiceCount, 0);
  assert.equal(record.output?.evidence[0]?.entityType, 'invoice-query');
});

test('model gateway failure never fails a report run: the narrative falls back to the deterministic summary and the failure is audited', async () => {
  let calls = 0;
  const failing: ModelGateway = { generate: async () => { calls += 1; throw new Error('HTTP 503 from model endpoint'); } };
  const { rt, auditLog } = runtime({ model: failing, baseUrl: 'http://127.0.0.1:8080/v1' });
  const record = await rt.run(task({ capability: 'monthly-report', actionMode: 'draft' }));
  assert.equal(record.status, 'completed');
  assert.equal(record.modelUsed, false);
  assert.equal(calls, 2, 'the guard retries once and then gives up');
  const value = record.output?.value as { narrativeSource: string; narrative: string };
  assert.equal(value.narrativeSource, 'deterministic_fallback');
  assert.ok(value.narrative.length > 0);
  assert.ok(record.output?.assumptions.some((a) => a.startsWith('Model unavailable (')));
  const failures = (await auditLog.all()).filter((e) => e.action === 'model.failed');
  assert.equal(failures.length, 2);
  assert.ok(failures[1]!.reason.includes('final; deterministic fallback'));
});

test('transient source errors are retried within the bound and every retry is audited', async () => {
  const maximo = flakyMaximo(2, 'HTTP 503 Service Unavailable');
  const { rt, auditLog } = runtime({ maximo });
  const record = await rt.run(task());
  assert.equal(record.status, 'completed');
  const workOrderCalls = record.toolCalls.filter((c) => c.toolId === 'maximo.read' && c.summary.startsWith('workOrders')).length;
  assert.equal(workOrderCalls, 3, 'one work-order read per in-scope asset');
  assert.equal(maximo.attempts, workOrderCalls + 2, 'two failed attempts on the first read, then one attempt per read');
  const retried = (await auditLog.all()).filter((e) => e.action === 'tool.retried');
  assert.equal(retried.length, 2);
  assert.ok(retried.every((e) => e.reason.startsWith('maximo.read attempt')));
});

test('a source that stays unavailable fails the run after the last attempt; a non-transient error fails at once', async () => {
  const down = flakyMaximo(99, 'HTTP 503 Service Unavailable');
  const failed = await runtime({ maximo: down }).rt.run(task());
  assert.equal(failed.status, 'failed');
  assert.equal(down.attempts, 3);
  assert.ok(failed.reason.includes('HTTP 503'));

  const forbidden = flakyMaximo(99, 'HTTP 403 Forbidden');
  const { rt, auditLog } = runtime({ maximo: forbidden });
  const denied = await rt.run(task());
  assert.equal(denied.status, 'failed');
  assert.equal(forbidden.attempts, 1, 'authorisation errors are never retried');
  assert.ok((await auditLog.all()).every((e) => e.action !== 'tool.retried'));
});

test('a declared sequence runs each step as a governed run and links the recommendations in the ledger', async () => {
  const { rt, auditLog, ledger } = runtime();
  const sequence = await rt.runSequence([
    task({ taskId: 'S-1', capability: 'data-quality' }),
    task({ taskId: 'S-2', capability: 'maintenance-kpi' }),
    task({ taskId: 'S-3', capability: 'exception-analysis' }),
    task({ taskId: 'S-4', capability: 'executive-briefing', actionMode: 'draft' }),
  ]);
  assert.equal(sequence.status, 'completed');
  assert.equal(sequence.stoppedAt, null);
  assert.equal(sequence.runs.length, 4);
  assert.ok(sequence.runs.every((r) => r.status === 'completed' && r.sequenceId === sequence.sequenceId && typeof r.ledgerId === 'string'));
  const briefing = sequence.runs[3]!;
  assert.equal((briefing.output?.value as { headline: string }).headline, '3 decision(s) required; 1 critical.');
  const trace = await ledger.trace(briefing.ledgerId!);
  assert.deepEqual(trace?.lineage.map((r) => r.ledgerId), sequence.runs.slice(0, 3).map((r) => r.ledgerId));
  assert.ok((await ledger.get(briefing.ledgerId!))?.follows === sequence.runs[2]!.ledgerId);
  const actions = (await auditLog.all()).filter((e) => e.subjectType === 'sequence').map((e) => e.action);
  assert.deepEqual(actions, ['agent.sequence_started', 'agent.sequence_completed']);
  assert.equal(sequence.reason, '4 step(s) completed; 1 await named approval.');
});

test('a sequence stops at the first run that is not completed and audits why', async () => {
  const { rt, auditLog } = runtime();
  const sequence = await rt.runSequence([
    task({ taskId: 'S-1', capability: 'maintenance-kpi' }),
    task({ taskId: 'S-2', capability: 'asset-health', actionMode: 'control' }),
    task({ taskId: 'S-3', capability: 'exception-analysis' }),
  ]);
  assert.equal(sequence.status, 'stopped');
  assert.equal(sequence.stoppedAt, 1);
  assert.equal(sequence.runs.length, 2);
  assert.equal(sequence.runs[1]!.status, 'blocked');
  assert.ok(sequence.reason.startsWith('Sequence stopped at step 2 (asset-health): blocked'));
  assert.ok((await auditLog.all()).some((e) => e.action === 'agent.sequence_stopped'));
  await assert.rejects(() => rt.runSequence([]), /at least one task/);
});
