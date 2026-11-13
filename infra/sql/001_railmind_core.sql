-- RailMind-owned persistence. Source systems (Maximo, finance, contracts) are never written.
-- Applied automatically by ensureSchema() or manually with psql.

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

-- Audit rows are immutable at database level.
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

-- Decision and evidence ledger: append-only, immutable by trigger.
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

-- Governed agent run records: immutable by trigger.
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

-- Review comment sheet and disagreements: mutable projections; transitions are audited and ledgered.
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

-- Private knowledge documents: classification per document, gated at read time.
CREATE TABLE IF NOT EXISTS railmind_knowledge_documents (
  document_id    TEXT PRIMARY KEY,
  classification TEXT NOT NULL,
  contract_ids   TEXT[] NOT NULL DEFAULT '{}',
  tags           TEXT[] NOT NULL DEFAULT '{}',
  version        TEXT NOT NULL,
  document       JSONB NOT NULL,
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS railmind_knowledge_documents_classification_idx ON railmind_knowledge_documents (classification);
