import test from 'node:test';
import assert from 'node:assert/strict';

import { DEMO_OTHER_REPORT, DEMO_QUARTERLY_REPORT, DEMO_REPORT, DEMO_REPORT_REGISTRATIONS } from '../src/demo.ts';
import { createReportRegistry, scopeOf } from '../src/reporting/registry.ts';
import { deterministicExecutiveSummary } from '../src/reporting/generator.ts';
import { toControlTowerViewModel } from '../src/control-tower/view-model.ts';

test('builds an exception-based report', () => {
  assert.equal(DEMO_REPORT.kpis.length, 6);
  assert.ok(DEMO_REPORT.exceptions.length > 0);
  assert.equal(DEMO_REPORT.status, 'draft');
});

test('repeated breach can escalate to critical', () => {
  assert.ok(DEMO_REPORT.exceptions.some((item) => item.severity === 'critical'));
});

test('control tower counts attention items', () => {
  const view = toControlTowerViewModel(DEMO_REPORT);
  assert.equal(view.kpiCount, 6);
  assert.equal(view.attentionRequired, DEMO_REPORT.exceptions.length);
});

test('deterministic summary explicitly identifies non-LLM output', () => {
  assert.match(deterministicExecutiveSummary(DEMO_REPORT), /no LLM-generated facts/i);
});

test('report registry addresses packages by id and contract, refuses duplicates and keeps the first as default', () => {
  const registry = createReportRegistry(DEMO_REPORT_REGISTRATIONS);
  assert.equal(registry.default.seed.reportId, DEMO_REPORT.reportId);
  assert.deepEqual(registry.list().map((r) => r.seed.reportId), ['DEMO-2026-08', 'DEMO-2026-Q3', 'OTHER-2026-08']);
  assert.deepEqual(registry.contractIds(), ['DEMO-CONTRACT', 'OTHER-CONTRACT']);
  assert.deepEqual(registry.forContract('DEMO-CONTRACT').map((r) => r.seed.cadence), ['monthly', 'quarterly']);
  assert.equal(registry.get('OTHER-2026-08')?.seed.contractId, 'OTHER-CONTRACT');
  assert.equal(registry.get('NOPE'), null);
  assert.deepEqual(scopeOf(registry.get('DEMO-2026-Q3')!), { contractId: 'DEMO-CONTRACT', periodStart: '2026-07-01T00:00:00Z', periodEnd: '2026-09-30T23:59:59Z', priorBreachesByKpi: { mttr: 2 } });
  assert.deepEqual(scopeOf({ seed: DEMO_OTHER_REPORT }), { contractId: 'OTHER-CONTRACT', periodStart: DEMO_OTHER_REPORT.periodStart, periodEnd: DEMO_OTHER_REPORT.periodEnd });
  assert.throws(() => createReportRegistry([]), /at least one/);
  assert.throws(() => createReportRegistry([{ seed: DEMO_REPORT }, { seed: DEMO_REPORT }]), /registered twice/);
  assert.throws(() => createReportRegistry([{ seed: { ...DEMO_REPORT, periodEnd: DEMO_REPORT.periodStart } }]), /invalid period/);
});

test('quarterly and second-contract demo packages are computed by the same engine on their own scope', () => {
  assert.equal(DEMO_QUARTERLY_REPORT.kpis.length, 6);
  assert.equal(DEMO_QUARTERLY_REPORT.contractId, 'DEMO-CONTRACT');
  const monthlyMtbf = DEMO_REPORT.kpis.find((k) => k.definition.id === 'mtbf')!.value;
  const quarterlyMtbf = DEMO_QUARTERLY_REPORT.kpis.find((k) => k.definition.id === 'mtbf')!.value;
  assert.ok(quarterlyMtbf > monthlyMtbf, 'same failures over a longer planned service raise MTBF');
  assert.equal(DEMO_OTHER_REPORT.contractId, 'OTHER-CONTRACT');
  assert.ok(DEMO_OTHER_REPORT.kpis.every((k) => k.evidence.every((e) => e.entityId.startsWith('WO-20'))), 'the second contract cites only its own work orders');
});
