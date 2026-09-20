import test from 'node:test';
import assert from 'node:assert/strict';

import { GENESIS_HASH } from '../src/audit/log.ts';
import { DEMO_REPORT } from '../src/demo.ts';
import { PgAuditLog, PgMemoryStore, PgReportStore, PgReviewStore, PgRunStore, RAILMIND_SCHEMA_SQL, ensureSchema } from '../src/persistence/postgres.ts';
import { createComment, raiseDisagreement, recordPosition } from '../src/review/contracts.ts';
import type { SqlClient, SqlDatabase, SqlRow } from '../src/persistence/sql.ts';

/**
 * A small in-process SQL fake that understands exactly the statements the
 * adapters issue. It verifies SQL shape, parameter binding and row mapping
 * without a live database. A live PostgreSQL run is exercised by
 * tests/postgres-live.test.ts when DATABASE_URL is set.
 */
class FakeDatabase implements SqlDatabase {
  readonly audit: SqlRow[] = [];
  readonly memory: SqlRow[] = [];
  readonly reports = new Map<string, SqlRow>();
  readonly runs = new Map<string, SqlRow>();
  readonly comments = new Map<string, SqlRow>();
  readonly disagreements = new Map<string, SqlRow>();
  readonly statements: string[] = [];
  transactions = 0;
  locks = 0;

  async query(text: string, params: readonly unknown[] = []): Promise<{ rows: SqlRow[] }> {
    this.statements.push(text.trim().split(/\s+/).slice(0, 3).join(' '));
    const p = params;
    if (text.includes('pg_advisory_xact_lock')) { this.locks += 1; return { rows: [] }; }
    if (text.startsWith('SELECT sequence, hash FROM railmind_audit_events')) {
      const last = this.audit[this.audit.length - 1];
      return { rows: last ? [last] : [] };
    }
    if (text.includes('INSERT INTO railmind_audit_events')) {
      this.audit.push({ sequence: p[0], hash: p[1], previous_hash: p[2], action: p[3], actor_id: p[4], actor_role: p[5], subject_type: p[6], subject_id: p[7], at: new Date(String(p[8])), from_state: p[9], to_state: p[10], reason: p[11], evidence: JSON.parse(String(p[12])) });
      return { rows: [] };
    }
    if (text.includes('FROM railmind_audit_events WHERE subject_type')) {
      return { rows: this.audit.filter((row) => row.subject_type === p[0] && row.subject_id === p[1]) };
    }
    if (text.includes('FROM railmind_audit_events ORDER BY sequence')) return { rows: [...this.audit] };
    if (text.includes('INSERT INTO railmind_memory_records')) {
      this.memory.push({ id: p[0], kind: p[1], task_id: p[2], subject: p[3], content: p[4], created_at: new Date(String(p[5])), evidence: JSON.parse(String(p[6])), tags: p[7] });
      return { rows: [] };
    }
    if (text.includes('FROM railmind_memory_records WHERE task_id')) return { rows: this.memory.filter((row) => row.task_id === p[0]) };
    if (text.includes('FROM railmind_memory_records WHERE kind')) return { rows: this.memory.filter((row) => row.kind === p[0]) };
    if (text.includes('INSERT INTO railmind_reports')) { this.reports.set(String(p[0]), { package: JSON.parse(String(p[2])) }); return { rows: [] }; }
    if (text.includes('SELECT package FROM railmind_reports WHERE')) { const row = this.reports.get(String(p[0])); return { rows: row ? [row] : [] }; }
    if (text.includes('SELECT package FROM railmind_reports ORDER')) return { rows: [...this.reports.values()] };
    if (text.includes('INSERT INTO railmind_runs')) { if (this.runs.has(String(p[0]))) throw new Error('duplicate key value violates unique constraint'); this.runs.set(String(p[0]), { record: JSON.parse(String(p[10])) }); return { rows: [] }; }
    if (text.includes('SELECT record FROM railmind_runs WHERE')) { const row = this.runs.get(String(p[0])); return { rows: row ? [row] : [] }; }
    if (text.includes('SELECT record FROM railmind_runs ORDER')) return { rows: [...this.runs.values()] };
    if (text.includes('INSERT INTO railmind_review_comments')) { this.comments.set(String(p[0]), { report_id: p[1], status: p[3], record: JSON.parse(String(p[4])) }); return { rows: [] }; }
    if (text.includes('FROM railmind_review_comments WHERE comment_id')) { const row = this.comments.get(String(p[0])); return { rows: row ? [row] : [] }; }
    if (text.includes('FROM railmind_review_comments WHERE report_id')) return { rows: [...this.comments.values()].filter((row) => row.report_id === p[0]) };
    if (text.includes('count(*)::int AS n FROM railmind_review_comments')) return { rows: [{ n: this.comments.size }] };
    if (text.includes('INSERT INTO railmind_disagreements')) { this.disagreements.set(String(p[0]), { report_id: p[1], status: p[3], record: JSON.parse(String(p[4])) }); return { rows: [] }; }
    if (text.includes('FROM railmind_disagreements WHERE disagreement_id')) { const row = this.disagreements.get(String(p[0])); return { rows: row ? [row] : [] }; }
    if (text.includes('FROM railmind_disagreements WHERE report_id')) return { rows: [...this.disagreements.values()].filter((row) => row.report_id === p[0]) };
    if (text.includes('count(*)::int AS n FROM railmind_disagreements')) return { rows: [{ n: this.disagreements.size }] };
    if (text.includes('CREATE TABLE IF NOT EXISTS railmind_audit_events')) return { rows: [] };
    throw new Error(`Unexpected SQL: ${text}`);
  }

  async transaction<T>(fn: (tx: SqlClient) => Promise<T>): Promise<T> {
    this.transactions += 1;
    return fn(this);
  }

  async close(): Promise<void> {}
}

test('schema SQL is append-only for audit events and matches the migration file', async () => {
  assert.match(RAILMIND_SCHEMA_SQL, /BEFORE UPDATE OR DELETE ON railmind_audit_events/);
  assert.match(RAILMIND_SCHEMA_SQL, /append-only/);
  const db = new FakeDatabase();
  await ensureSchema(db);
  assert.equal(db.statements.length, 1);
});

test('PgAuditLog appends inside a locked transaction and chains hashes like the in-memory log', async () => {
  const db = new FakeDatabase();
  const log = new PgAuditLog(db);
  const first = await log.append({ action: 'report.submitted_for_review', actorId: 'engineer-1', subjectType: 'report', subjectId: 'R-1', at: '2026-09-01T08:00:00Z', evidence: [{ sourceSystem: 'maximo', entityType: 'work-order', entityId: 'WO-1', observedAt: '2026-08-03T08:00:00Z' }] });
  const second = await log.append({ action: 'report.approved', actorId: 'mgr-1', actorRole: 'Manager', subjectType: 'report', subjectId: 'R-1', at: '2026-09-02T09:00:00Z' });
  assert.equal(db.transactions, 2);
  assert.equal(db.locks, 2);
  assert.equal(first.sequence, 1);
  assert.equal(first.previousHash, GENESIS_HASH);
  assert.equal(second.previousHash, first.hash);

  const trail = await log.bySubject('report', 'R-1');
  assert.equal(trail.length, 2);
  assert.equal(trail[0]?.evidence[0]?.entityId, 'WO-1');
  assert.equal(trail[0]?.at, '2026-09-01T08:00:00.000Z');
  assert.equal(trail[1]?.actorRole, 'Manager');
  assert.deepEqual(await log.verifyChain(), { valid: true });
});

test('PgAuditLog detects a broken chain read back from the database', async () => {
  const db = new FakeDatabase();
  const log = new PgAuditLog(db);
  await log.append({ action: 'agent.run_planned', actorId: 'a', subjectType: 'task', subjectId: 'T-1', at: '2026-09-01T08:00:00Z' });
  await log.append({ action: 'agent.run_planned', actorId: 'a', subjectType: 'task', subjectId: 'T-2', at: '2026-09-01T08:01:00Z' });
  db.audit[0]!.actor_id = 'tampered';
  const result = await log.verifyChain();
  assert.equal(result.valid, false);
  assert.equal(result.brokenAtSequence, 1);
});

test('PgAuditLog rejects anonymous events before touching the database', async () => {
  const db = new FakeDatabase();
  const log = new PgAuditLog(db);
  await assert.rejects(() => log.append({ action: 'report.locked', actorId: ' ', subjectType: 'report', subjectId: 'R-1', at: '2026-09-03T09:00:00Z' }), /named actor/);
  assert.equal(db.transactions, 0);
});

test('PgMemoryStore round-trips records by task and by kind', async () => {
  const db = new FakeDatabase();
  const store = new PgMemoryStore(db);
  await store.append({ id: 'MEM-1', kind: 'episodic', taskId: 'T-1', subject: 'run', content: 'planned', createdAt: '2026-09-01T08:00:00Z', evidence: [], tags: ['kpi'] });
  await store.append({ id: 'MEM-2', kind: 'decision', taskId: 'T-2', subject: 'review', content: 'approved', createdAt: '2026-09-01T09:00:00Z', evidence: [], tags: ['contract'] });
  const byTask = await store.byTask('T-1');
  assert.equal(byTask.length, 1);
  assert.deepEqual(byTask[0]?.tags, ['kpi']);
  const decisions = await store.byKind('decision');
  assert.equal(decisions[0]?.id, 'MEM-2');
  assert.equal(decisions[0]?.createdAt, '2026-09-01T09:00:00.000Z');
});

test('PgReportStore upserts and reads back the full package', async () => {
  const db = new FakeDatabase();
  const store = new PgReportStore(db);
  assert.equal(await store.get(DEMO_REPORT.reportId), null);
  await store.save(DEMO_REPORT);
  await store.save({ ...DEMO_REPORT, status: 'under_review' });
  const stored = await store.get(DEMO_REPORT.reportId);
  assert.equal(stored?.status, 'under_review');
  assert.equal(stored?.kpis.length, 6);
  assert.equal((await store.list()).length, 1);
});

test('PgRunStore writes each governed run once and reads it back intact', async () => {
  const db = new FakeDatabase();
  const store = new PgRunStore(db);
  const record = { runId: 'RUN-1', task: { taskId: 'T-1', actorId: 'engineer-1', goal: 'g', capability: 'maintenance-kpi', riskClass: 'operational' as const, actionMode: 'analyse' as const, requestedAt: '2026-09-01T08:00:00Z' }, agentId: 'maintenance-kpi', status: 'completed' as const, classification: 'synthetic' as const, startedAt: '2026-09-01T08:00:00Z', completedAt: '2026-09-01T08:00:01Z', toolCalls: [], modelUsed: false, output: null, approvalRequired: false, releaseReady: true, reason: 'ok', auditSequences: [1, 2] };
  await store.append(record);
  assert.deepEqual(await store.get('RUN-1'), record);
  assert.equal((await store.all()).length, 1);
  await assert.rejects(() => store.append(record), /duplicate key/);
  assert.match(RAILMIND_SCHEMA_SQL, /BEFORE UPDATE OR DELETE ON railmind_runs/);
});

test('PgReviewStore upserts comments and disagreements as projections and counts them for id minting', async () => {
  const db = new FakeDatabase();
  const store = new PgReviewStore(db);
  const owner = { principalId: 'rmd.reviewer', role: 'contract_manager', party: 'owner' as const };
  const contractor = { principalId: 'ctr.engineer', role: 'maintenance_engineer', party: 'contractor' as const };
  const comment = createComment({ commentId: 'CMT-1', reportId: 'R-1', contractId: 'C-1', subject: { type: 'kpi', id: 'mttr' }, actor: owner, text: 'Confirm the clock start.', at: '2026-09-02T08:00:00Z' }).record;
  await store.saveComment(comment);
  assert.equal((await store.getComment('CMT-1'))?.status, 'open');
  const raised = raiseDisagreement({ disagreementId: 'DSG-1', reportId: 'R-1', contractId: 'C-1', subject: { type: 'kpi', id: 'mttr' }, summary: 'Access delay.', raisedBy: contractor, position: { text: 'Waited for access.', evidence: [] }, at: '2026-09-02T09:00:00Z' }).record;
  await store.saveDisagreement(raised);
  const both = recordPosition(raised, owner, 'Access was on time.', [], '2026-09-02T10:00:00Z').record;
  await store.saveDisagreement(both);
  const stored = await store.getDisagreement('DSG-1');
  assert.equal(stored?.status, 'positions_recorded');
  assert.equal(stored?.history.length, 2);
  assert.equal(db.disagreements.get('DSG-1')?.status, 'positions_recorded', 'the status column follows the record');
  assert.equal((await store.listDisagreements('R-1')).length, 1);
  assert.equal((await store.listComments('R-2')).length, 0);
  assert.deepEqual(await store.count(), { comments: 1, disagreements: 1 });
  assert.ok(db.statements.some((s) => s.startsWith('INSERT INTO railmind_review_comments')));
});
