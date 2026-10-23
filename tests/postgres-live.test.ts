import test from 'node:test';
import assert from 'node:assert/strict';

import { createPgDatabase } from '../src/persistence/pg-database.ts';
import { PgAuditLog, PgDecisionLedger, PgMemoryStore, PgReportStore, PgRunStore, ensureSchema } from '../src/persistence/postgres.ts';
import { DEMO_REPORT } from '../src/demo.ts';

const url = process.env.DATABASE_URL;

test('live PostgreSQL adapters (requires DATABASE_URL)', { skip: url ? false : 'DATABASE_URL not set' }, async () => {
  const db = await createPgDatabase(url as string);
  try {
    await db.query('DROP TABLE IF EXISTS railmind_audit_events, railmind_memory_records, railmind_reports, railmind_ledger, railmind_runs, railmind_review_comments, railmind_disagreements, railmind_knowledge_documents');
    await ensureSchema(db);
    const log = new PgAuditLog(db);
    const memory = new PgMemoryStore(db);
    const reports = new PgReportStore(db);

    const first = await log.append({ action: 'report.submitted_for_review', actorId: 'engineer-1', subjectType: 'report', subjectId: DEMO_REPORT.reportId, at: '2026-09-01T08:00:00Z' });
    await log.append({ action: 'report.approved', actorId: 'mgr-1', actorRole: 'Manager', subjectType: 'report', subjectId: DEMO_REPORT.reportId, at: '2026-09-02T09:00:00Z' });
    assert.deepEqual(await log.verifyChain(), { valid: true });
    await assert.rejects(() => db.query('UPDATE railmind_audit_events SET actor_id = $1 WHERE sequence = $2', ['x', first.sequence]), /append-only/);
    await assert.rejects(() => db.query('DELETE FROM railmind_audit_events WHERE sequence = $1', [first.sequence]), /append-only/);

    await memory.append({ id: 'MEM-1', kind: 'episodic', taskId: 'T-1', subject: 'run', content: 'planned', createdAt: '2026-09-01T08:00:00Z', evidence: [], tags: ['kpi'] });
    assert.equal((await memory.byTask('T-1')).length, 1);

    await reports.save(DEMO_REPORT);
    await reports.save({ ...DEMO_REPORT, status: 'under_review' });
    assert.equal((await reports.get(DEMO_REPORT.reportId))?.status, 'under_review');

    const ledger = new PgDecisionLedger(db);
    const rec = await ledger.append({ kind: 'recommendation', subjectType: 'report', subjectId: DEMO_REPORT.reportId, at: '2026-09-01T00:00:00Z', actorId: 'engineer-1', payload: { a: 1 }, evidence: [{ sourceSystem: 'maximo', entityType: 'work-order', entityId: 'WO-1001', observedAt: '2026-08-03T08:00:00Z' }], kpiVersions: { mttr: 'demo-v1' } });
    const dec = await ledger.append({ kind: 'decision', subjectType: 'report', subjectId: DEMO_REPORT.reportId, at: '2026-09-02T00:00:00Z', actorId: 'mgr-1', payload: { d: 1 }, evidence: [{ sourceSystem: 'maximo', entityType: 'work-order', entityId: 'WO-1001', observedAt: '2026-08-03T08:00:00Z' }], kpiVersions: {}, follows: rec.ledgerId });
    assert.equal((await ledger.trace(dec.ledgerId))?.lineage[0]?.ledgerId, rec.ledgerId);
    await assert.rejects(() => db.query('UPDATE railmind_ledger SET actor_id = $1 WHERE ledger_id = $2', ['x', rec.ledgerId]), /append-only/);
    await assert.rejects(() => db.query('DELETE FROM railmind_ledger WHERE ledger_id = $1', [rec.ledgerId]), /append-only/);

    const runs = new PgRunStore(db);
    await runs.append({ runId: 'RUN-LIVE-1', task: { taskId: 'T-1', actorId: 'engineer-1', goal: 'g', capability: 'maintenance-kpi', riskClass: 'operational', actionMode: 'analyse', requestedAt: '2026-09-01T08:00:00Z' }, agentId: 'maintenance-kpi', status: 'completed', classification: 'synthetic', startedAt: '2026-09-01T08:00:00Z', completedAt: '2026-09-01T08:00:01Z', toolCalls: [], modelUsed: false, output: null, approvalRequired: false, releaseReady: true, reason: 'ok', auditSequences: [1] });
    assert.equal((await runs.get('RUN-LIVE-1'))?.status, 'completed');
    await assert.rejects(() => db.query('DELETE FROM railmind_runs WHERE run_id = $1', ['RUN-LIVE-1']), /append-only/);
  } finally {
    await db.close();
  }
});
