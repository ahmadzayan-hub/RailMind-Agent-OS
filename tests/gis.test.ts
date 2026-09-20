import test from 'node:test';
import assert from 'node:assert/strict';

import { InMemoryGisReadPort, validateSchematic, type GisSchematicLine } from '../src/gis/contracts.ts';
import { DEMO_SCHEMATIC } from '../src/gis/demo-schematic.ts';
import { buildGisView } from '../src/gis/service.ts';
import { buildDemoPack } from '../src/web/demo-pack.ts';
import { buildGisPack } from '../src/web/gis-pack.ts';

test('the demo schematic validates, is synthetic and never claims coordinates', async () => {
  const port = new InMemoryGisReadPort([DEMO_SCHEMATIC]);
  assert.equal((await port.listLines()).length, 1);
  assert.equal((await port.getLine('DEMO-RED'))?.provenance.kind, 'synthetic_schematic');
  assert.equal(await port.getLine('NOPE'), null);
  assert.throws(() => new InMemoryGisReadPort([DEMO_SCHEMATIC, DEMO_SCHEMATIC]), /registered twice/);
  const bad = (patch: Partial<GisSchematicLine['nodes'][number]>): GisSchematicLine => ({ ...DEMO_SCHEMATIC, nodes: [{ ...DEMO_SCHEMATIC.nodes[0]!, ...patch }] });
  assert.throws(() => validateSchematic(bad({ position: { x: 120, y: 10 } })), /outside the canvas/);
  assert.throws(() => validateSchematic(bad({ kind: 'work-order', refs: {} })), /without a workOrderId/);
  assert.throws(() => validateSchematic(bad({ kind: 'exception', refs: {} })), /without a kpiId/);
  assert.throws(() => validateSchematic(bad({ kind: 'asset', refs: { assetIds: [] } })), /exactly one assetId/);
  assert.throws(() => validateSchematic({ ...DEMO_SCHEMATIC, nodes: [DEMO_SCHEMATIC.nodes[0]!, DEMO_SCHEMATIC.nodes[0]!] }), /twice/);
});

test('GIS view joins statuses from Control Tower facts with fixed rules and cites the evidence', async () => {
  const tower = await buildDemoPack();
  const view = buildGisView(DEMO_SCHEMATIC, tower);
  const node = (id: string) => view.nodes.find((n) => n.nodeId === id)!;
  assert.equal(view.provenance.positionsAreCoordinates, false);
  assert.equal(view.provenance.reportId, tower.report.reportId);
  assert.equal(view.counts.assets, tower.assets.length);
  assert.equal(view.counts.criticalExceptions, tower.exceptions.filter((x) => x.severity === 'critical').length);
  assert.equal(view.counts.openWorkOrders, 3);
  // WO-1004 is an open corrective order on TRAM-APS-03: the order, the asset and its station are critical.
  assert.equal(node('wo-1004').status, 'critical');
  assert.equal(node('asset-tram-aps-03').status, 'critical');
  assert.equal(node('st-03').status, 'critical');
  assert.deepEqual(node('wo-1004').evidence.map((e) => e.entityId), ['WO-1004']);
  // Completed failures without an open corrective order are a watch, and the station inherits the worst linked asset.
  assert.equal(node('asset-atc-zc-02').status, 'watch');
  assert.equal(node('st-02').status, 'watch');
  assert.equal(node('st-04').status, 'stable', 'a station with no linked asset is stable');
  // The exception marker follows the KPI exception severity and carries its id.
  const mttr = node('exception-mttr');
  assert.equal(mttr.status, 'critical');
  assert.equal(mttr.exceptionId, tower.exceptions.find((x) => x.kpiId === 'mttr')?.id);
  assert.ok(mttr.evidence.length > 0);
  // Open preventive orders are a watch; trains are simulated and never carry facts from a source.
  assert.equal(node('wo-1005').status, 'watch');
  assert.equal(node('train-r01').simulated, true);
  assert.deepEqual(node('train-r01').facts, [{ key: 'simulated', value: 'true' }]);
  assert.equal(node('train-r01').evidence.length, 0);
  const total = Object.values(view.counts.byStatus).reduce((a, b) => a + b, 0);
  assert.equal(total, view.nodes.length);
});

test('GIS view reacts to changed facts: closing the corrective order downgrades the asset and station', async () => {
  const tower = await buildDemoPack();
  const closed = { ...tower, workOrders: tower.workOrders.map((wo) => (wo.workOrderId === 'WO-1004' ? { ...wo, status: 'COMP', completedAt: '2026-08-25T10:00:00Z' } : wo)), assets: tower.assets.map((a) => (a.assetId === 'TRAM-APS-03' ? { ...a, openWorkOrders: a.openWorkOrders - 1 } : a)) };
  const view = buildGisView(DEMO_SCHEMATIC, closed);
  assert.equal(view.nodes.find((n) => n.nodeId === 'wo-1004')?.status, 'stable');
  assert.equal(view.nodes.find((n) => n.nodeId === 'asset-tram-aps-03')?.status, 'watch');
  assert.equal(view.nodes.find((n) => n.nodeId === 'st-03')?.status, 'watch');
  const missing = buildGisView({ ...DEMO_SCHEMATIC, nodes: [{ nodeId: 'wo-x', kind: 'work-order', layer: 'workorders', code: 'WO-9', label: { ar: 'x', en: 'x' }, position: { x: 1, y: 1 }, refs: { workOrderId: 'WO-9999' } }] }, tower);
  assert.deepEqual(missing.nodes[0]?.facts, [{ key: 'workOrderStatus', value: 'not in period' }]);
});

test('the generated GIS pack is the view of the demo pack', async () => {
  const pack = await buildGisPack();
  assert.equal(pack.provenance.schematic.kind, 'synthetic_schematic');
  assert.equal(pack.nodes.length, DEMO_SCHEMATIC.nodes.length);
});
