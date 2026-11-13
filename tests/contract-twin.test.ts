import test from 'node:test';
import assert from 'node:assert/strict';

import { CONTRACT_REPOSITORY_SCHEMA, ContractRepositoryDocumentError, createDocumentContractReadPort, parseContractRepositoryTwins } from '../src/connectors/contract/repository.ts';
import { validateTwin, type ContractTwin } from '../src/contract-twin/contracts.ts';
import { evaluateContractTwin } from '../src/contract-twin/service.ts';
import { DEMO_CONTRACT_TWIN } from '../src/demo.ts';
import { DEMO_KPI_DEFINITIONS } from '../src/kpi/demo-definitions.ts';
import { buildDemoPack } from '../src/web/demo-pack.ts';
import { buildContractTwinPack } from '../src/web/contract-twin-pack.ts';

test('twin validation refuses missing clauses, unbound KPI obligations, bad terms and duplicates', () => {
  assert.deepEqual(validateTwin(DEMO_CONTRACT_TWIN), []);
  const twin = (patch: Partial<ContractTwin>): ContractTwin => ({ ...DEMO_CONTRACT_TWIN, ...patch });
  const first = DEMO_CONTRACT_TWIN.obligations[0]!;
  assert.ok(validateTwin(twin({ obligations: [{ ...first, clauseRef: '' }] })).some((p) => /clauseRef/.test(p)));
  assert.ok(validateTwin(twin({ obligations: [{ ...first, kpiIds: [] }] })).some((p) => /at least one kpiId/.test(p)));
  assert.ok(validateTwin(twin({ obligations: [first, first] })).some((p) => /duplicated/.test(p)));
  assert.ok(validateTwin(twin({ term: { start: '2028-01-01T00:00:00Z', end: '2026-01-01T00:00:00Z' } })).some((p) => /term/.test(p)));
  assert.ok(validateTwin(twin({ reportingDuties: [{ ...DEMO_CONTRACT_TWIN.reportingDuties[0]!, dueDaysAfterPeriodEnd: -1 }] })).some((p) => /dueDaysAfterPeriodEnd/.test(p)));
  assert.ok(validateTwin(twin({ evidence: { ...DEMO_CONTRACT_TWIN.evidence, sourceSystem: 'manual' } })).some((p) => /contract repository/.test(p)));
});

test('twin evaluation judges KPI obligations on decision-grade facts only and leaves the rest unjudged', async () => {
  const tower = await buildDemoPack();
  const view = evaluateContractTwin(DEMO_CONTRACT_TWIN, tower, '2026-09-05T00:00:00Z');
  const byId = (id: string) => view.obligations.find((o) => o.obligationId === id)!;
  assert.equal(view.contractual, false, 'a demo twin is never contractual');
  assert.equal(view.period.reportId, tower.report.reportId);
  const mttr = tower.kpis.find((k) => k.id === 'mttr')!;
  assert.equal(mttr.status, 'breach');
  assert.equal(byId('OBL-RELIAB').status, 'breached');
  assert.match(byId('OBL-RELIAB').reason, /Breach on mttr/);
  assert.deepEqual(byId('OBL-RELIAB').kpis.map((k) => k.kpiId), ['mtbf', 'mttr']);
  assert.ok(byId('OBL-RELIAB').evidence.length > 0);
  assert.equal(byId('OBL-BACKLOG').status, 'met');
  assert.equal(byId('OBL-EVIDENCE').status, 'not_evaluated');
  assert.equal(byId('OBL-FUTURE').status, 'not_effective');
  assert.equal(view.counts.breached, 3);
  assert.equal(view.counts.met, 1);
  // A KPI that is not decision-grade never produces a contractual finding, even when its value breaches.
  const blocked = { ...tower, kpis: tower.kpis.map((k) => (k.id === 'mttr' ? { ...k, decisionGrade: false, readiness: { state: 'BLOCKED' as const, reasons: ['missing timestamps'] } } : k)) };
  const gated = evaluateContractTwin(DEMO_CONTRACT_TWIN, blocked, '2026-09-05T00:00:00Z');
  assert.equal(gated.obligations.find((o) => o.obligationId === 'OBL-RELIAB')?.status, 'not_decision_grade');
  // An obligation binding an unknown KPI is unavailable rather than met.
  const unknown = evaluateContractTwin({ ...DEMO_CONTRACT_TWIN, obligations: [{ ...DEMO_CONTRACT_TWIN.obligations[0]!, kpiIds: ['punctuality'] }] }, tower);
  assert.equal(unknown.obligations[0]?.status, 'unavailable');
});

test('reporting duties follow the package status and the due rule', async () => {
  const tower = await buildDemoPack();
  const before = evaluateContractTwin(DEMO_CONTRACT_TWIN, tower, '2026-09-05T00:00:00Z');
  const monthly = before.reportingDuties.find((d) => d.dutyId === 'DUTY-MONTHLY')!;
  assert.equal(monthly.status, 'due');
  assert.equal(monthly.dueAt, '2026-09-10T23:59:59.000Z');
  assert.equal(monthly.reportId, tower.report.reportId);
  const after = evaluateContractTwin(DEMO_CONTRACT_TWIN, tower, '2026-09-12T00:00:00Z');
  assert.equal(after.reportingDuties.find((d) => d.dutyId === 'DUTY-MONTHLY')?.status, 'overdue');
  assert.equal(after.counts.dutiesOverdue, 1);
  const approved = evaluateContractTwin(DEMO_CONTRACT_TWIN, { ...tower, report: { ...tower.report, status: 'approved' } }, '2026-09-12T00:00:00Z');
  assert.equal(approved.reportingDuties.find((d) => d.dutyId === 'DUTY-MONTHLY')?.status, 'met');
  const quarterly = before.reportingDuties.find((d) => d.dutyId === 'DUTY-QUARTERLY')!;
  assert.equal(quarterly.reportId, null, 'a quarterly duty is not judged against a monthly package');
  assert.equal(quarterly.dueAt, null);
});

test('contract repository documents may publish twins; invalid or duplicate twins are refused', () => {
  const set = { contractId: 'C-17', definitionVersion: 'c17-v2', approvalStatus: 'approved', plannedServiceMinutesPerDay: 1440, assetIds: ['A-1'], definitions: DEMO_KPI_DEFINITIONS.map((d) => ({ ...d, formulaVersion: 'c17-v2', authority: { contractId: 'C-17', clauseRef: `Schedule 4 §${d.id}` }, owner: 'contract.manager', reviewer: 'reliability.lead', approvalStatus: 'approved', approvedAt: '2025-12-01T00:00:00Z', approvedBy: 'a.zaian' })), source: { observedAt: '2026-07-01T00:00:00Z' } };
  const { evidence: _evidence, ...twinBody } = DEMO_CONTRACT_TWIN;
  const twinDoc = { ...twinBody, contractId: 'C-17', approvalStatus: 'approved', source: { uri: 'repo://contracts/C-17/twin/v3.json', observedAt: '2026-07-01T00:00:00Z' } };
  const port = createDocumentContractReadPort({ schema: CONTRACT_REPOSITORY_SCHEMA, sets: [set], twins: [twinDoc] });
  assert.equal(port.twins.length, 1);
  assert.equal(port.twins[0]?.evidence.entityId, 'C-17/demo-twin-v1');
  assert.equal(port.twins[0]?.evidence.sourceUri, 'repo://contracts/C-17/twin/v3.json');
  assert.deepEqual(parseContractRepositoryTwins({ schema: CONTRACT_REPOSITORY_SCHEMA, sets: [set] }), []);
  assert.throws(() => parseContractRepositoryTwins({ twins: 'x' }), ContractRepositoryDocumentError);
  assert.throws(() => parseContractRepositoryTwins({ twins: [{ ...twinDoc, source: {} }] }), /source.observedAt/);
  assert.throws(() => parseContractRepositoryTwins({ twins: [{ ...twinDoc, obligations: [{ ...twinDoc.obligations[0], clauseRef: '' }] }] }), /clauseRef is required/);
  assert.throws(() => parseContractRepositoryTwins({ twins: [twinDoc, twinDoc] }), /Duplicate twin/);
});

test('the generated twin pack is the evaluation of the demo pack', async () => {
  const pack = await buildContractTwinPack();
  assert.equal(pack.approvalStatus, 'demo_only');
  assert.equal(pack.obligations.length, DEMO_CONTRACT_TWIN.obligations.length);
});
