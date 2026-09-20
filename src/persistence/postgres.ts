import type { AgentRunRecord, EvidenceRef } from '../agent-os/contracts.ts';
import type { RunStore } from '../agent-os/run-store.ts';
import type { ReviewStore } from '../review/store.ts';
import type { Disagreement, ReviewComment } from '../review/contracts.ts';
import type { MemoryKind, MemoryRecord, MemoryStore } from '../agent-os/memory.ts';
import {
  GENESIS_HASH,
  computeAuditHash,
  type AuditEvent,
  type AuditEventInput,
  type AuditLog,
} from '../audit/log.ts';
import type { ReportPackage } from '../reporting/contracts.ts';
import { buildTrace, validateLedgerInput, type DecisionLedger, type LedgerRecord, type LedgerRecordInput, type LedgerTrace } from '../ledger/contracts.ts';
import type { ReportStore } from '../reporting/store.ts';
import type { SqlClient, SqlDatabase, SqlRow } from './sql.ts';

/**
 * PostgreSQL adapters for RailMind-owned state. They implement the same
 * interfaces as the in-memory adapters, so domain code and the API do not
 * change when persistence is switched on.
 */

export const RAILMIND_SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS railmind_audit_events (
  sequence      BIGINT PRIMARY KEY,
  hash          TEXT NOT NULL UNIQUE,
  previous_hash TEXT NOT NULL,
  action        TEXT NOT NULL,
  actor_id      TEXT NOT NULL,
  actor_role    TEXT,
  subject_type  TEXT NOT NULL,
  subject_id    TEXT NOT NULL,
  at            TIMESTAMPTZ NOT NULL,
  from_state    TEXT,
  to_state      TEXT,
  reason        TEXT,
  evidence      JSONB NOT NULL DEFAULT '[]'::jsonb,
  recorded_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS railmind_audit_events_subject_idx ON railmind_audit_events (subject_type, subject_id, sequence);
CREATE OR REPLACE FUNCTION railmind_audit_immutable() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'railmind_audit_events is append-only';
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS railmind_audit_no_update ON railmind_audit_events;
CREATE TRIGGER railmind_audit_no_update
  BEFORE UPDATE OR DELETE ON railmind_audit_events
  FOR EACH ROW EXECUTE FUNCTION railmind_audit_immutable();
CREATE TABLE IF NOT EXISTS railmind_memory_records (
  id         TEXT PRIMARY KEY,
  kind       TEXT NOT NULL,
  task_id    TEXT,
  subject    TEXT NOT NULL,
  content    TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  evidence   JSONB NOT NULL DEFAULT '[]'::jsonb,
  tags       TEXT[] NOT NULL DEFAULT '{}'
);
CREATE INDEX IF NOT EXISTS railmind_memory_records_task_idx ON railmind_memory_records (task_id);
CREATE INDEX IF NOT EXISTS railmind_memory_records_kind_idx ON railmind_memory_records (kind);
CREATE TABLE IF NOT EXISTS railmind_ledger (
  sequence         BIGINT PRIMARY KEY,
  ledger_id        TEXT NOT NULL UNIQUE,
  kind             TEXT NOT NULL,
  subject_type     TEXT NOT NULL,
  subject_id       TEXT NOT NULL,
  at               TIMESTAMPTZ NOT NULL,
  actor_id         TEXT NOT NULL,
  actor_role       TEXT,
  payload          JSONB NOT NULL DEFAULT '{}'::jsonb,
  evidence         JSONB NOT NULL DEFAULT '[]'::jsonb,
  kpi_versions     JSONB NOT NULL DEFAULT '{}'::jsonb,
  evidence_version TEXT,
  supersedes       TEXT REFERENCES railmind_ledger (ledger_id),
  follows          TEXT REFERENCES railmind_ledger (ledger_id),
  audit_sequence   BIGINT,
  recorded_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS railmind_ledger_subject_idx ON railmind_ledger (subject_type, subject_id, sequence);
DROP TRIGGER IF EXISTS railmind_ledger_no_update ON railmind_ledger;
CREATE TRIGGER railmind_ledger_no_update
  BEFORE UPDATE OR DELETE ON railmind_ledger
  FOR EACH ROW EXECUTE FUNCTION railmind_audit_immutable();
CREATE TABLE IF NOT EXISTS railmind_reports (
  report_id  TEXT PRIMARY KEY,
  status     TEXT NOT NULL,
  package    JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS railmind_runs (
  run_id        TEXT PRIMARY KEY,
  task_id       TEXT NOT NULL,
  actor_id      TEXT NOT NULL,
  capability    TEXT NOT NULL,
  agent_id      TEXT,
  status        TEXT NOT NULL,
  classification TEXT NOT NULL,
  started_at    TIMESTAMPTZ NOT NULL,
  completed_at  TIMESTAMPTZ NOT NULL,
  release_ready BOOLEAN NOT NULL,
  record        JSONB NOT NULL,
  recorded_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS railmind_runs_task_idx ON railmind_runs (task_id, started_at);
DROP TRIGGER IF EXISTS railmind_runs_no_update ON railmind_runs;
CREATE TRIGGER railmind_runs_no_update
  BEFORE UPDATE OR DELETE ON railmind_runs
  FOR EACH ROW EXECUTE FUNCTION railmind_audit_immutable();

CREATE TABLE IF NOT EXISTS railmind_review_comments (
  comment_id  TEXT PRIMARY KEY,
  report_id   TEXT NOT NULL,
  contract_id TEXT NOT NULL,
  status      TEXT NOT NULL,
  record      JSONB NOT NULL,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS railmind_review_comments_report_idx ON railmind_review_comments (report_id);
CREATE TABLE IF NOT EXISTS railmind_disagreements (
  disagreement_id TEXT PRIMARY KEY,
  report_id       TEXT NOT NULL,
  contract_id     TEXT NOT NULL,
  status          TEXT NOT NULL,
  record          JSONB NOT NULL,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS railmind_disagreements_report_idx ON railmind_disagreements (report_id);
`;

/** Advisory lock key that serialises audit appends across connections. */
const AUDIT_LOCK_KEY = 44_001;

export async function ensureSchema(db: SqlClient): Promise<void> {
  await db.query(RAILMIND_SCHEMA_SQL);
}

function text(row: SqlRow, key: string): string {
  const value = row[key];
  return value === null || value === undefined ? '' : String(value);
}

function optionalText(row: SqlRow, key: string): string | undefined {
  const value = row[key];
  return value === null || value === undefined ? undefined : String(value);
}

function isoDate(row: SqlRow, key: string): string {
  const value = row[key];
  if (value instanceof Date) return value.toISOString();
  const parsed = Date.parse(String(value));
  return Number.isNaN(parsed) ? String(value) : new Date(parsed).toISOString();
}

function jsonArray<T>(row: SqlRow, key: string): readonly T[] {
  const value = row[key];
  if (Array.isArray(value)) return value as T[];
  if (typeof value === 'string') {
    try { const parsed = JSON.parse(value); return Array.isArray(parsed) ? parsed as T[] : []; } catch { return []; }
  }
  return [];
}

function toAuditEvent(row: SqlRow): AuditEvent {
  return {
    sequence: Number(row.sequence),
    hash: text(row, 'hash'),
    previousHash: text(row, 'previous_hash'),
    action: text(row, 'action') as AuditEvent['action'],
    actorId: text(row, 'actor_id'),
    actorRole: optionalText(row, 'actor_role'),
    subjectType: text(row, 'subject_type') as AuditEvent['subjectType'],
    subjectId: text(row, 'subject_id'),
    at: isoDate(row, 'at'),
    fromState: optionalText(row, 'from_state'),
    toState: optionalText(row, 'to_state'),
    reason: optionalText(row, 'reason'),
    evidence: jsonArray<EvidenceRef>(row, 'evidence'),
  };
}

export class PgAuditLog implements AuditLog {
  readonly #db: SqlDatabase;

  constructor(db: SqlDatabase) {
    this.#db = db;
  }

  async append(input: AuditEventInput): Promise<AuditEvent> {
    if (input.actorId.trim().length === 0) throw new Error('Audit event requires a named actor.');
    if (input.subjectId.trim().length === 0) throw new Error('Audit event requires a subject id.');
    if (Number.isNaN(Date.parse(input.at))) throw new Error('Audit event requires a valid timestamp.');

    return this.#db.transaction(async (tx) => {
      await tx.query('SELECT pg_advisory_xact_lock($1)', [AUDIT_LOCK_KEY]);
      const last = await tx.query('SELECT sequence, hash FROM railmind_audit_events ORDER BY sequence DESC LIMIT 1');
      const previous = last.rows[0];
      const sequence = previous ? Number(previous.sequence) + 1 : 1;
      const previousHash = previous ? String(previous.hash) : GENESIS_HASH;
      const hash = await computeAuditHash(input, sequence, previousHash);
      const evidence = input.evidence ?? [];
      await tx.query(
        `INSERT INTO railmind_audit_events
          (sequence, hash, previous_hash, action, actor_id, actor_role, subject_type, subject_id, at, from_state, to_state, reason, evidence)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13::jsonb)`,
        [sequence, hash, previousHash, input.action, input.actorId, input.actorRole ?? null, input.subjectType, input.subjectId, input.at,
          input.fromState ?? null, input.toState ?? null, input.reason ?? null, JSON.stringify(evidence)],
      );
      return { ...input, evidence, sequence, previousHash, hash };
    });
  }

  async bySubject(subjectType: AuditEventInput['subjectType'], subjectId: string): Promise<readonly AuditEvent[]> {
    const result = await this.#db.query(
      'SELECT * FROM railmind_audit_events WHERE subject_type = $1 AND subject_id = $2 ORDER BY sequence ASC',
      [subjectType, subjectId],
    );
    return result.rows.map(toAuditEvent);
  }

  async all(): Promise<readonly AuditEvent[]> {
    const result = await this.#db.query('SELECT * FROM railmind_audit_events ORDER BY sequence ASC');
    return result.rows.map(toAuditEvent);
  }

  async verifyChain(): Promise<{ valid: boolean; brokenAtSequence?: number }> {
    let previousHash = GENESIS_HASH;
    let expectedSequence = 1;
    for (const event of await this.all()) {
      const expected = await computeAuditHash(event, event.sequence, previousHash);
      if (event.sequence !== expectedSequence || event.previousHash !== previousHash || event.hash !== expected) {
        return { valid: false, brokenAtSequence: event.sequence };
      }
      previousHash = event.hash;
      expectedSequence += 1;
    }
    return { valid: true };
  }
}

function toMemoryRecord(row: SqlRow): MemoryRecord {
  return {
    id: text(row, 'id'),
    kind: text(row, 'kind') as MemoryKind,
    taskId: optionalText(row, 'task_id'),
    subject: text(row, 'subject'),
    content: text(row, 'content'),
    createdAt: isoDate(row, 'created_at'),
    evidence: jsonArray<EvidenceRef>(row, 'evidence'),
    tags: Array.isArray(row.tags) ? (row.tags as unknown[]).map(String) : [],
  };
}

export class PgMemoryStore implements MemoryStore {
  readonly #db: SqlClient;

  constructor(db: SqlClient) {
    this.#db = db;
  }

  async append(record: MemoryRecord): Promise<void> {
    await this.#db.query(
      `INSERT INTO railmind_memory_records (id, kind, task_id, subject, content, created_at, evidence, tags)
       VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8)`,
      [record.id, record.kind, record.taskId ?? null, record.subject, record.content, record.createdAt, JSON.stringify(record.evidence), [...record.tags]],
    );
  }

  async byTask(taskId: string): Promise<readonly MemoryRecord[]> {
    const result = await this.#db.query('SELECT * FROM railmind_memory_records WHERE task_id = $1 ORDER BY created_at ASC', [taskId]);
    return result.rows.map(toMemoryRecord);
  }

  async byKind(kind: MemoryKind): Promise<readonly MemoryRecord[]> {
    const result = await this.#db.query('SELECT * FROM railmind_memory_records WHERE kind = $1 ORDER BY created_at ASC', [kind]);
    return result.rows.map(toMemoryRecord);
  }
}

function toReport(row: SqlRow): ReportPackage {
  const value = row.package;
  if (typeof value === 'string') return JSON.parse(value) as ReportPackage;
  return value as ReportPackage;
}

export class PgReportStore implements ReportStore {
  readonly #db: SqlClient;

  constructor(db: SqlClient) {
    this.#db = db;
  }

  async get(reportId: string): Promise<ReportPackage | null> {
    const result = await this.#db.query('SELECT package FROM railmind_reports WHERE report_id = $1', [reportId]);
    const row = result.rows[0];
    return row ? toReport(row) : null;
  }

  async save(report: ReportPackage): Promise<void> {
    await this.#db.query(
      `INSERT INTO railmind_reports (report_id, status, package, updated_at)
       VALUES ($1, $2, $3::jsonb, now())
       ON CONFLICT (report_id) DO UPDATE SET status = EXCLUDED.status, package = EXCLUDED.package, updated_at = now()`,
      [report.reportId, report.status, JSON.stringify(report)],
    );
  }

  async list(): Promise<readonly ReportPackage[]> {
    const result = await this.#db.query('SELECT package FROM railmind_reports ORDER BY report_id ASC');
    return result.rows.map(toReport);
  }
}

const LEDGER_LOCK_KEY = 44_002;

function jsonObject(row: SqlRow, key: string): Record<string, unknown> {
  const value = row[key];
  if (typeof value === 'object' && value !== null && !Array.isArray(value)) return value as Record<string, unknown>;
  if (typeof value === 'string') { try { const parsed = JSON.parse(value); return typeof parsed === 'object' && parsed !== null ? parsed as Record<string, unknown> : {}; } catch { return {}; } }
  return {};
}

function toLedgerRecord(row: SqlRow): LedgerRecord {
  return {
    ledgerId: text(row, 'ledger_id'),
    sequence: Number(row.sequence),
    kind: text(row, 'kind') as LedgerRecord['kind'],
    subjectType: text(row, 'subject_type') as LedgerRecord['subjectType'],
    subjectId: text(row, 'subject_id'),
    at: isoDate(row, 'at'),
    actorId: text(row, 'actor_id'),
    actorRole: optionalText(row, 'actor_role'),
    payload: jsonObject(row, 'payload'),
    evidence: jsonArray<EvidenceRef>(row, 'evidence'),
    kpiVersions: jsonObject(row, 'kpi_versions') as Record<string, string>,
    evidenceVersion: optionalText(row, 'evidence_version'),
    supersedes: optionalText(row, 'supersedes'),
    follows: optionalText(row, 'follows'),
    auditSequence: row.audit_sequence === null || row.audit_sequence === undefined ? undefined : Number(row.audit_sequence),
  };
}

/** Append-only decision ledger in PostgreSQL; rows are immutable by trigger. */
export class PgDecisionLedger implements DecisionLedger {
  readonly #db: SqlDatabase;

  constructor(db: SqlDatabase) {
    this.#db = db;
  }

  async append(input: LedgerRecordInput): Promise<LedgerRecord> {
    validateLedgerInput(input);
    return this.#db.transaction(async (tx) => {
      await tx.query('SELECT pg_advisory_xact_lock($1)', [LEDGER_LOCK_KEY]);
      const last = await tx.query('SELECT sequence FROM railmind_ledger ORDER BY sequence DESC LIMIT 1');
      const sequence = last.rows[0] ? Number(last.rows[0].sequence) + 1 : 1;
      const ledgerId = `LED-${String(sequence).padStart(6, '0')}`;
      await tx.query(
        `INSERT INTO railmind_ledger (sequence, ledger_id, kind, subject_type, subject_id, at, actor_id, actor_role, payload, evidence, kpi_versions, evidence_version, supersedes, follows, audit_sequence)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10::jsonb, $11::jsonb, $12, $13, $14, $15)`,
        [sequence, ledgerId, input.kind, input.subjectType, input.subjectId, input.at, input.actorId, input.actorRole ?? null, JSON.stringify(input.payload), JSON.stringify(input.evidence), JSON.stringify(input.kpiVersions), input.evidenceVersion ?? null, input.supersedes ?? null, input.follows ?? null, input.auditSequence ?? null],
      );
      return { ...input, ledgerId, sequence };
    });
  }

  async get(ledgerId: string): Promise<LedgerRecord | null> {
    const result = await this.#db.query('SELECT * FROM railmind_ledger WHERE ledger_id = $1', [ledgerId]);
    return result.rows[0] ? toLedgerRecord(result.rows[0]) : null;
  }

  async bySubject(subjectType: LedgerRecordInput['subjectType'], subjectId: string): Promise<readonly LedgerRecord[]> {
    const result = await this.#db.query('SELECT * FROM railmind_ledger WHERE subject_type = $1 AND subject_id = $2 ORDER BY sequence ASC', [subjectType, subjectId]);
    return result.rows.map(toLedgerRecord);
  }

  async all(): Promise<readonly LedgerRecord[]> {
    const result = await this.#db.query('SELECT * FROM railmind_ledger ORDER BY sequence ASC');
    return result.rows.map(toLedgerRecord);
  }

  async trace(ledgerId: string): Promise<LedgerTrace | null> {
    const record = await this.get(ledgerId);
    return record ? buildTrace(record, await this.all()) : null;
  }
}

function toRunRecord(row: SqlRow): AgentRunRecord {
  const value = row.record;
  return (typeof value === 'string' ? JSON.parse(value) : value) as AgentRunRecord;
}

/** Immutable run records in PostgreSQL; rows are protected by the same append-only trigger as the audit log. */
export class PgRunStore implements RunStore {
  readonly #db: SqlClient;

  constructor(db: SqlClient) {
    this.#db = db;
  }

  async append(record: AgentRunRecord): Promise<void> {
    await this.#db.query(
      `INSERT INTO railmind_runs (run_id, task_id, actor_id, capability, agent_id, status, classification, started_at, completed_at, release_ready, record)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::jsonb)`,
      [record.runId, record.task.taskId, record.task.actorId, record.task.capability, record.agentId, record.status, record.classification, record.startedAt, record.completedAt, record.releaseReady, JSON.stringify(record)],
    );
  }

  async get(runId: string): Promise<AgentRunRecord | null> {
    const result = await this.#db.query('SELECT record FROM railmind_runs WHERE run_id = $1', [runId]);
    return result.rows[0] ? toRunRecord(result.rows[0]) : null;
  }

  async all(): Promise<readonly AgentRunRecord[]> {
    const result = await this.#db.query('SELECT record FROM railmind_runs ORDER BY started_at ASC, run_id ASC');
    return result.rows.map(toRunRecord);
  }
}

function jsonColumn<T>(row: SqlRow): T {
  const raw = row.record;
  return (typeof raw === 'string' ? JSON.parse(raw) : raw) as T;
}

/** Review comments and disagreements as mutable projections; every transition is also audited and, for disagreements, ledgered. */
export class PgReviewStore implements ReviewStore {
  readonly #db: SqlClient;

  constructor(db: SqlClient) {
    this.#db = db;
  }

  async saveComment(comment: ReviewComment): Promise<void> {
    await this.#db.query(
      `INSERT INTO railmind_review_comments (comment_id, report_id, contract_id, status, record, updated_at)
       VALUES ($1, $2, $3, $4, $5::jsonb, now())
       ON CONFLICT (comment_id) DO UPDATE SET status = EXCLUDED.status, record = EXCLUDED.record, updated_at = now()`,
      [comment.commentId, comment.reportId, comment.contractId, comment.status, JSON.stringify(comment)],
    );
  }

  async getComment(commentId: string): Promise<ReviewComment | null> {
    const result = await this.#db.query('SELECT record FROM railmind_review_comments WHERE comment_id = $1', [commentId]);
    return result.rows[0] ? jsonColumn<ReviewComment>(result.rows[0]) : null;
  }

  async listComments(reportId: string): Promise<readonly ReviewComment[]> {
    const result = await this.#db.query('SELECT record FROM railmind_review_comments WHERE report_id = $1 ORDER BY comment_id ASC', [reportId]);
    return result.rows.map((row) => jsonColumn<ReviewComment>(row));
  }

  async saveDisagreement(disagreement: Disagreement): Promise<void> {
    await this.#db.query(
      `INSERT INTO railmind_disagreements (disagreement_id, report_id, contract_id, status, record, updated_at)
       VALUES ($1, $2, $3, $4, $5::jsonb, now())
       ON CONFLICT (disagreement_id) DO UPDATE SET status = EXCLUDED.status, record = EXCLUDED.record, updated_at = now()`,
      [disagreement.disagreementId, disagreement.reportId, disagreement.contractId, disagreement.status, JSON.stringify(disagreement)],
    );
  }

  async getDisagreement(disagreementId: string): Promise<Disagreement | null> {
    const result = await this.#db.query('SELECT record FROM railmind_disagreements WHERE disagreement_id = $1', [disagreementId]);
    return result.rows[0] ? jsonColumn<Disagreement>(result.rows[0]) : null;
  }

  async listDisagreements(reportId: string): Promise<readonly Disagreement[]> {
    const result = await this.#db.query('SELECT record FROM railmind_disagreements WHERE report_id = $1 ORDER BY disagreement_id ASC', [reportId]);
    return result.rows.map((row) => jsonColumn<Disagreement>(row));
  }

  async count(): Promise<{ comments: number; disagreements: number }> {
    const comments = await this.#db.query('SELECT count(*)::int AS n FROM railmind_review_comments');
    const disagreements = await this.#db.query('SELECT count(*)::int AS n FROM railmind_disagreements');
    return { comments: Number(comments.rows[0]?.n ?? 0), disagreements: Number(disagreements.rows[0]?.n ?? 0) };
  }
}
