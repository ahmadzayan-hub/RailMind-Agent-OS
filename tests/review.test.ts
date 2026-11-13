import test from 'node:test';
import assert from 'node:assert/strict';

import { closeComment, createComment, escalateDisagreement, raiseDisagreement, recordPosition, resolveDisagreement, respondToComment, reviewBlockers, type Disagreement, type ReviewActor } from '../src/review/contracts.ts';
import { InMemoryReviewStore } from '../src/review/store.ts';

const owner: ReviewActor = { principalId: 'rmd.reviewer', role: 'contract_manager', party: 'owner' };
const contractor: ReviewActor = { principalId: 'ctr.engineer', role: 'maintenance_engineer', party: 'contractor' };
const approver = { principalId: 'rmd.approver', role: 'approver' };
const evidence = [{ sourceSystem: 'maximo' as const, entityType: 'work-order', entityId: 'WO-1004', observedAt: '2026-08-25T06:00:00Z' }];

function raised(): Disagreement {
  const result = raiseDisagreement({ disagreementId: 'DSG-1', reportId: 'DEMO-2026-08', contractId: 'DEMO-CONTRACT', subject: { type: 'kpi', id: 'mttr' }, summary: 'MTTR excludes an access delay caused by the owner.', raisedBy: contractor, position: { text: 'WO-1004 waited 3 hours for track access.', evidence }, at: '2026-09-02T08:00:00Z' });
  assert.equal(result.ok, true);
  return result.record;
}

test('comment sheet: comments need a subject and text; responses and closure follow the party rules', () => {
  const refused = createComment({ commentId: 'CMT-1', reportId: 'R', contractId: 'C', subject: { type: 'kpi', id: 'mttr' }, actor: owner, text: '  ', at: '2026-09-02T08:00:00Z' });
  assert.equal(refused.ok, false);
  assert.equal(refused.audit.action, 'review.transition_refused');
  const created = createComment({ commentId: 'CMT-1', reportId: 'R', contractId: 'C', subject: { type: 'kpi', id: 'mttr' }, actor: owner, text: 'Please confirm the repair clock start for WO-1003.', at: '2026-09-02T08:00:00Z' });
  assert.equal(created.ok, true);
  assert.equal(created.record.status, 'open');
  assert.equal(created.audit.action, 'review.comment_created');
  const wrongCloser = closeComment(created.record, contractor, '2026-09-02T09:00:00Z');
  assert.equal(wrongCloser.ok, false, 'the other party cannot close an unanswered comment');
  const responded = respondToComment(created.record, contractor, 'Clock starts at the Maximo reported time.', '2026-09-02T09:30:00Z');
  assert.equal(responded.ok, true);
  assert.equal(responded.record.status, 'responded');
  assert.equal(responded.record.responses.length, 1);
  const closed = closeComment(responded.record, contractor, '2026-09-03T08:00:00Z');
  assert.equal(closed.ok, true, 'either party may close an answered comment');
  assert.equal(closed.record.closedBy?.principalId, 'ctr.engineer');
  assert.equal(respondToComment(closed.record, owner, 'late', '2026-09-04T08:00:00Z').ok, false);
  assert.equal(closeComment(closed.record, owner, '2026-09-04T08:00:00Z').ok, false);
});

test('disagreement: both positions must be recorded before a named resolution; refused transitions never mutate', () => {
  const d = raised();
  assert.equal(d.status, 'raised');
  assert.equal(d.positions.contractor?.text, 'WO-1004 waited 3 hours for track access.');
  assert.equal(d.positions.owner, null);
  assert.deepEqual(reviewBlockers([d]).length, 1);
  const early = resolveDisagreement(d, { outcome: 'contractor_position_upheld', text: 'x', actor: approver, at: '2026-09-02T10:00:00Z', evidence: [] });
  assert.equal(early.ok, false);
  assert.match(early.blockers[0] ?? '', /Both parties must record/);
  assert.equal(early.record, d, 'refusal returns the untouched record');
  const withOwner = recordPosition(d, owner, 'Access was granted within the contractual window; the delay is the contractor’s.', [], '2026-09-02T11:00:00Z');
  assert.equal(withOwner.ok, true);
  assert.equal(withOwner.record.status, 'positions_recorded');
  assert.equal(withOwner.record.history.length, 2);
  const badOutcome = resolveDisagreement(withOwner.record, { outcome: 'escalated', text: 'x', actor: approver, at: '2026-09-03T10:00:00Z', evidence: [] });
  assert.equal(badOutcome.ok, false);
  const unnamed = resolveDisagreement(withOwner.record, { outcome: 'agreed_compromise', text: 'Split the delay.', actor: { principalId: '', role: 'approver' }, at: '2026-09-03T10:00:00Z', evidence: [] });
  assert.equal(unnamed.ok, false);
  const resolved = resolveDisagreement(withOwner.record, { outcome: 'agreed_compromise', text: 'Exclude 90 minutes of access delay; the rest stands.', actor: approver, at: '2026-09-03T10:00:00Z', evidence });
  assert.equal(resolved.ok, true);
  assert.equal(resolved.record.status, 'resolved');
  assert.equal(resolved.audit.action, 'disagreement.resolved');
  assert.deepEqual(reviewBlockers([resolved.record]), []);
  assert.equal(recordPosition(resolved.record, owner, 'late', [], '2026-09-04T00:00:00Z').ok, false);
  assert.equal(resolveDisagreement(resolved.record, { outcome: 'agreed_compromise', text: 'again', actor: approver, at: '2026-09-04T00:00:00Z', evidence: [] }).ok, false);
});

test('disagreement: escalation is allowed while open, recorded with a reason, and terminal', () => {
  const d = raised();
  assert.equal(escalateDisagreement(d, approver, '', '2026-09-02T12:00:00Z').ok, false);
  const escalated = escalateDisagreement(d, approver, 'Referred to the contract steering committee.', '2026-09-02T12:00:00Z');
  assert.equal(escalated.ok, true);
  assert.equal(escalated.record.status, 'escalated');
  assert.equal(escalated.record.resolution?.outcome, 'escalated');
  assert.deepEqual(reviewBlockers([escalated.record]), [], 'an escalated disagreement no longer holds the package');
  assert.equal(escalateDisagreement(escalated.record, approver, 'again', '2026-09-03T00:00:00Z').ok, false);
});

test('in-memory review store lists by report and counts for id minting', async () => {
  const store = new InMemoryReviewStore();
  await store.saveDisagreement(raised());
  await store.saveComment(createComment({ commentId: 'CMT-1', reportId: 'DEMO-2026-08', contractId: 'DEMO-CONTRACT', subject: { type: 'package', id: 'DEMO-2026-08' }, actor: owner, text: 'ok', at: '2026-09-02T08:00:00Z' }).record);
  assert.equal((await store.listDisagreements('DEMO-2026-08')).length, 1);
  assert.equal((await store.listDisagreements('OTHER')).length, 0);
  assert.equal((await store.getComment('CMT-1'))?.subject.type, 'package');
  assert.deepEqual(await store.count(), { comments: 1, disagreements: 1 });
});
