import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildDemoPack, renderDemoPackModule } from '../src/web/demo-pack.ts';
import { buildGisPack, renderGisPackModule } from '../src/web/gis-pack.ts';

const target = new URL('../web/data/demo-pack.js', import.meta.url);
const committed = readFileSync(target, 'utf8');
const pack = await buildDemoPack();
assert.equal(committed, renderDemoPackModule(pack), 'web/data/demo-pack.js has drifted from the Control Tower service. Run `npm run build:web-data` and commit the result.');

assert.equal(pack.provenance.synthetic, true);
assert.equal(pack.provenance.mode, 'synthetic');
assert.equal(pack.kpis.length, 6);
assert.ok(pack.timeline.length >= 2, 'Timeline must contain at least one event and the period close.');
const close = pack.timeline[pack.timeline.length - 1];
for (const kpi of pack.kpis) {
  const replayed = close.kpis.find((item) => item.id === kpi.id);
  assert.ok(replayed, `Timeline close is missing KPI ${kpi.id}.`);
  assert.equal(replayed.value, kpi.value, `Timeline close value for ${kpi.id} must equal the report value.`);
  assert.equal(replayed.status, kpi.status, `Timeline close status for ${kpi.id} must equal the report status.`);
  assert.ok(['READY', 'PROVISIONAL', 'BLOCKED'].includes(kpi.readiness.state), `KPI ${kpi.id} must carry readiness.`);
}
for (const exception of pack.exceptions) {
  assert.ok(exception.kind === 'readiness' || pack.kpis.some((kpi) => kpi.id === exception.kpiId), `Exception ${exception.id} must map to a KPI.`);
  assert.ok(exception.evidence.length > 0, `Exception ${exception.id} must carry evidence.`);
}
const gisTarget = new URL('../web/data/gis-pack.js', import.meta.url);
const gis = await buildGisPack();
assert.equal(readFileSync(gisTarget, 'utf8'), renderGisPackModule(gis), 'web/data/gis-pack.js has drifted from the GIS service. Run `npm run build:web-data` and commit the result.');
assert.equal(gis.provenance.positionsAreCoordinates, false);
assert.equal(gis.provenance.schematic.kind, 'synthetic_schematic');
assert.equal(gis.provenance.reportId, pack.report.reportId);
for (const node of gis.nodes) {
  assert.ok(['stable', 'watch', 'critical'].includes(node.status), `GIS node ${node.nodeId} must carry a status.`);
  if (node.kind === 'asset') assert.ok(pack.assets.some((a) => a.assetId === node.refs.assetIds[0]), `GIS asset node ${node.nodeId} must point at a pack asset.`);
  if (node.kind === 'work-order') assert.ok(pack.workOrders.some((w) => w.workOrderId === node.refs.workOrderId), `GIS work-order node ${node.nodeId} must point at a pack work order.`);
  if (node.kind === 'train') assert.equal(node.simulated, true, 'train markers are simulated');
}
console.log('PASS: web data packs match the Control Tower and GIS services.');
