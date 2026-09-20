import test from 'node:test';
import assert from 'node:assert/strict';

import { ControlTowerService } from '../src/app/control-tower-service.ts';
import { composeApplication } from '../src/app/compose.ts';
import { loadConfig } from '../src/config.ts';
import { InMemoryContractReadPort } from '../src/connectors/contract/port.ts';
import type { MaximoReadPort, MaximoWorkOrderRecord } from '../src/connectors/maximo/port.ts';
import { DEMO_ASSETS, DEMO_CONDITION_PROFILES, DEMO_CONTRACT_KPI_SET, DEMO_PM_RECORDS, DEMO_REPORT, DEMO_SCOPE, DEMO_WORK_ORDERS } from '../src/demo.ts';
import { computeGovernedKpis } from '../src/kpi/governed.ts';
import { ProviderModeError, SourceUnavailableError, assertConsistentMode, type DataProviders, type ProvidedRecord } from '../src/providers/contracts.ts';
import { createContractRepositoryProvider, createMaximoReadProvider } from '../src/providers/production.ts';
import { createSyntheticProviders } from '../src/providers/synthetic.ts';
import { assessReadiness } from '../src/readiness/gate.ts';
import { InMemoryReportStore } from '../src/reporting/store.ts';

const dataset = { assets: DEMO_ASSETS, workOrders: DEMO_WORK_ORDERS, preventiveMaintenance: DEMO_PM_RECORDS, conditionProfiles: DEMO_CONDITION_PROFILES, kpiSets: [DEMO_CONTRACT_KPI_SET] };
const synthetic = () => createSyntheticProviders(dataset);
const wo = (over: Partial<MaximoWorkOrderRecord>): ProvidedRecord<MaximoWorkOrderRecord> => ({
  value: { workOrderId: 'WO-X', assetId: 'A', workType: 'CM', status: 'COMP', reportedAt: '2026-08-05T00:00:00Z', downtimeMinutes: 60, ...over },
  provenance: { sourceSystem: 'maximo', sourceEntityType: 'work-order', sourceRecordId: over.workOrderId ?? 'WO-X', observedAt: over.reportedAt ?? '2026-08-05T00:00:00Z', ingestedAt: '2026-09-01T00:00:00Z', qualityState: 'verified' },
});
const approvedSet = (): ProvidedRecord<typeof DEMO_CONTRACT_KPI_SET> => ({ value: { ...DEMO_CONTRACT_KPI_SET, approvalStatus: 'approved', definitionVersion: 'c-v1', definitions: DEMO_CONTRACT_KPI_SET.definitions.map((d) => ({ ...d, formulaVersion: 'c-v1', approvalStatus: 'approved' as const, approvedAt: '2025-12-01T00:00:00Z', approvedBy: 'steering' })) }, provenance: { sourceSystem: 'contract_repository', sourceEntityType: 'kpi-definition-set', sourceRecordId: 'C/v1', observedAt: '2026-08-01T00:00:00Z', ingestedAt: '2026-09-01T00:00:00Z', qualityState: 'verified' } });
const base = { periodStart: '2026-08-01T00:00:00Z', periodEnd: '2026-08-31T23:59:59Z', asOf: '2026-09-01T00:00:00Z', mode: 'production' as const };

test('synthetic providers carry provenance on every record and are labelled synthetic', async () => {
  const providers = synthetic();
  assertConsistentMode(providers);
  const records = await providers.maintenance.listWorkOrders(['ATC-ZC-01'], '2026-08-01T00:00:00Z');
  assert.ok(records.length > 0);
  for (const record of records) {
    assert.equal(record.provenance.sourceSystem, 'maximo');
    assert.equal(record.provenance.sourceRecordId, record.value.workOrderId);
    assert.ok(record.provenance.ingestedAt);
    assert.match(record.provenance.sourceUri ?? '', /^synthetic:\/\//);
  }
  const set = await providers.contract.getKpiSet('DEMO-CONTRACT');
  assert.equal(set?.value.approvalStatus, 'demo_only');
});

test('synthetic and production providers can never be mixed', () => {
  const providers = synthetic();
  const mixed: DataProviders = { ...providers, contract: createContractRepositoryProvider(new InMemoryContractReadPort([DEMO_CONTRACT_KPI_SET])) };
  assert.throws(() => assertConsistentMode(mixed), ProviderModeError);
  assert.throws(() => assertConsistentMode({ ...providers, mode: 'production' }), ProviderModeError);
});

test('production Maximo provider fails closed on 401, 403 and 500 and never returns synthetic data', async () => {
  for (const status of [401, 403, 500]) {
    const port: MaximoReadPort = {
      getAsset: async () => { throw new Error(`Maximo read failed: HTTP ${status}`); },
      listWorkOrders: async () => { throw new Error(`Maximo read failed: HTTP ${status}`); },
      listPreventiveMaintenance: async () => [],
      listMeterReadings: async () => [],
      listInvoices: async () => [],
    };
    const provider = createMaximoReadProvider(port, { now: () => '2026-09-01T00:00:00Z' });
    await assert.rejects(() => provider.listWorkOrders(['A'], '2026-08-01'), (error: unknown) => error instanceof SourceUnavailableError && /HTTP/.test(error.message) && error.sourceSystem === 'maximo');
  }
});

test('production provider stamps snapshot hashes and marks records without timestamps provisional', async () => {
  const port: MaximoReadPort = {
    getAsset: async () => null,
    listWorkOrders: async () => [{ workOrderId: 'W1', assetId: 'A', status: 'COMP', reportedAt: '2026-08-02T00:00:00Z' }, { workOrderId: 'W2', assetId: 'A', status: 'COMP' }],
    listPreventiveMaintenance: async () => [],
    listMeterReadings: async () => [],
    listInvoices: async () => [],
  };
  const provider = createMaximoReadProvider(port, { now: () => '2026-09-01T00:00:00Z' });
  const records = await provider.listWorkOrders(['A'], '2026-08-01');
  assert.equal(records[0]?.provenance.qualityState, 'verified');
  assert.equal(records[1]?.provenance.qualityState, 'provisional');
  assert.match(records[0]?.provenance.snapshotHash ?? '', /^[0-9a-f]{64}$/);
  assert.equal(records[0]?.provenance.ingestedAt, '2026-09-01T00:00:00Z');
});

test('production mode refuses to start without live adapters (no silent synthetic fallback)', async () => {
  await assert.rejects(() => composeApplication(loadConfig({ RAILMIND_MODE: 'production' })), /Synthetic fallback is refused in production/);
});

test('readiness gate: READY for clean approved data', () => {
  const result = assessReadiness({ ...base, kpiSet: approvedSet(), workOrders: [wo({ workOrderId: 'W1' }), wo({ workOrderId: 'W2', reportedAt: '2026-08-20T00:00:00Z' })] });
  assert.equal(result.state, 'READY');
  assert.deepEqual(result.issues, []);
  assert.equal(result.perKpi.availability?.state, 'READY');
});

test('readiness gate blocks on missing or unapproved definitions, duplicates, invalid timestamps, contradictions and rejected records', () => {
  assert.equal(assessReadiness({ ...base, kpiSet: null, workOrders: [wo({})] }).state, 'BLOCKED');
  const unapproved = approvedSet(); unapproved.value = { ...unapproved.value, approvalStatus: 'draft' };
  assert.equal(assessReadiness({ ...base, kpiSet: unapproved, workOrders: [wo({})] }).issues[0]?.code, 'unapproved_kpi_definition');
  const demoInProduction = assessReadiness({ ...base, kpiSet: { ...approvedSet(), value: DEMO_CONTRACT_KPI_SET }, workOrders: [wo({})] });
  assert.equal(demoInProduction.state, 'BLOCKED');
  assert.equal(demoInProduction.issues[0]?.code, 'demo_kpi_definition');
  const demoInDemo = assessReadiness({ ...base, mode: 'synthetic', kpiSet: { ...approvedSet(), value: DEMO_CONTRACT_KPI_SET }, workOrders: [wo({})] });
  assert.equal(demoInDemo.state, 'PROVISIONAL');
  const duplicates = assessReadiness({ ...base, kpiSet: approvedSet(), workOrders: [wo({ workOrderId: 'W1' }), wo({ workOrderId: 'W1' })] });
  assert.ok(duplicates.issues.some((i) => i.code === 'duplicate_source_record'));
  assert.equal(duplicates.state, 'BLOCKED');
  const invalid = assessReadiness({ ...base, kpiSet: approvedSet(), workOrders: [wo({ reportedAt: 'yesterday' })] });
  assert.ok(invalid.issues.some((i) => i.code === 'invalid_timestamp'));
  const contradictory = assessReadiness({ ...base, kpiSet: approvedSet(), workOrders: [wo({ actualStartAt: '2026-08-05T10:00:00Z', completedAt: '2026-08-05T09:00:00Z' })] });
  assert.ok(contradictory.issues.some((i) => i.code === 'contradictory_record'));
  const rejected = assessReadiness({ ...base, kpiSet: approvedSet(), workOrders: [{ ...wo({}), provenance: { ...wo({}).provenance, qualityState: 'rejected' } }] });
  assert.equal(rejected.state, 'PROVISIONAL');
  assert.equal(rejected.issues[0]?.code, 'rejected_source_record');
  assert.equal(assessReadiness({ ...base, kpiSet: approvedSet(), workOrders: [] }).issues[0]?.code, 'no_source_records');
});

test('readiness gate scopes missing downtime to availability, MTTR and MTBF and keeps other KPIs decision-grade', () => {
  const result = assessReadiness({ ...base, kpiSet: approvedSet(), workOrders: [wo({ workOrderId: 'W1', downtimeMinutes: undefined }), wo({ workOrderId: 'W2' })] });
  assert.equal(result.perKpi.availability?.state, 'BLOCKED');
  assert.equal(result.perKpi.mttr?.state, 'BLOCKED');
  assert.equal(result.perKpi.failures?.state, 'READY');
  assert.equal(result.perKpi.backlog?.state, 'READY');
  assert.equal(result.state, 'PROVISIONAL');
});

test('readiness gate flags stale extracts (by ingestion age) as provisional then blocked', () => {
  const warn = assessReadiness({ ...base, asOf: '2026-09-20T00:00:00Z', kpiSet: approvedSet(), workOrders: [wo({})] });
  assert.equal(warn.issues.find((i) => i.code === 'stale_source')?.severity, 'warn');
  assert.equal(warn.state, 'PROVISIONAL');
  const block = assessReadiness({ ...base, asOf: '2026-11-20T00:00:00Z', kpiSet: approvedSet(), workOrders: [wo({})] });
  assert.equal(block.issues.find((i) => i.code === 'stale_source')?.severity, 'block');
  assert.equal(block.state, 'BLOCKED');
});

test('governed KPI path marks BLOCKED observations as not decision-grade and excludes rejected records from the numbers', () => {
  const result = computeGovernedKpis({ ...base, kpiSet: approvedSet(), workOrders: [wo({ workOrderId: 'W1', downtimeMinutes: undefined }), { ...wo({ workOrderId: 'W2', downtimeMinutes: 500 }), provenance: { ...wo({}).provenance, sourceRecordId: 'W2', qualityState: 'rejected' } }] });
  const availability = result.observations.find((o) => o.definition.id === 'availability');
  assert.equal(availability?.decisionGrade, false);
  assert.equal(availability?.readiness?.state, 'BLOCKED');
  const failures = result.observations.find((o) => o.definition.id === 'failures');
  assert.equal(failures?.value, 1, 'rejected record must not be counted');
  assert.equal(failures?.decisionGrade, true);
  assert.equal(failures?.readiness?.state, 'PROVISIONAL', 'an excluded rejected record leaves a visible caveat');
});

test('Control Tower service builds the DTO through the pipeline and reproduces the engine numbers', async () => {
  const service = new ControlTowerService(synthetic(), new InMemoryReportStore(), DEMO_REPORT, () => '2026-09-01T00:00:00Z');
  const dto = await service.build(DEMO_SCOPE);
  assert.equal(dto.provenance.synthetic, true);
  assert.deepEqual(dto.kpis.map((k) => [k.id, k.value, k.status]), [['availability', 98.522, 'breach'], ['failures', 4, 'within_target'], ['mtbf', 183.25, 'within_target'], ['mttr', 2.75, 'breach'], ['backlog', 3, 'within_target'], ['pm_compliance', 50, 'breach']]);
  assert.deepEqual(dto.exceptions.map((x) => [x.kind, x.severity, x.kpiId]), [['kpi', 'critical', 'mttr'], ['kpi', 'high', 'availability'], ['kpi', 'high', 'pm_compliance']]);
  assert.equal(dto.readiness.state, 'PROVISIONAL');
  assert.equal(dto.freshness.records, 8);
  assert.equal(dto.timeline[dto.timeline.length - 1]?.trigger, 'PERIOD-CLOSE');
  assert.equal(dto.timeline[dto.timeline.length - 1]?.kpis.find((k) => k.id === 'mtbf')?.value, 183.25);
  assert.equal(dto.report.status, 'draft');
});

test('Control Tower service turns a BLOCKED KPI into a readiness exception instead of a contractual one', async () => {
  const providers = synthetic();
  const broken: DataProviders = { ...providers, maintenance: { ...providers.maintenance, async listWorkOrders(assetIds, since) { const rows = await providers.maintenance.listWorkOrders(assetIds, since); return rows.map((r) => (r.value.workOrderId === 'WO-1004' ? { ...r, value: { ...r.value, downtimeMinutes: undefined } } : r)); } } };
  const dto = await new ControlTowerService(broken, new InMemoryReportStore(), DEMO_REPORT, () => '2026-09-01T00:00:00Z').build(DEMO_SCOPE);
  assert.equal(dto.kpis.find((k) => k.id === 'mttr')?.decisionGrade, false);
  assert.equal(dto.exceptions[0]?.kind, 'readiness');
  assert.ok(!dto.exceptions.some((x) => x.kpiId === 'mttr'), 'no contractual exception from a blocked KPI');
  assert.ok(dto.exceptions.some((x) => x.kpiId === 'availability') === false || dto.kpis.find((k) => k.id === 'availability')?.decisionGrade === true);
});

test('period-to-date replay recomputes through the pipeline for an earlier as-of', async () => {
  const service = new ControlTowerService(synthetic(), new InMemoryReportStore(), DEMO_REPORT, () => '2026-09-01T00:00:00Z');
  const early = await service.build(DEMO_SCOPE, '2026-08-10T10:00:00Z');
  assert.equal(early.kpis.find((k) => k.id === 'failures')?.value, 2);
  assert.equal(early.freshness.records, 2);
});
