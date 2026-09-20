import test from 'node:test';
import assert from 'node:assert/strict';

import { DEMO_REPORT } from '../src/demo.ts';
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
