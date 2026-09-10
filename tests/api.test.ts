import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';

import { InMemoryMemoryStore } from '../src/agent-os/memory.ts';
import { createApiHandler } from '../src/api/router.ts';
import { InMemoryAuditLog } from '../src/audit/log.ts';
import { DemoTokenDirectory } from '../src/auth/token-directory.ts';
import { DEMO_REPORT } from '../src/demo.ts';
import { InMemoryReportStore } from '../src/reporting/store.ts';
import { InMemoryDecisionLedger } from '../src/ledger/contracts.ts';

async function startApi() {
  const auditLog = new InMemoryAuditLog();
  const memoryStore = new InMemoryMemoryStore();
  const ledger = new InMemoryDecisionLedger();
  const handler = createApiHandler({ reportStore: new InMemoryReportStore(), auditLog, memoryStore, ledger, seedReport: DEMO_REPORT, persistence: 'in-memory', now: () => '2026-09-09T12:00:00Z', tokenDirectory: new DemoTokenDirectory() });
  const server = createServer(async (req, res) => {
    if (await handler(req, res)) return;
    res.writeHead(404); res.end();
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const call = async (method: string, path: string, body?: unknown, token: string | null = 'demo-admin') => {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers.Authorization = `Bearer ${token}`;
    const response = await fetch(`${base}${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
    return { status: response.status, json: await response.json() as Record<string, any> };
  };
  return { call, auditLog, memoryStore, ledger, close: () => new Promise<void>((resolve) => server.close(() => resolve())) };
}

test('API serves the seeded report with readiness and an empty audit trail', async () => {
  const api = await startApi();
  try {
    const health = await api.call('GET', '/api/health');
    assert.equal(health.json.persistence, 'in-memory');
    const report = await api.call('GET', '/api/report');
    assert.equal(report.status, 200);
    assert.equal(report.json.report.status, 'draft');
    assert.deepEqual(report.json.readiness.nextTransitions, ['submit_for_review']);
    assert.deepEqual(report.json.audit, []);
  } finally { await api.close(); }
});

test('API drives the full approval lifecycle and records a valid audit chain', async () => {
  const api = await startApi();
  try {
    const submitted = await api.call('POST', '/api/report/transition', { type: 'submit_for_review' }, 'demo-engineer');
    assert.equal(submitted.status, 200);
    assert.equal(submitted.json.report.status, 'under_review');
    assert.equal(submitted.json.audit.actorId, 'demo.engineer');
    assert.equal(submitted.json.audit.actorRole, 'maintenance_engineer');

    const engineerApproval = await api.call('POST', '/api/report/transition', { type: 'approve', note: 'x' }, 'demo-engineer');
    assert.equal(engineerApproval.status, 403);

    const refused = await api.call('POST', '/api/report/transition', { type: 'approve' }, 'demo-approver');
    assert.equal(refused.status, 409);
    assert.equal(refused.json.ok, false);
    assert.match(refused.json.blockers.join(' '), /critical exception/);

    const approved = await api.call('POST', '/api/report/transition', { type: 'approve', actorId: 'spoofed', note: 'Mitigation reviewed.' }, 'demo-approver');
    assert.equal(approved.json.report.status, 'approved');
    assert.equal(approved.json.report.approval.reviewerId, 'demo.approver');

    const engineerLock = await api.call('POST', '/api/report/transition', { type: 'lock' }, 'demo-engineer');
    assert.equal(engineerLock.status, 403);
    const locked = await api.call('POST', '/api/report/transition', { type: 'lock' }, 'demo-approver');
    assert.equal(locked.json.report.status, 'locked');
    assert.equal(locked.json.report.lockedAt, '2026-09-09T12:00:00Z');

    const persisted = await api.call('GET', '/api/report');
    assert.equal(persisted.json.report.status, 'locked');
    assert.deepEqual(persisted.json.audit.map((e: { action: string }) => e.action), ['report.submitted_for_review', 'report.transition_refused', 'report.approved', 'report.locked']);

    const audit = await api.call('GET', '/api/audit');
    assert.deepEqual(audit.json.chain, { valid: true });
    assert.equal(audit.json.events[3].previousHash, audit.json.events[2].hash);

    const ledger = await api.call('GET', '/api/ledger?subjectType=report&subjectId=DEMO-2026-08');
    assert.deepEqual(ledger.json.records.map((r: { kind: string }) => r.kind), ['review', 'approval', 'report_release']);
    const approval = ledger.json.records[1];
    assert.equal(approval.actorId, 'demo.approver');
    assert.equal(approval.evidenceVersion, approved.json.evidenceVersion);
    assert.equal(approval.kpiVersions.mttr, 'demo-v1');
    assert.ok(approval.evidence.length > 0);
    const trace = await api.call('GET', `/api/ledger/${approval.ledgerId}/trace`);
    assert.equal(trace.status, 200);
    assert.ok(trace.json.sources.length > 0);
    assert.equal(trace.json.supersededBy, null);
  } finally { await api.close(); }
});

test('API supersedes an approval automatically when the evidence behind it changes', async () => {
  const auditLog = new InMemoryAuditLog();
  const ledger = new InMemoryDecisionLedger();
  const reportStore = new InMemoryReportStore();
  const { ControlTowerService } = await import('../src/app/control-tower-service.ts');
  const { createSyntheticProviders } = await import('../src/providers/synthetic.ts');
  const { DEMO_ASSETS, DEMO_CONDITION_PROFILES, DEMO_CONTRACT_KPI_SET, DEMO_PM_RECORDS, DEMO_SCOPE, DEMO_WORK_ORDERS } = await import('../src/demo.ts');
  const workOrders = [...DEMO_WORK_ORDERS];
  const providers = createSyntheticProviders({ assets: DEMO_ASSETS, workOrders, preventiveMaintenance: DEMO_PM_RECORDS, conditionProfiles: DEMO_CONDITION_PROFILES, kpiSets: [DEMO_CONTRACT_KPI_SET] });
  const mutable = { ...providers, maintenance: { ...providers.maintenance, listWorkOrders: async (ids: readonly string[], since: string) => { const rows = await createSyntheticProviders({ assets: DEMO_ASSETS, workOrders, preventiveMaintenance: DEMO_PM_RECORDS, conditionProfiles: DEMO_CONDITION_PROFILES, kpiSets: [DEMO_CONTRACT_KPI_SET] }).maintenance.listWorkOrders(ids, since); return rows; } } };
  const controlTower = new ControlTowerService(mutable, reportStore, DEMO_REPORT, () => '2026-09-09T12:00:00Z');
  const handler = createApiHandler({ reportStore, auditLog, memoryStore: new InMemoryMemoryStore(), ledger, seedReport: DEMO_REPORT, persistence: 'in-memory', now: () => '2026-09-09T12:00:00Z', tokenDirectory: new DemoTokenDirectory(), controlTower, scope: DEMO_SCOPE, mode: 'synthetic' });
  const server = createServer(async (req, res) => { if (await handler(req, res)) return; res.writeHead(404); res.end(); });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const call = async (method: string, path: string, body: unknown, token: string) => { const response = await fetch(`${base}${path}`, { method, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: body === undefined ? undefined : JSON.stringify(body) }); return { status: response.status, json: await response.json() as Record<string, any> }; };
  try {
    await call('POST', '/api/report/transition', { type: 'submit_for_review' }, 'demo-engineer');
    const approved = await call('POST', '/api/report/transition', { type: 'approve', note: 'Reviewed.' }, 'demo-approver');
    assert.equal(approved.json.report.status, 'approved');
    // Source changes: WO-1004 closes with a longer repair. The evidence version moves.
    workOrders[3] = { ...workOrders[3]!, status: 'COMP', completedAt: '2026-09-02T06:00:00Z', downtimeMinutes: 400 };
    const view = await call('GET', '/api/report', undefined, 'demo-viewer');
    assert.equal(view.json.report.status, 'superseded');
    assert.match(view.json.report.supersession.reason, /evidence changed/i);
    assert.equal(view.json.readiness.nextTransitions[0], 'revise');
    const events = (await auditLog.all()).map((e) => e.action);
    assert.ok(events.includes('report.superseded'));
    const ledgerRows = await ledger.bySubject('report', 'DEMO-2026-08');
    assert.equal(ledgerRows[ledgerRows.length - 1]?.kind, 'supersession');
    assert.equal(ledgerRows[ledgerRows.length - 1]?.actorId, 'system.evidence-monitor');
  } finally { await new Promise<void>((resolve) => server.close(() => resolve())); }
});

test('API refuses unauthenticated, under-privileged and malformed requests without touching the report', async () => {
  const api = await startApi();
  try {
    const anonymous = await api.call('POST', '/api/report/transition', { type: 'submit_for_review' }, null);
    assert.equal(anonymous.status, 401);
    const badToken = await api.call('GET', '/api/report', undefined, 'not-a-token');
    assert.equal(badToken.status, 401);
    const viewer = await api.call('POST', '/api/report/transition', { type: 'submit_for_review' }, 'demo-viewer');
    assert.equal(viewer.status, 403);
    const denied = (await api.auditLog.all()).find((e) => e.action === 'auth.denied');
    assert.equal(denied?.actorId, 'demo.viewer');
    const crossScope = await api.call('POST', '/api/report/transition', { type: 'submit_for_review' }, 'demo-other-contract');
    assert.equal(crossScope.status, 403, 'an engineer scoped to another contract cannot touch this report');
    assert.match(crossScope.json.error, /not scoped/);
    const crossRead = await api.call('GET', '/api/report', undefined, 'demo-other-contract');
    assert.equal(crossRead.status, 403);
    const crossRun = await api.call('POST', '/api/agent/run', { capability: 'maintenance-kpi', goal: 'x', riskClass: 'operational', actionMode: 'analyse', context: { contractId: 'DEMO-CONTRACT' } }, 'demo-other-contract');
    assert.equal(crossRun.status, 403);
    const unknown = await api.call('POST', '/api/report/transition', { type: 'publish', actorId: 'x' });
    assert.equal(unknown.status, 400);
    const report = await api.call('GET', '/api/report');
    assert.equal(report.json.report.status, 'draft');
    const missing = await api.call('GET', '/api/nothing');
    assert.equal(missing.status, 404);
  } finally { await api.close(); }
});

test('API audits agent planning and blocks unsupported action modes', async () => {
  const api = await startApi();
  try {
    const blocked = await api.call('POST', '/api/agent/task', { capability: 'maintenance-kpi', goal: 'Explain MTTR', riskClass: 'operational', actionMode: 'execute_write' }, 'demo-engineer');
    assert.equal(blocked.status, 403);
    assert.equal(blocked.json.ok, false);
    assert.equal(blocked.json.audit.action, 'agent.run_blocked');

    const planned = await api.call('POST', '/api/agent/task', { capability: 'maintenance-kpi', goal: 'Explain MTTR', riskClass: 'operational', actionMode: 'analyse' }, 'demo-engineer');
    assert.equal(planned.json.audit.actorId, 'demo.engineer');
    assert.equal(planned.status, 200);
    assert.equal(planned.json.plan.agent.id, 'maintenance-kpi');
    assert.equal(planned.json.audit.action, 'agent.run_planned');

    const invalid = await api.call('POST', '/api/agent/task', { capability: 'maintenance-kpi', actorId: 'engineer-1', goal: 'x', riskClass: 'urgent', actionMode: 'analyse' });
    assert.equal(invalid.status, 400);

    const episodic = await api.memoryStore.byKind('episodic');
    assert.equal(episodic.length, 2);
    assert.deepEqual(await api.auditLog.verifyChain(), { valid: true });
  } finally { await api.close(); }
});

test('API reset restores the seed and is itself audited', async () => {
  const api = await startApi();
  try {
    await api.call('POST', '/api/report/transition', { type: 'submit_for_review', actorId: 'engineer-1' });
    const reset = await api.call('POST', '/api/report/reset', {});
    assert.equal(reset.json.report.status, 'draft');
    assert.equal(reset.json.audit.action, 'report.reset');
    assert.equal(reset.json.audit.fromState, 'under_review');
    assert.equal(reset.json.audit.actorId, 'demo.admin');
    const denied = await api.call('POST', '/api/report/reset', {}, 'demo-approver');
    assert.equal(denied.status, 403);
  } finally { await api.close(); }
});

test('API executes a governed agent run through the composition root and audits it', async () => {
  const { composeApplication } = await import('../src/app/compose.ts');
  const { loadConfig } = await import('../src/config.ts');
  const app = await composeApplication(loadConfig({}), { now: () => '2026-09-09T12:00:00Z' });
  const handler = createApiHandler(app.api);
  const server = createServer(async (req, res) => { if (await handler(req, res)) return; res.writeHead(404); res.end(); });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  try {
    const auth = { 'Content-Type': 'application/json', Authorization: 'Bearer demo-engineer' };
    const health = await (await fetch(`${base}/api/health`)).json() as { capabilities: string[]; auth: string };
    assert.ok(health.capabilities.includes('maintenance-kpi'));
    assert.equal(health.auth, 'demo');
    const me = await (await fetch(`${base}/api/auth/me`, { headers: auth })).json() as { principal: { principalId: string }; permissions: string[] };
    assert.equal(me.principal.principalId, 'demo.engineer');
    assert.ok(me.permissions.includes('agent.run:maintenance'));
    assert.deepEqual(me.principal.scopes[0], { type: 'contract', id: 'DEMO-CONTRACT' });
    const run = await fetch(`${base}/api/agent/run`, { method: 'POST', headers: auth, body: JSON.stringify({ capability: 'maintenance-kpi', goal: 'KPIs', riskClass: 'operational', actionMode: 'analyse' }) });
    assert.equal(run.status, 200);
    const record = await run.json() as { status: string; releaseReady: boolean; toolCalls: unknown[]; auditSequences: number[]; task: { actorId: string } };
    assert.equal(record.status, 'completed');
    assert.equal(record.task.actorId, 'demo.engineer');
    assert.equal(record.releaseReady, true);
    assert.equal(record.toolCalls.length, 4);
    const viewerRun = await fetch(`${base}/api/agent/run`, { method: 'POST', headers: { ...auth, Authorization: 'Bearer demo-viewer' }, body: JSON.stringify({ capability: 'maintenance-kpi', goal: 'KPIs', riskClass: 'operational', actionMode: 'analyse' }) });
    assert.equal(viewerRun.status, 403);
    const financeRunsAsset = await fetch(`${base}/api/agent/run`, { method: 'POST', headers: { ...auth, Authorization: 'Bearer demo-finance' }, body: JSON.stringify({ capability: 'asset-health', goal: 'x', riskClass: 'operational', actionMode: 'analyse' }) });
    assert.equal(financeRunsAsset.status, 403, 'finance reviewer cannot run asset capabilities');
    const reliabilityRunsReport = await fetch(`${base}/api/agent/run`, { method: 'POST', headers: { ...auth, Authorization: 'Bearer demo-reliability' }, body: JSON.stringify({ capability: 'monthly-report', goal: 'x', riskClass: 'contractual', actionMode: 'draft' }) });
    assert.equal(reliabilityRunsReport.status, 403, 'reliability engineer cannot draft contractual reports');
    const blocked = await fetch(`${base}/api/agent/run`, { method: 'POST', headers: auth, body: JSON.stringify({ capability: 'asset-health', goal: 'x', riskClass: 'operational', actionMode: 'control' }) });
    assert.equal(blocked.status, 403);
    const runs = await (await fetch(`${base}/api/runs`, { headers: auth })).json() as { runs: unknown[] };
    assert.equal(runs.runs.length, 2);
    const audit = await (await fetch(`${base}/api/audit`, { headers: auth })).json() as { chain: { valid: boolean } };
    assert.equal(audit.chain.valid, true);
  } finally { await new Promise<void>((resolve) => server.close(() => resolve())); await app.close(); }
});

test('API serves the synthetic portfolio DTO to scoped principals only', async () => {
  const { composeApplication } = await import('../src/app/compose.ts');
  const { loadConfig } = await import('../src/config.ts');
  const app = await composeApplication(loadConfig({}), { now: () => '2026-09-09T12:00:00Z' });
  const handler = createApiHandler(app.api);
  const server = createServer(async (req, res) => { if (await handler(req, res)) return; res.writeHead(404); res.end(); });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  try {
    const ok = await fetch(`${base}/api/portfolio`, { headers: { Authorization: 'Bearer demo-finance' } });
    assert.equal(ok.status, 200);
    const dto = await ok.json() as { classification: string; cells: unknown[]; forecastMeta: { confidence: string } };
    assert.equal(dto.classification, 'PUBLIC_SYNTHETIC');
    assert.ok(dto.cells.length > 0);
    const outOfScope = await fetch(`${base}/api/portfolio`, { headers: { Authorization: 'Bearer demo-other-contract' } });
    assert.equal(outOfScope.status, 403);
    const anonymous = await fetch(`${base}/api/portfolio`);
    assert.equal(anonymous.status, 401);
  } finally { await new Promise<void>((resolve) => server.close(() => resolve())); await app.close(); }
});
