import type { ControlTowerDto, DtoEvidence, DtoException, DtoWorkOrder } from '../app/control-tower-service.ts';
import type { GisLayer, GisSchematicLine, GisSchematicNode, GisStatus } from './contracts.ts';

/**
 * GIS view: the schematic joined with governed facts. The service derives a
 * status per node from the Control Tower DTO with fixed rules and attaches
 * the evidence those facts came from. The browser renders this view; it
 * never derives a status itself. Train markers are simulated and always
 * carry the `simulated` flag and a stable status.
 */
export interface GisFact {
  key: 'assetStatus' | 'openWorkOrders' | 'failureWorkOrders' | 'downtimeMinutes' | 'workType' | 'workOrderStatus' | 'severity' | 'kpi' | 'kpiStatus' | 'linkedAssets' | 'simulated';
  value: string | number;
}

export interface GisViewNode extends GisSchematicNode {
  status: GisStatus;
  facts: readonly GisFact[];
  evidence: readonly DtoEvidence[];
  /** Exception id the node points at, when the DTO carries one for its KPI or asset. */
  exceptionId: string | null;
}

export interface GisViewDto {
  generatedAt: string;
  provenance: {
    schematic: GisSchematicLine['provenance'];
    /** The DTO the facts were joined from. */
    facts: ControlTowerDto['provenance'];
    reportId: string;
    contractId: string;
    positionsAreCoordinates: false;
  };
  line: { lineId: string; label: GisSchematicLine['label']; path: string; viewBox: GisSchematicLine['viewBox'] };
  nodes: readonly GisViewNode[];
  counts: { assets: number; criticalExceptions: number; openWorkOrders: number; byStatus: Record<GisStatus, number> };
  layers: readonly GisLayer[];
}

const RANK: Record<GisStatus, number> = { stable: 0, watch: 1, critical: 2 };
const worst = (statuses: readonly GisStatus[]): GisStatus => statuses.reduce<GisStatus>((acc, s) => (RANK[s] > RANK[acc] ? s : acc), 'stable');
const isOpen = (wo: DtoWorkOrder): boolean => wo.completedAt === null && !['COMP', 'CLOSE', 'CAN'].includes(wo.status);
const isFailure = (wo: DtoWorkOrder): boolean => wo.workType === 'CM' || wo.failureCode !== null;

function severityStatus(severity: DtoException['severity'] | undefined): GisStatus {
  return severity === 'critical' ? 'critical' : severity === 'high' || severity === 'watch' ? 'watch' : 'stable';
}

/** Asset status: an open failure order is critical; any open order or any period failure is watch. */
function assetStatus(assetId: string, tower: ControlTowerDto): { status: GisStatus; facts: GisFact[]; evidence: DtoEvidence[] } {
  const asset = tower.assets.find((a) => a.assetId === assetId);
  const orders = tower.workOrders.filter((wo) => wo.assetId === assetId);
  const openFailure = orders.some((wo) => isOpen(wo) && isFailure(wo));
  const status: GisStatus = !asset ? 'stable' : openFailure ? 'critical' : asset.openWorkOrders > 0 || asset.failureWorkOrders > 0 ? 'watch' : 'stable';
  const facts: GisFact[] = asset
    ? [{ key: 'assetStatus', value: status }, { key: 'openWorkOrders', value: asset.openWorkOrders }, { key: 'failureWorkOrders', value: asset.failureWorkOrders }, { key: 'downtimeMinutes', value: asset.downtimeMinutes }]
    : [{ key: 'assetStatus', value: status }];
  const evidence: DtoEvidence[] = orders.map((wo) => ({ sourceSystem: 'maximo', entityType: 'work-order', entityId: wo.workOrderId, observedAt: wo.reportedAt ?? tower.asOf }));
  return { status, facts, evidence };
}

function joinNode(node: GisSchematicNode, tower: ControlTowerDto): GisViewNode {
  if (node.kind === 'train') {
    return { ...node, status: 'stable', facts: [{ key: 'simulated', value: 'true' }], evidence: [], exceptionId: null };
  }
  if (node.kind === 'asset') {
    const assetId = node.refs?.assetIds?.[0] ?? '';
    const joined = assetStatus(assetId, tower);
    const exception = tower.exceptions.find((x) => x.evidence.some((e) => joined.evidence.some((j) => j.entityId === e.entityId)) && x.severity === 'critical') ?? null;
    return { ...node, ...joined, exceptionId: exception?.id ?? null };
  }
  if (node.kind === 'work-order') {
    const wo = tower.workOrders.find((w) => w.workOrderId === node.refs?.workOrderId);
    if (!wo) return { ...node, status: 'stable', facts: [{ key: 'workOrderStatus', value: 'not in period' }], evidence: [], exceptionId: null };
    const status: GisStatus = isOpen(wo) && isFailure(wo) ? 'critical' : isOpen(wo) ? 'watch' : 'stable';
    return {
      ...node,
      status,
      facts: [{ key: 'workOrderStatus', value: wo.status }, { key: 'workType', value: wo.workType ?? 'n/a' }, { key: 'downtimeMinutes', value: wo.downtimeMinutes }],
      evidence: [{ sourceSystem: 'maximo', entityType: 'work-order', entityId: wo.workOrderId, observedAt: wo.reportedAt ?? tower.asOf }],
      exceptionId: null,
    };
  }
  if (node.kind === 'exception') {
    const kpiId = node.refs?.kpiId ?? '';
    const kpi = tower.kpis.find((k) => k.id === kpiId);
    const exception = tower.exceptions.filter((x) => x.kpiId === kpiId).sort((a, b) => RANK[severityStatus(b.severity)] - RANK[severityStatus(a.severity)])[0];
    return {
      ...node,
      status: severityStatus(exception?.severity),
      facts: [{ key: 'kpi', value: kpi ? `${kpi.id} ${kpi.formulaVersion}` : kpiId }, { key: 'kpiStatus', value: kpi?.status ?? 'n/a' }, { key: 'severity', value: exception?.severity ?? 'none' }],
      evidence: exception?.evidence ?? kpi?.evidence ?? [],
      exceptionId: exception?.id ?? null,
    };
  }
  const linked = (node.refs?.assetIds ?? []).map((assetId) => assetStatus(assetId, tower));
  return {
    ...node,
    status: worst(linked.map((l) => l.status)),
    facts: [{ key: 'linkedAssets', value: linked.length }, { key: 'openWorkOrders', value: linked.reduce((sum, l) => sum + Number(l.facts.find((f) => f.key === 'openWorkOrders')?.value ?? 0), 0) }],
    evidence: linked.flatMap((l) => l.evidence),
    exceptionId: null,
  };
}

export function buildGisView(schematic: GisSchematicLine, tower: ControlTowerDto, generatedAt: string = tower.generatedAt): GisViewDto {
  const nodes = schematic.nodes.map((node) => joinNode(node, tower));
  const byStatus: Record<GisStatus, number> = { stable: 0, watch: 0, critical: 0 };
  for (const node of nodes) byStatus[node.status] += 1;
  return {
    generatedAt,
    provenance: { schematic: schematic.provenance, facts: tower.provenance, reportId: tower.report.reportId, contractId: tower.report.contractId, positionsAreCoordinates: false },
    line: { lineId: schematic.lineId, label: schematic.label, path: schematic.path, viewBox: schematic.viewBox },
    nodes,
    counts: {
      assets: tower.assets.length,
      criticalExceptions: tower.exceptions.filter((x) => x.severity === 'critical').length,
      openWorkOrders: tower.workOrders.filter(isOpen).length,
      byStatus,
    },
    layers: ['stations', 'assets', 'faults', 'workorders', 'trains'],
  };
}
