import type { EvidenceRef } from '../agent-os/contracts.ts';
import type { AuditEventInput } from '../audit/log.ts';

/**
 * Review workflow and disagreement layer (Phases 13 and 14).
 *
 * The owner and the contractor review the same governed package. A review
 * comment sheet records questions and answers against a subject (a KPI, an
 * exception, an obligation, the narrative or the package). A disagreement
 * records both parties' positions with their evidence and moves through a
 * small state machine to a named resolution or an escalation. Every
 * transition is pure, returns the audit event that records it, and refuses
 * without mutating when its preconditions fail. An unresolved disagreement
 * blocks approval of the package.
 */
import type { Party } from '../auth/principal.ts';
export type { Party };
export type ReviewSubjectType = 'kpi' | 'exception' | 'obligation' | 'narrative' | 'package';

export interface ReviewSubject {
  type: ReviewSubjectType;
  id: string;
}

export interface ReviewActor {
  principalId: string;
  role: string;
  party: Party;
}

export interface CommentResponse {
  actor: ReviewActor;
  text: string;
  at: string;
}

export type CommentStatus = 'open' | 'responded' | 'closed';

export interface ReviewComment {
  commentId: string;
  reportId: string;
  contractId: string;
  subject: ReviewSubject;
  actor: ReviewActor;
  text: string;
  createdAt: string;
  status: CommentStatus;
  responses: readonly CommentResponse[];
  closedAt?: string;
  closedBy?: ReviewActor;
}

export interface Position {
  actor: ReviewActor;
  text: string;
  evidence: readonly EvidenceRef[];
  at: string;
}

export type DisagreementStatus = 'raised' | 'positions_recorded' | 'resolved' | 'escalated';
export type ResolutionOutcome = 'owner_position_upheld' | 'contractor_position_upheld' | 'agreed_compromise' | 'escalated';

export interface DisagreementResolution {
  outcome: ResolutionOutcome;
  text: string;
  actor: { principalId: string; role: string };
  at: string;
  evidence: readonly EvidenceRef[];
}

export interface DisagreementHistoryEntry {
  at: string;
  action: 'raised' | 'position_recorded' | 'resolved' | 'escalated';
  actorId: string;
  party?: Party;
}

export interface Disagreement {
  disagreementId: string;
  reportId: string;
  contractId: string;
  subject: ReviewSubject;
  summary: string;
  raisedBy: ReviewActor;
  positions: { owner: Position | null; contractor: Position | null };
  status: DisagreementStatus;
  resolution?: DisagreementResolution;
  history: readonly DisagreementHistoryEntry[];
  createdAt: string;
  updatedAt: string;
  /** Ledger id of the record written when the disagreement was raised. */
  ledgerId?: string;
}

export interface ReviewTransitionResult<T> {
  ok: boolean;
  record: T;
  blockers: readonly string[];
  audit: AuditEventInput;
}

export const SUBJECT_TYPES: readonly ReviewSubjectType[] = ['kpi', 'exception', 'obligation', 'narrative', 'package'];
export const RESOLUTION_OUTCOMES: readonly ResolutionOutcome[] = ['owner_position_upheld', 'contractor_position_upheld', 'agreed_compromise', 'escalated'];

export const OPEN_DISAGREEMENT_STATUSES: readonly DisagreementStatus[] = ['raised', 'positions_recorded'];

export function isOpenDisagreement(d: Disagreement): boolean {
  return OPEN_DISAGREEMENT_STATUSES.includes(d.status);
}

function nonEmpty(text: string | undefined): boolean {
  return typeof text === 'string' && text.trim().length > 0;
}

/* ---------- Comment sheet ---------- */

export interface NewComment {
  commentId: string;
  reportId: string;
  contractId: string;
  subject: ReviewSubject;
  actor: ReviewActor;
  text: string;
  at: string;
}

export function createComment(input: NewComment): ReviewTransitionResult<ReviewComment> {
  const blockers: string[] = [];
  if (!nonEmpty(input.text)) blockers.push('A comment requires text.');
  if (!SUBJECT_TYPES.includes(input.subject.type) || !nonEmpty(input.subject.id)) blockers.push('A comment requires a subject type and id.');
  const record: ReviewComment = { commentId: input.commentId, reportId: input.reportId, contractId: input.contractId, subject: input.subject, actor: input.actor, text: input.text.trim(), createdAt: input.at, status: 'open', responses: [] };
  return {
    ok: blockers.length === 0,
    record,
    blockers,
    audit: { action: blockers.length ? 'review.transition_refused' : 'review.comment_created', actorId: input.actor.principalId, actorRole: input.actor.role, subjectType: 'comment', subjectId: input.commentId, at: input.at, toState: blockers.length ? undefined : 'open', reason: blockers.length ? blockers.join(' ') : `${input.actor.party} comment on ${input.subject.type} ${input.subject.id} of ${input.reportId}` },
  };
}

export function respondToComment(comment: ReviewComment, actor: ReviewActor, text: string, at: string): ReviewTransitionResult<ReviewComment> {
  const blockers: string[] = [];
  if (comment.status === 'closed') blockers.push('A closed comment cannot receive responses.');
  if (!nonEmpty(text)) blockers.push('A response requires text.');
  const record: ReviewComment = blockers.length ? comment : { ...comment, status: 'responded', responses: [...comment.responses, { actor, text: text.trim(), at }] };
  return {
    ok: blockers.length === 0,
    record,
    blockers,
    audit: { action: blockers.length ? 'review.transition_refused' : 'review.comment_responded', actorId: actor.principalId, actorRole: actor.role, subjectType: 'comment', subjectId: comment.commentId, at, fromState: comment.status, toState: record.status, reason: blockers.length ? blockers.join(' ') : `${actor.party} response` },
  };
}

export function closeComment(comment: ReviewComment, actor: ReviewActor, at: string): ReviewTransitionResult<ReviewComment> {
  const blockers: string[] = [];
  if (comment.status === 'closed') blockers.push('The comment is already closed.');
  if (comment.status === 'open' && actor.party !== comment.actor.party) blockers.push('An unanswered comment can only be closed by the party that raised it.');
  const record: ReviewComment = blockers.length ? comment : { ...comment, status: 'closed', closedAt: at, closedBy: actor };
  return {
    ok: blockers.length === 0,
    record,
    blockers,
    audit: { action: blockers.length ? 'review.transition_refused' : 'review.comment_closed', actorId: actor.principalId, actorRole: actor.role, subjectType: 'comment', subjectId: comment.commentId, at, fromState: comment.status, toState: record.status, reason: blockers.length ? blockers.join(' ') : undefined },
  };
}

/* ---------- Disagreements ---------- */

export interface NewDisagreement {
  disagreementId: string;
  reportId: string;
  contractId: string;
  subject: ReviewSubject;
  summary: string;
  raisedBy: ReviewActor;
  position: { text: string; evidence: readonly EvidenceRef[] };
  at: string;
}

export function raiseDisagreement(input: NewDisagreement): ReviewTransitionResult<Disagreement> {
  const blockers: string[] = [];
  if (!nonEmpty(input.summary)) blockers.push('A disagreement requires a summary.');
  if (!nonEmpty(input.position.text)) blockers.push('The raising party must state its position.');
  if (!SUBJECT_TYPES.includes(input.subject.type) || !nonEmpty(input.subject.id)) blockers.push('A disagreement requires a subject type and id.');
  const position: Position = { actor: input.raisedBy, text: input.position.text.trim(), evidence: input.position.evidence, at: input.at };
  const record: Disagreement = {
    disagreementId: input.disagreementId,
    reportId: input.reportId,
    contractId: input.contractId,
    subject: input.subject,
    summary: input.summary.trim(),
    raisedBy: input.raisedBy,
    positions: { owner: input.raisedBy.party === 'owner' ? position : null, contractor: input.raisedBy.party === 'contractor' ? position : null },
    status: 'raised',
    history: [{ at: input.at, action: 'raised', actorId: input.raisedBy.principalId, party: input.raisedBy.party }],
    createdAt: input.at,
    updatedAt: input.at,
  };
  return {
    ok: blockers.length === 0,
    record,
    blockers,
    audit: { action: blockers.length ? 'disagreement.transition_refused' : 'disagreement.raised', actorId: input.raisedBy.principalId, actorRole: input.raisedBy.role, subjectType: 'disagreement', subjectId: input.disagreementId, at: input.at, toState: blockers.length ? undefined : 'raised', reason: blockers.length ? blockers.join(' ') : `${input.raisedBy.party} disputes ${input.subject.type} ${input.subject.id} of ${input.reportId}`, evidence: input.position.evidence },
  };
}

export function recordPosition(d: Disagreement, actor: ReviewActor, text: string, evidence: readonly EvidenceRef[], at: string): ReviewTransitionResult<Disagreement> {
  const blockers: string[] = [];
  if (!isOpenDisagreement(d)) blockers.push(`A ${d.status} disagreement cannot take new positions.`);
  if (!nonEmpty(text)) blockers.push('A position requires text.');
  const positions = { ...d.positions, [actor.party]: { actor, text: text.trim(), evidence, at } };
  const both = positions.owner !== null && positions.contractor !== null;
  const record: Disagreement = blockers.length ? d : { ...d, positions, status: both ? 'positions_recorded' : 'raised', history: [...d.history, { at, action: 'position_recorded', actorId: actor.principalId, party: actor.party }], updatedAt: at };
  return {
    ok: blockers.length === 0,
    record,
    blockers,
    audit: { action: blockers.length ? 'disagreement.transition_refused' : 'disagreement.position_recorded', actorId: actor.principalId, actorRole: actor.role, subjectType: 'disagreement', subjectId: d.disagreementId, at, fromState: d.status, toState: record.status, reason: blockers.length ? blockers.join(' ') : `${actor.party} position recorded`, evidence },
  };
}

export function resolveDisagreement(d: Disagreement, resolution: DisagreementResolution): ReviewTransitionResult<Disagreement> {
  const blockers: string[] = [];
  if (d.status === 'resolved' || d.status === 'escalated') blockers.push(`A ${d.status} disagreement cannot be resolved again.`);
  else if (d.status !== 'positions_recorded') blockers.push('Both parties must record their positions before a resolution.');
  if (!RESOLUTION_OUTCOMES.includes(resolution.outcome) || resolution.outcome === 'escalated') blockers.push('Resolution requires an outcome of owner_position_upheld, contractor_position_upheld or agreed_compromise.');
  if (!nonEmpty(resolution.text)) blockers.push('A resolution requires a written reason.');
  if (!nonEmpty(resolution.actor.principalId) || !nonEmpty(resolution.actor.role)) blockers.push('A resolution requires a named decision maker.');
  const record: Disagreement = blockers.length ? d : { ...d, status: 'resolved', resolution: { ...resolution, text: resolution.text.trim() }, history: [...d.history, { at: resolution.at, action: 'resolved', actorId: resolution.actor.principalId }], updatedAt: resolution.at };
  return {
    ok: blockers.length === 0,
    record,
    blockers,
    audit: { action: blockers.length ? 'disagreement.transition_refused' : 'disagreement.resolved', actorId: resolution.actor.principalId, actorRole: resolution.actor.role, subjectType: 'disagreement', subjectId: d.disagreementId, at: resolution.at, fromState: d.status, toState: record.status, reason: blockers.length ? blockers.join(' ') : `${resolution.outcome}: ${resolution.text.trim()}`, evidence: resolution.evidence },
  };
}

export function escalateDisagreement(d: Disagreement, actor: { principalId: string; role: string }, text: string, at: string): ReviewTransitionResult<Disagreement> {
  const blockers: string[] = [];
  if (!isOpenDisagreement(d)) blockers.push(`A ${d.status} disagreement cannot be escalated.`);
  if (!nonEmpty(text)) blockers.push('An escalation requires a written reason.');
  const record: Disagreement = blockers.length ? d : { ...d, status: 'escalated', resolution: { outcome: 'escalated', text: text.trim(), actor, at, evidence: [] }, history: [...d.history, { at, action: 'escalated', actorId: actor.principalId }], updatedAt: at };
  return {
    ok: blockers.length === 0,
    record,
    blockers,
    audit: { action: blockers.length ? 'disagreement.transition_refused' : 'disagreement.escalated', actorId: actor.principalId, actorRole: actor.role, subjectType: 'disagreement', subjectId: d.disagreementId, at, fromState: d.status, toState: record.status, reason: blockers.length ? blockers.join(' ') : text.trim() },
  };
}

/** Approval blockers a package carries because of its review state. */
export function reviewBlockers(disagreements: readonly Disagreement[]): readonly string[] {
  return disagreements.filter(isOpenDisagreement).map((d) => `Disagreement ${d.disagreementId} on ${d.subject.type} ${d.subject.id} is ${d.status}; it must be resolved or escalated before approval.`);
}
