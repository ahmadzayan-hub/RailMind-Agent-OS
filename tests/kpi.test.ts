import test from 'node:test';
import assert from 'node:assert/strict';

import type { EvidenceRef } from '../src/agent-os/contracts.ts';
import { DEMO_WORK_ORDERS } from '../src/demo.ts';
import { DEMO_KPI_DEFINITIONS } from '../src/kpi/demo-definitions.ts';
import { computeKpiObservation, computeKpiValue } from '../src/kpi/engine.ts';

const input = {
  periodStart: '2026-08-01T00:00:00Z',
  periodEnd: '2026-08-31T23:59:59Z',
  plannedServiceMinutes: 31 * 24 * 60,
  workOrders: DEMO_WORK_ORDERS,
};

const evidence: EvidenceRef[] = [{ sourceSystem: 'maximo', entityType: 'work-order', entityId: 'WO-1001', observedAt: '2026-08-03T08:00:00Z' }];

function definition(id: string) {
  const found = DEMO_KPI_DEFINITIONS.find((item) => item.id === id);
  assert.ok(found);
  return found;
}

test('computes failure count deterministically', () => {
  assert.equal(computeKpiValue(definition('failures'), input), 4);
});

test('computes availability from planned minutes and failure downtime only', () => {
  assert.equal(computeKpiValue(definition('availability'), input), 98.522);
});

test('computes MTTR from failure repair minutes', () => {
  assert.equal(computeKpiValue(definition('mttr'), input), 2.75);
});

test('computes backlog from non-closed statuses', () => {
  assert.equal(computeKpiValue(definition('backlog'), input), 3);
});

test('observation carries formula version and evidence', () => {
  const observation = computeKpiObservation(definition('availability'), input, evidence);
  assert.equal(observation.definition.formulaVersion, 'demo-v1');
  assert.equal(observation.evidence.length, 1);
  assert.equal(observation.status, 'breach');
});

test('computes PM compliance from PM orders due in the period, completed by their due date', () => {
  assert.equal(computeKpiValue(definition('pm_compliance'), input), 50);
  assert.equal(computeKpiValue(definition('pm_compliance'), { ...input, workOrders: input.workOrders.filter((wo) => wo.workType !== 'PM') }), 100, 'nothing due means nothing missed');
  const late = input.workOrders.map((wo) => (wo.workOrderId === 'WO-1007' ? { ...wo, completedAt: '2026-08-15T00:00:00Z' } : wo));
  assert.equal(computeKpiValue(definition('pm_compliance'), { ...input, workOrders: late }), 25);
  const cancelled = input.workOrders.map((wo) => (wo.workOrderId === 'WO-1005' ? { ...wo, status: 'CAN' } : wo));
  assert.equal(computeKpiValue(definition('pm_compliance'), { ...input, workOrders: cancelled }), 66.7, 'cancelled PM orders are not due');
});
