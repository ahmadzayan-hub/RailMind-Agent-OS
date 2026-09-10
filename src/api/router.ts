import { AGENT_CATALOG } from '../agent-os/catalog.ts';
import type { ActionMode, AgentTask, DataClassification, HumanApproval, RiskClass } from '../agent-os/contracts.ts';
import { createExecutionPlan } from '../agent-os/kernel.ts';
import type { MemoryStore } from '../agent-os/memory.ts';
import type { AgentRuntime } from '../agent-os/orchestrator.ts';
import type { ControlTowerService, TowerScope } from '../app/control-tower-service.ts';
import type { PortfolioService } from '../portfolio/service.ts';
import { TRANSITION_PERMISSION, hasPermission, inScope, permissionsOf, runPermissionFor, type Permission, type Principal, type Scope } from '../auth/principal.ts';
import type { TokenDirectory } from '../auth/token-directory.ts';
import { securityHeaders } from '../http/security-headers.ts';
import type { AuditLog } from '../audit/log.ts';
import type { DecisionLedger } from '../ledger/contracts.ts';
import { computeEvidenceVersion, formulaVersionsOf } from '../reporting/evidence-version.ts';
import { approvalInvalidated, reportReadiness, transitionReport, type ReportTransition } from '../reporting/approval.ts';
import type { ReportPackage } from '../reporting/contracts.ts';
import type { ReportStore } from '../reporting/store.ts';

/**
 * Local decision API. It mutates RailMind-owned state only (report status,
 * audit trail, memory). It never writes to Maximo, finance or contract
 * systems.
 *
 * Every route except /api/health and /api/auth/demo-identities requires a
 * bearer token resolved by the token directory. The audit actor is always the
 * authenticated principal; actor fields in request bodies are ignored.
 */
export interface ApiDependencies {
  reportStore: ReportStore;
  auditLog: AuditLog;
  memoryStore: MemoryStore;
  /** Seed report restored by `reset` and used when the store is empty. */
  seedReport: ReportPackage;
  now?: () => string;
  persistence: 'in-memory' | 'postgres';
  /** Orchestrator for governed agent runs. Optional so the API can serve without handlers. */
  runtime?: AgentRuntime;
  /** Classification of the data this deployment handles; drives model policy. */
  classification?: DataClassification;
  /** Dependency probe (e.g. SELECT 1) used by /api/health. */
  healthCheck?: () => Promise<void>;
  /** Bearer-token directory. Required: there is no unauthenticated mode. */
  tokenDirectory: TokenDirectory;
  /** Decision and evidence ledger (append-only). */
  ledger?: DecisionLedger;
  /** Control Tower application service and default scope. */
  controlTower?: ControlTowerService;
  /** Portfolio application service (synthetic in public builds). */
  portfolio?: PortfolioService;
  scope?: TowerScope;
  mode?: 'synthetic' | 'production';
}

/** Structural subset of Node's IncomingMessage/ServerResponse so src/ stays runtime-neutral. */
export interface ApiRequest extends AsyncIterable<Uint8Array | string> {
  method?: string;
  url?: string;
  headers?: Record<string, string | string[] | undefined>;
}

export interface ApiResponse {
  writeHead(status: number, headers: Record<string, string>): unknown;
  end(body?: string): unknown;
}

export interface ApiHandler {
  (req: ApiRequest, res: ApiResponse): Promise<boolean>;
}

const MAX_BODY_BYTES = 64 * 1024;
const RISK_CLASSES: readonly RiskClass[] = ['routine', 'operational', 'contractual', 'financial', 'safety_critical'];
const ACTION_MODES: readonly ActionMode[] = ['read', 'analyse', 'draft', 'propose_write', 'execute_write', 'control'];

class HttpError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

function send(res: ApiResponse, status: number, body: unknown): void {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', ...securityHeaders() });
  res.end(JSON.stringify(body));
}

async function readJson(req: ApiRequest): Promise<Record<string, unknown>> {
  const decoder = new TextDecoder();
  let text = '';
  for await (const chunk of req) {
    text += typeof chunk === 'string' ? chunk : decoder.decode(chunk, { stream: true });
    if (text.length > MAX_BODY_BYTES) throw new HttpError(413, 'Request body too large.');
  }
  text += decoder.decode();
  if (text.trim().length === 0) return {};
  try {
    const parsed: unknown = JSON.parse(text);
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) throw new HttpError(400, 'Body must be a JSON object.');
    return parsed as Record<string, unknown>;
  } catch (error) {
    if (error instanceof HttpError) throw error;
    throw new HttpError(400, 'Body is not valid JSON.');
  }
}

function str(body: Record<string, unknown>, key: string): string | undefined {
  const value = body[key];
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
}

function buildTransition(body: Record<string, unknown>, now: string, principal: Principal, evidenceVersion: string): ReportTransition {
  const type = str(body, 'type');
  const actorId = principal.principalId;
  const actorRole = principal.role;
  const at = str(body, 'at') ?? now;
  const note = str(body, 'note');
  const approval: HumanApproval = { reviewerId: actorId, reviewerRole: actorRole, decision: type === 'approve' ? 'approved' : 'rejected', at, note };
  switch (type) {
    case 'submit_for_review':
      return { type, actorId, actorRole, at, evidenceVersion };
    case 'lock':
    case 'revise':
      return { type, actorId, actorRole, at };
    case 'approve':
      return { type, approval, evidenceVersion };
    case 'reject':
      return { type, approval };
    case 'supersede':
      return { type, actorId, actorRole, at, reason: note ?? 'Superseded by the reviewer.', newEvidenceVersion: evidenceVersion };
    default:
      throw new HttpError(400, 'Unknown transition type. Use submit_for_review, approve, reject, lock, supersede or revise.');
  }
}

function buildTask(body: Record<string, unknown>, now: string, principal: Principal): AgentTask {
  const capability = str(body, 'capability');
  const actorId = principal.principalId;
  const goal = str(body, 'goal');
  const riskClass = str(body, 'riskClass') as RiskClass | undefined;
  const actionMode = str(body, 'actionMode') as ActionMode | undefined;
  if (!capability || !goal) throw new HttpError(400, 'capability and goal are required.');
  if (!riskClass || !RISK_CLASSES.includes(riskClass)) throw new HttpError(400, `riskClass must be one of ${RISK_CLASSES.join(', ')}.`);
  if (!actionMode || !ACTION_MODES.includes(actionMode)) throw new HttpError(400, `actionMode must be one of ${ACTION_MODES.join(', ')}.`);
  return {
    taskId: str(body, 'taskId') ?? `T-${Date.parse(now).toString(36).toUpperCase()}`,
    actorId,
    goal,
    capability,
    riskClass,
    actionMode,
    requestedAt: now,
  };
}

function bearerToken(req: ApiRequest): string | null {
  const raw = req.headers?.authorization;
  const header = Array.isArray(raw) ? raw[0] : raw;
  if (!header) return null;
  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  return match?.[1]?.trim() ?? null;
}


export function createApiHandler(deps: ApiDependencies): ApiHandler {
  const now = deps.now ?? (() => new Date().toISOString());

  async function authenticate(req: ApiRequest): Promise<Principal> {
    const token = bearerToken(req);
    if (!token) throw new HttpError(401, 'Authentication required: send Authorization: Bearer <token>.');
    const principal = await deps.tokenDirectory.resolve(token);
    if (!principal) throw new HttpError(401, 'Invalid or unknown token.');
    return principal;
  }

  async function require(principal: Principal, permission: Permission, subjectId: string, scope?: Scope): Promise<void> {
    if (!hasPermission(principal, permission)) {
      await deps.auditLog.append({ action: 'auth.denied', actorId: principal.principalId, actorRole: principal.role, subjectType: 'principal', subjectId, at: now(), reason: `${principal.role} lacks ${permission}` });
      throw new HttpError(403, `Role ${principal.role} does not hold permission ${permission}.`);
    }
    if (scope && !inScope(principal, scope)) {
      await deps.auditLog.append({ action: 'auth.denied', actorId: principal.principalId, actorRole: principal.role, subjectType: 'principal', subjectId, at: now(), reason: `outside scope ${scope.type}:${scope.id ?? '*'}` });
      throw new HttpError(403, `Principal is not scoped to ${scope.type} ${scope.id ?? ''}.`);
    }
  }

  const contractScope = (): Scope => ({ type: 'contract', id: deps.scope?.contractId ?? deps.seedReport.contractId });

  async function currentReport(): Promise<ReportPackage> {
    const stored = await deps.reportStore.get(deps.seedReport.reportId);
    if (stored) return stored;
    await deps.reportStore.save(deps.seedReport);
    return deps.seedReport;
  }

  /** The package's live KPI observations (through the governed pipeline when the service is configured). */
  async function currentKpis(): Promise<ReportPackage['kpis']> {
    if (deps.controlTower && deps.scope) {
      const dto = await deps.controlTower.build(deps.scope);
      const stored = await currentReport();
      return stored.kpis.length === dto.kpis.length ? stored.kpis.map((kpi) => { const live = dto.kpis.find((k) => k.id === kpi.definition.id); return live ? { ...kpi, value: live.value, status: live.status, readiness: live.readiness, decisionGrade: live.decisionGrade, evidence: live.evidence.map((e) => ({ sourceSystem: e.sourceSystem, entityType: e.entityType, entityId: e.entityId, observedAt: e.observedAt })) } : kpi; }) : stored.kpis;
    }
    return (await currentReport()).kpis;
  }

  async function ledgerAppend(input: Parameters<DecisionLedger['append']>[0]): Promise<void> {
    if (!deps.ledger) return;
    await deps.ledger.append(input);
  }

  /**
   * Approval invalidation: when the evidence behind an approved or in-review
   * package changes, the package is superseded automatically and audited.
   * Policy does not allow a stale approval to stand.
   */
  async function reconcileApproval(): Promise<{ report: ReportPackage; evidenceVersion: string }> {
    const stored = await currentReport();
    const kpis = await currentKpis();
    const evidenceVersion = await computeEvidenceVersion(kpis);
    if (!approvalInvalidated(stored, evidenceVersion)) return { report: stored, evidenceVersion };
    const result = transitionReport({ ...stored, kpis }, { type: 'supersede', actorId: 'system.evidence-monitor', actorRole: 'system', at: now(), reason: `Underlying evidence changed (${(stored.approval?.evidenceVersion ?? stored.evidenceVersion ?? '').slice(0, 12)} -> ${evidenceVersion.slice(0, 12)}); approval invalidated by policy.`, newEvidenceVersion: evidenceVersion });
    const audit = await deps.auditLog.append(result.audit);
    if (result.ok) {
      await deps.reportStore.save(result.report);
      await ledgerAppend({ kind: 'supersession', subjectType: 'report', subjectId: stored.reportId, at: now(), actorId: 'system.evidence-monitor', actorRole: 'system', payload: { reason: result.audit.reason, previousStatus: stored.status }, evidence: kpis.flatMap((k) => k.evidence), kpiVersions: formulaVersionsOf(kpis), evidenceVersion, auditSequence: audit.sequence });
    }
    return { report: result.ok ? result.report : stored, evidenceVersion };
  }

  async function reportView(): Promise<unknown> {
    const { report, evidenceVersion } = await reconcileApproval();
    const audit = await deps.auditLog.bySubject('report', report.reportId);
    const ledger = deps.ledger ? await deps.ledger.bySubject('report', report.reportId) : [];
    return { report, readiness: reportReadiness(report, evidenceVersion), evidenceVersion, audit, ledger, persistence: deps.persistence };
  }

  async function route(method: string, path: string, req: ApiRequest): Promise<{ status: number; body: unknown }> {
    const query = new URLSearchParams((req.url ?? '').split('?')[1] ?? '');
    if (method === 'GET' && path === '/api/auth/demo-identities') {
      if (deps.tokenDirectory.mode !== 'demo') throw new HttpError(404, 'Demo identities are not available in token mode.');
      return { status: 200, body: { mode: 'demo', identities: deps.tokenDirectory.demoIdentities().map((entry) => ({ ...entry.principal, token: entry.token, permissions: permissionsOf(entry.principal) })) } };
    }
    if (method === 'GET' && path === '/api/health') {
      let dependency: 'ok' | 'failed' | 'not-applicable' = 'not-applicable';
      if (deps.healthCheck) {
        try { await deps.healthCheck(); dependency = 'ok'; } catch { dependency = 'failed'; }
      }
      const body = { service: 'Project 44 RailMind Agent OS', status: dependency === 'failed' ? 'degraded' : 'ok', mode: 'p0-demo', dataMode: deps.mode ?? 'synthetic', persistence: deps.persistence, dependency, classification: deps.classification ?? 'synthetic', auth: deps.tokenDirectory.mode, capabilities: deps.runtime?.capabilities() ?? [] };
      return { status: dependency === 'failed' ? 503 : 200, body };
    }

    const principal = await authenticate(req);
    if (method === 'GET' && path === '/api/auth/me') {
      return { status: 200, body: { principal, permissions: permissionsOf(principal), mode: deps.tokenDirectory.mode } };
    }
    if (method === 'GET' && path === '/api/runs') {
      await require(principal, 'runs.read', 'runs');
      return { status: 200, body: { runs: deps.runtime?.runs() ?? [] } };
    }
    if (method === 'POST' && path === '/api/agent/run') {
      const body = await readJson(req);
      const task = buildTask(body, now(), principal);
      const context = body.context;
      const scoped: AgentTask = typeof context === 'object' && context !== null && !Array.isArray(context) ? { ...task, context: context as Record<string, unknown> } : task;
      const targetContract = typeof scoped.context?.contractId === 'string' ? scoped.context.contractId : contractScope().id;
      await require(principal, runPermissionFor(task.capability), 'agent', { type: 'contract', id: targetContract });
      if (!deps.runtime) throw new HttpError(503, 'No agent runtime is configured in this deployment.');
      const record = await deps.runtime.run(scoped, { classification: deps.classification ?? 'synthetic' });
      return { status: record.status === 'completed' ? 200 : record.status === 'blocked' ? 403 : 422, body: record };
    }
    if (method === 'GET' && path === '/api/report') {
      await require(principal, 'report.read', 'report', contractScope());
      return { status: 200, body: await reportView() };
    }
    if (method === 'GET' && path === '/api/control-tower') {
      await require(principal, 'report.read', 'control-tower', contractScope());
      if (!deps.controlTower || !deps.scope) throw new HttpError(503, 'Control Tower service is not configured.');
      const asOf = query.get('asOf') ?? undefined;
      if (asOf !== undefined && Number.isNaN(Date.parse(asOf))) throw new HttpError(400, 'asOf must be an ISO timestamp.');
      return { status: 200, body: await deps.controlTower.build(deps.scope, asOf) };
    }
    if (method === 'GET' && path === '/api/audit') {
      await require(principal, 'audit.read', 'audit');
      const events = await deps.auditLog.all();
      return { status: 200, body: { events, chain: await deps.auditLog.verifyChain(), persistence: deps.persistence } };
    }
    if (method === 'GET' && path === '/api/agents') {
      await require(principal, 'agents.read', 'agents');
      return { status: 200, body: { agents: AGENT_CATALOG } };
    }
    if (method === 'POST' && path === '/api/report/transition') {
      const body = await readJson(req);
      const { report, evidenceVersion } = await reconcileApproval();
      const kpis = await currentKpis();
      const transition = buildTransition(body, now(), principal, evidenceVersion);
      await require(principal, TRANSITION_PERMISSION[transition.type], deps.seedReport.reportId, contractScope());
      const result = transitionReport({ ...report, kpis }, transition);
      const audit = await deps.auditLog.append(result.audit);
      if (result.ok) {
        await deps.reportStore.save(result.report);
        const kindByType = { submit_for_review: 'review', approve: 'approval', reject: 'rejection', lock: 'report_release', supersede: 'supersession', revise: 'review' } as const;
        await ledgerAppend({ kind: kindByType[transition.type], subjectType: 'report', subjectId: report.reportId, at: now(), actorId: principal.principalId, actorRole: principal.role, payload: { transition: transition.type, fromState: report.status, toState: result.report.status, note: str(body, 'note') ?? null, exceptions: result.report.exceptions.map((x) => ({ id: x.id, severity: x.severity })) }, evidence: kpis.flatMap((k) => k.evidence), kpiVersions: formulaVersionsOf(kpis), evidenceVersion, auditSequence: audit.sequence });
      }
      return {
        status: result.ok ? 200 : 409,
        body: { ok: result.ok, blockers: result.blockers, audit, report: result.report, readiness: reportReadiness(result.report, evidenceVersion), evidenceVersion },
      };
    }
    if (method === 'GET' && path === '/api/portfolio') {
      await require(principal, 'report.read', 'portfolio', { type: 'portfolio', id: 'SYNTHETIC' });
      if (!deps.portfolio) throw new HttpError(503, 'Portfolio service is not configured.');
      const asOf = query.get('asOf') ?? now().slice(0, 10);
      const horizon = query.get('horizon') ?? `${asOf.slice(0, 4)}-12-31`;
      if (Number.isNaN(Date.parse(asOf)) || Number.isNaN(Date.parse(horizon))) throw new HttpError(400, 'asOf and horizon must be ISO dates.');
      return { status: 200, body: await deps.portfolio.build(asOf, horizon) };
    }
    if (method === 'GET' && path === '/api/ledger') {
      await require(principal, 'ledger.read', 'ledger', contractScope());
      if (!deps.ledger) throw new HttpError(503, 'No decision ledger is configured.');
      const subjectType = query.get('subjectType');
      const subjectId = query.get('subjectId');
      const records = subjectType && subjectId ? await deps.ledger.bySubject(subjectType as 'report', subjectId) : await deps.ledger.all();
      return { status: 200, body: { records, persistence: deps.persistence } };
    }
    if (method === 'GET' && path.startsWith('/api/ledger/') && path.endsWith('/trace')) {
      await require(principal, 'ledger.read', 'ledger', contractScope());
      if (!deps.ledger) throw new HttpError(503, 'No decision ledger is configured.');
      const ledgerId = decodeURIComponent(path.slice('/api/ledger/'.length, -'/trace'.length));
      const trace = await deps.ledger.trace(ledgerId);
      if (!trace) throw new HttpError(404, `Ledger record ${ledgerId} not found.`);
      return { status: 200, body: trace };
    }
    if (method === 'POST' && path === '/api/report/reset') {
      await readJson(req);
      await require(principal, 'report.reset', deps.seedReport.reportId, contractScope());
      const actorId = principal.principalId;
      const previous = await currentReport();
      await deps.reportStore.save(deps.seedReport);
      const audit = await deps.auditLog.append({
        action: 'report.reset',
        actorId,
        actorRole: principal.role,
        subjectType: 'report',
        subjectId: deps.seedReport.reportId,
        at: now(),
        fromState: previous.status,
        toState: deps.seedReport.status,
        reason: 'Demo package restored to its seed state.',
      });
      return { status: 200, body: { ok: true, audit, report: deps.seedReport, readiness: reportReadiness(deps.seedReport) } };
    }
    if (method === 'POST' && path === '/api/agent/task') {
      await require(principal, 'agent.plan', 'agent', contractScope());
      const body = await readJson(req);
      const task = buildTask(body, now(), principal);
      const planning = createExecutionPlan(task, AGENT_CATALOG);
      const audit = await deps.auditLog.append({
        action: planning.ok ? 'agent.run_planned' : 'agent.run_blocked',
        actorId: task.actorId,
        subjectType: 'task',
        subjectId: task.taskId,
        at: task.requestedAt,
        toState: planning.ok ? planning.plan.agent.id : undefined,
        reason: planning.ok ? `${task.capability} via ${planning.plan.agent.id}: ${planning.plan.policy.reason}` : `${planning.reason}: ${planning.detail}`,
      });
      await deps.memoryStore.append({
        id: `MEM-${audit.sequence}`,
        kind: 'episodic',
        taskId: task.taskId,
        subject: planning.ok ? `Planned ${task.capability}` : `Blocked ${task.capability}`,
        content: audit.reason ?? '',
        createdAt: task.requestedAt,
        evidence: [],
        tags: [task.capability, task.actionMode, task.riskClass],
      });
      return { status: planning.ok ? 200 : 403, body: { ...planning, task, audit } };
    }
    if (path.startsWith('/api/')) throw new HttpError(404, 'Unknown API route.');
    return { status: 0, body: null };
  }

  return async (req, res) => {
    const path = (req.url ?? '/').split('?')[0] ?? '/';
    if (!path.startsWith('/api/')) return false;
    try {
      const result = await route(req.method ?? 'GET', path, req);
      send(res, result.status, result.body);
    } catch (error) {
      const status = error instanceof HttpError ? error.status : 500;
      send(res, status, { error: error instanceof Error ? error.message : 'Unexpected error.' });
    }
    return true;
  };
}
