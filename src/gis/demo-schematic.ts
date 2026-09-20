import type { GisSchematicLine } from './contracts.ts';

/**
 * DEMO ONLY schematic. Positions are layout units on a presentation canvas
 * and station names are illustrative. Nothing here is a geographic position,
 * a real station, or a live train. The markers point at the synthetic demo
 * assets and work orders so every fact the map shows is joined from the
 * governed Control Tower DTO.
 */
export const DEMO_SCHEMATIC: GisSchematicLine = {
  lineId: 'DEMO-RED',
  label: { ar: 'نموذج الخط الأحمر التوضيحي', en: 'Illustrative Red Line model' },
  viewBox: { width: 1000, height: 580 },
  path: 'M54 444 C 160 402, 188 486, 278 410 S 400 275, 490 342 S 594 465, 700 352 S 843 190, 948 100',
  provenance: {
    kind: 'synthetic_schematic',
    note: 'Synthetic presentation schematic. Positions are canvas percentages, not coordinates. Station names are illustrative. Train markers are simulated movement.',
    observedAt: '2026-08-01T00:00:00Z',
  },
  nodes: [
    { nodeId: 'st-01', kind: 'station', layer: 'stations', code: 'ST-01', label: { ar: 'محطة المركز المالي', en: 'Financial Centre Station' }, position: { x: 74.2, y: 71 }, refs: { assetIds: ['ATC-ZC-01'] } },
    { nodeId: 'st-02', kind: 'station', layer: 'stations', code: 'ST-02', label: { ar: 'محطة منطقة المتحف', en: 'Museum District Station' }, position: { x: 51, y: 59 }, refs: { assetIds: ['ATC-ZC-02'] } },
    { nodeId: 'st-03', kind: 'station', layer: 'stations', code: 'ST-03', label: { ar: 'محطة المارينا', en: 'Marina Station' }, position: { x: 30, y: 61 }, refs: { assetIds: ['TRAM-APS-03'] } },
    { nodeId: 'st-04', kind: 'station', layer: 'stations', code: 'ST-04', label: { ar: 'المحطة الطرفية', en: 'Terminal Station' }, position: { x: 5.2, y: 17 } },
    { nodeId: 'asset-atc-zc-01', kind: 'asset', layer: 'assets', code: 'ATC-ZC-01', label: { ar: 'وحدة تحكم المنطقة 01', en: 'Zone controller 01' }, position: { x: 64, y: 38 }, refs: { assetIds: ['ATC-ZC-01'] } },
    { nodeId: 'asset-atc-zc-02', kind: 'asset', layer: 'assets', code: 'ATC-ZC-02', label: { ar: 'وحدة تحكم المنطقة 02', en: 'Zone controller 02' }, position: { x: 44, y: 44 }, refs: { assetIds: ['ATC-ZC-02'] } },
    { nodeId: 'asset-tram-aps-03', kind: 'asset', layer: 'assets', code: 'TRAM-APS-03', label: { ar: 'قطاع التغذية الأرضية 03', en: 'APS segment 03' }, position: { x: 22, y: 33 }, refs: { assetIds: ['TRAM-APS-03'] } },
    { nodeId: 'exception-mttr', kind: 'exception', layer: 'faults', code: 'MTTR', label: { ar: 'تنبيه زمن الإصلاح', en: 'Repair-time alert' }, position: { x: 34, y: 49 }, refs: { kpiId: 'mttr', assetIds: ['ATC-ZC-02'] } },
    { nodeId: 'wo-1005', kind: 'work-order', layer: 'workorders', code: 'WO-1005', label: { ar: 'أمر عمل WO-1005', en: 'Work order WO-1005' }, position: { x: 56, y: 70 }, refs: { workOrderId: 'WO-1005', assetIds: ['ATC-ZC-01'] } },
    { nodeId: 'wo-1006', kind: 'work-order', layer: 'workorders', code: 'WO-1006', label: { ar: 'أمر عمل WO-1006', en: 'Work order WO-1006' }, position: { x: 16, y: 30 }, refs: { workOrderId: 'WO-1006', assetIds: ['TRAM-APS-03'] } },
    { nodeId: 'wo-1004', kind: 'work-order', layer: 'workorders', code: 'WO-1004', label: { ar: 'أمر عمل WO-1004', en: 'Work order WO-1004' }, position: { x: 27, y: 74 }, refs: { workOrderId: 'WO-1004', assetIds: ['TRAM-APS-03'] } },
    { nodeId: 'train-r01', kind: 'train', layer: 'trains', code: 'R01', label: { ar: 'قطار R01', en: 'Train R01' }, position: { x: 80, y: 60 }, simulated: true },
    { nodeId: 'train-r02', kind: 'train', layer: 'trains', code: 'R02', label: { ar: 'قطار R02', en: 'Train R02' }, position: { x: 50, y: 50 }, simulated: true },
    { nodeId: 'train-r03', kind: 'train', layer: 'trains', code: 'R03', label: { ar: 'قطار R03', en: 'Train R03' }, position: { x: 20, y: 30 }, simulated: true },
  ],
};
