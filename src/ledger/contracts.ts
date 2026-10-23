import type { EvidenceRef } from '../agent-os/contracts.ts';

/**
 * Decision and evidence ledger.
 *
 * Append-only history of what was recommended, reviewed, approved and what
 * happened afterwards. Records are never mutated; a change is a new record
 * that names the record it supersedes. Every record carries the evidence and
 * KPI formula versions it relied on, so an auditor can reconstruct who knew
 * what, when, and why a decision was approved.
 */
export type LedgerKind =
  | 'decision'
  | 'recommendation'
  | 'evidence_snapshot'
  | 'review'
  | 'approval'
  | 'rejection'
  | 'supersession'
  | 'outcome'
  | 'corrective_action'
  | 'report_release'
  | 'disagreement'
  | 'resolution';

export interface LedgerRecordInput {
  kind: LedgerKind;
  subjectType: 'report' | 'run' | 'asset' | 'exception' | 'proposal' | 'disagreement';
  subjectId: string;
  at: string;
  actorId: string;
  actorRole?: string;
  /** Free structured payload (value, assumptions, note, recommendation). Treated as data. */
  payload: Readonly<Record<string, unknown>>;
  evidence: readonly EvidenceRef[];
  /** KPI id to formula version relied upon. */
  kpiVersions: Readonly<Record<string, string>>;
  /** Evidence version fingerprint when known. */
  evidenceVersion?: string;
  /** Ledger id this record supersedes. */
  supersedes?: string;
  /** Ledger id this record follows (decision after recommendation, outcome after decision). */
  follows?: string;
  /** Audit sequence of the event that produced this record. */
  auditSequence?: number;
}

export interface LedgerRecord extends LedgerRecordInput {
  ledgerId: string;
  sequence: number;
}

export interface LedgerTrace {
  record: LedgerRecord;
  /** Records this one follows or supersedes, oldest first. */
  lineage: readonly LedgerRecord[];
  /** Records that follow or supersede this one. */
  successors: readonly LedgerRecord[];
  /** Set when a later record supersedes this one. */
  supersededBy: string | null;
  /** Evidence references with their source system, so the chain ends at source records. */
  sources: readonly EvidenceRef[];
}

export interface DecisionLedger {
  append(input: LedgerRecordInput): Promise<LedgerRecord>;
  get(ledgerId: string): Promise<LedgerRecord | null>;
  bySubject(subjectType: LedgerRecordInput['subjectType'], subjectId: string): Promise<readonly LedgerRecord[]>;
  all(): Promise<readonly LedgerRecord[]>;
  trace(ledgerId: string): Promise<LedgerTrace | null>;
}

export function validateLedgerInput(input: LedgerRecordInput): void {
  if (!input.actorId.trim()) throw new Error('Ledger record requires a named actor.');
  if (!input.subjectId.trim()) throw new Error('Ledger record requires a subject id.');
  if (Number.isNaN(Date.parse(input.at))) throw new Error('Ledger record requires a valid timestamp.');
  if ((input.kind === 'decision' || input.kind === 'recommendation' || input.kind === 'approval') && input.evidence.length === 0) {
    throw new Error(`Ledger ${input.kind} requires evidence; a decision without evidence is not recordable.`);
  }
}

export function buildTrace(record: LedgerRecord, all: readonly LedgerRecord[]): LedgerTrace {
  const byId = new Map(all.map((r) => [r.ledgerId, r]));
  const lineage: LedgerRecord[] = [];
  const seen = new Set<string>([record.ledgerId]);
  let cursor: LedgerRecord | undefined = record;
  while (cursor) {
    const previousId: string | undefined = cursor.supersedes ?? cursor.follows;
    const previous: LedgerRecord | undefined = previousId ? byId.get(previousId) : undefined;
    if (!previous || seen.has(previous.ledgerId)) break;
    seen.add(previous.ledgerId);
    lineage.unshift(previous);
    cursor = previous;
  }
  const successors = all.filter((r) => r.supersedes === record.ledgerId || r.follows === record.ledgerId);
  const supersededBy = all.find((r) => r.supersedes === record.ledgerId)?.ledgerId ?? null;
  const sources = [...lineage, record].flatMap((r) => r.evidence);
  return { record, lineage, successors, supersededBy, sources };
}

export class InMemoryDecisionLedger implements DecisionLedger {
  readonly #records: LedgerRecord[] = [];

  async append(input: LedgerRecordInput): Promise<LedgerRecord> {
    validateLedgerInput(input);
    if (input.supersedes && !this.#records.some((r) => r.ledgerId === input.supersedes)) throw new Error(`Cannot supersede unknown ledger record ${input.supersedes}.`);
    const sequence = this.#records.length + 1;
    const record: LedgerRecord = { ...input, ledgerId: `LED-${String(sequence).padStart(6, '0')}`, sequence };
    this.#records.push(record);
    return record;
  }

  async get(ledgerId: string): Promise<LedgerRecord | null> {
    return this.#records.find((r) => r.ledgerId === ledgerId) ?? null;
  }

  async bySubject(subjectType: LedgerRecordInput['subjectType'], subjectId: string): Promise<readonly LedgerRecord[]> {
    return this.#records.filter((r) => r.subjectType === subjectType && r.subjectId === subjectId);
  }

  async all(): Promise<readonly LedgerRecord[]> {
    return [...this.#records];
  }

  async trace(ledgerId: string): Promise<LedgerTrace | null> {
    const record = await this.get(ledgerId);
    return record ? buildTrace(record, this.#records) : null;
  }
}
