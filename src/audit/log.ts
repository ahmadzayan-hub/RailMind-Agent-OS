import type { EvidenceRef } from '../agent-os/contracts.ts';

/**
 * Append-only audit trail for governance events (report transitions, approvals,
 * agent runs, proposals). Each event is chained to the previous one by a
 * SHA-256 hash so an auditor can detect deletion or reordering.
 */
export type AuditAction =
  | 'report.submitted_for_review'
  | 'report.approved'
  | 'report.rejected'
  | 'report.locked'
  | 'report.superseded'
  | 'report.revised'
  | 'ledger.appended'
  | 'report.transition_refused'
  | 'report.reset'
  | 'agent.run_planned'
  | 'agent.run_blocked'
  | 'agent.run_started'
  | 'agent.run_completed'
  | 'agent.run_failed'
  | 'tool.called'
  | 'tool.retried'
  | 'model.invoked'
  | 'model.blocked'
  | 'model.failed'
  | 'agent.sequence_started'
  | 'agent.sequence_completed'
  | 'agent.sequence_stopped'
  | 'auth.denied'
  | 'proposal.created'
  | 'review.comment_created'
  | 'review.comment_responded'
  | 'review.comment_closed'
  | 'review.transition_refused'
  | 'disagreement.raised'
  | 'disagreement.position_recorded'
  | 'disagreement.resolved'
  | 'disagreement.escalated'
  | 'disagreement.transition_refused';

export interface AuditEventInput {
  action: AuditAction;
  actorId: string;
  actorRole?: string;
  subjectType: 'report' | 'task' | 'proposal' | 'run' | 'principal' | 'sequence' | 'comment' | 'disagreement';
  subjectId: string;
  at: string;
  fromState?: string;
  toState?: string;
  reason?: string;
  evidence?: readonly EvidenceRef[];
}

export interface AuditEvent extends AuditEventInput {
  sequence: number;
  evidence: readonly EvidenceRef[];
  previousHash: string;
  hash: string;
}

export interface AuditLog {
  append(input: AuditEventInput): Promise<AuditEvent>;
  bySubject(subjectType: AuditEventInput['subjectType'], subjectId: string): Promise<readonly AuditEvent[]>;
  all(): Promise<readonly AuditEvent[]>;
  /** Recomputes the hash chain and reports the first broken link, if any. */
  verifyChain(): Promise<{ valid: boolean; brokenAtSequence?: number }>;
}

export const GENESIS_HASH = '0'.repeat(64);

/** Timestamps are hashed in normalised ISO form so a database round-trip cannot change the hash. */
function isoOrRaw(value: string): string {
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? value : new Date(parsed).toISOString();
}

function canonical(input: AuditEventInput, sequence: number, previousHash: string): string {
  return JSON.stringify({
    sequence,
    previousHash,
    action: input.action,
    actorId: input.actorId,
    actorRole: input.actorRole ?? null,
    subjectType: input.subjectType,
    subjectId: input.subjectId,
    at: isoOrRaw(input.at),
    fromState: input.fromState ?? null,
    toState: input.toState ?? null,
    reason: input.reason ?? null,
    evidence: (input.evidence ?? []).map((ref) => ({
      sourceSystem: ref.sourceSystem,
      entityType: ref.entityType,
      entityId: ref.entityId,
      observedAt: isoOrRaw(ref.observedAt),
      sourceUri: ref.sourceUri ?? null,
      snapshotHash: ref.snapshotHash ?? null,
    })),
  });
}

export async function sha256Hex(text: string): Promise<string> {
  const bytes = new TextEncoder().encode(text);
  const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

export async function computeAuditHash(
  input: AuditEventInput,
  sequence: number,
  previousHash: string,
): Promise<string> {
  return sha256Hex(canonical(input, sequence, previousHash));
}

function validateInput(input: AuditEventInput): void {
  if (input.actorId.trim().length === 0) throw new Error('Audit event requires a named actor.');
  if (input.subjectId.trim().length === 0) throw new Error('Audit event requires a subject id.');
  if (Number.isNaN(Date.parse(input.at))) throw new Error('Audit event requires a valid timestamp.');
}

/** Zero-infrastructure P0 adapter. Replace with PostgreSQL through the same interface. */
export class InMemoryAuditLog implements AuditLog {
  readonly #events: AuditEvent[] = [];

  async append(input: AuditEventInput): Promise<AuditEvent> {
    validateInput(input);
    const previous = this.#events[this.#events.length - 1];
    const sequence = previous ? previous.sequence + 1 : 1;
    const previousHash = previous ? previous.hash : GENESIS_HASH;
    const hash = await computeAuditHash(input, sequence, previousHash);
    const event: AuditEvent = { ...input, evidence: input.evidence ?? [], sequence, previousHash, hash };
    this.#events.push(event);
    return event;
  }

  async bySubject(subjectType: AuditEventInput['subjectType'], subjectId: string): Promise<readonly AuditEvent[]> {
    return this.#events.filter((event) => event.subjectType === subjectType && event.subjectId === subjectId);
  }

  async all(): Promise<readonly AuditEvent[]> {
    return [...this.#events];
  }

  async verifyChain(): Promise<{ valid: boolean; brokenAtSequence?: number }> {
    let previousHash = GENESIS_HASH;
    for (const event of this.#events) {
      const expected = await computeAuditHash(event, event.sequence, previousHash);
      if (event.previousHash !== previousHash || event.hash !== expected) {
        return { valid: false, brokenAtSequence: event.sequence };
      }
      previousHash = event.hash;
    }
    return { valid: true };
  }
}
