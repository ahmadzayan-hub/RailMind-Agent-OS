/**
 * GIS bounded module (Phase 11).
 *
 * The network schematic is its own domain: it owns positions, lines and the
 * mapping from schematic nodes to asset, work-order and KPI identifiers. It
 * never owns a KPI, an exception or a risk score; those are joined in from
 * the Control Tower DTO by the GIS service. Positions are schematic units on
 * a presentation canvas (percent of width and height). They are not
 * geographic coordinates and the synthetic schematic says so in its
 * provenance.
 */
export type GisNodeKind = 'station' | 'asset' | 'work-order' | 'exception' | 'train';
export type GisLayer = 'stations' | 'assets' | 'faults' | 'workorders' | 'trains';
export type GisStatus = 'stable' | 'watch' | 'critical';

export interface SchematicPosition {
  /** Percent of the canvas width, measured from the left edge. */
  x: number;
  /** Percent of the canvas height, measured from the top edge. */
  y: number;
}

export interface BilingualLabel {
  ar: string;
  en: string;
}

export interface GisSchematicNode {
  nodeId: string;
  kind: GisNodeKind;
  layer: GisLayer;
  /** Short code shown on the marker (station code, asset id, work order id). */
  code: string;
  label: BilingualLabel;
  position: SchematicPosition;
  /** Identifiers this node stands for in the decision domain. Facts are joined by these, never stored here. */
  refs?: {
    assetIds?: readonly string[];
    workOrderId?: string;
    kpiId?: string;
  };
  /** True for presentation-only movement (train markers). Never a live position. */
  simulated?: boolean;
}

export interface GisSchematicLine {
  lineId: string;
  label: BilingualLabel;
  /** SVG path in the schematic viewBox (1000 x 580). */
  path: string;
  viewBox: { width: number; height: number };
  nodes: readonly GisSchematicNode[];
  provenance: {
    kind: 'synthetic_schematic' | 'gis_extract';
    /** Human-readable statement of what the positions are and are not. */
    note: string;
    observedAt: string;
  };
}

/** Read-only access to schematics. A GIS extract adapter would implement this; P0 serves a synthetic schematic. */
export interface GisReadPort {
  listLines(): Promise<readonly GisSchematicLine[]>;
  getLine(lineId: string): Promise<GisSchematicLine | null>;
}

export class InMemoryGisReadPort implements GisReadPort {
  readonly #lines: readonly GisSchematicLine[];

  constructor(lines: readonly GisSchematicLine[]) {
    const ids = new Set<string>();
    for (const line of lines) {
      if (ids.has(line.lineId)) throw new Error(`Schematic line ${line.lineId} is registered twice.`);
      ids.add(line.lineId);
      validateSchematic(line);
    }
    this.#lines = lines;
  }

  async listLines(): Promise<readonly GisSchematicLine[]> {
    return this.#lines;
  }

  async getLine(lineId: string): Promise<GisSchematicLine | null> {
    return this.#lines.find((line) => line.lineId === lineId) ?? null;
  }
}

/** Refuses a schematic whose nodes collide or sit outside the canvas. */
export function validateSchematic(line: GisSchematicLine): void {
  const seen = new Set<string>();
  for (const node of line.nodes) {
    if (seen.has(node.nodeId)) throw new Error(`Schematic ${line.lineId} declares node ${node.nodeId} twice.`);
    seen.add(node.nodeId);
    const { x, y } = node.position;
    if (!(x >= 0 && x <= 100 && y >= 0 && y <= 100)) throw new Error(`Schematic node ${node.nodeId} is outside the canvas (${x}, ${y}).`);
    if (node.kind === 'work-order' && !node.refs?.workOrderId) throw new Error(`Schematic node ${node.nodeId} is a work order without a workOrderId.`);
    if (node.kind === 'exception' && !node.refs?.kpiId) throw new Error(`Schematic node ${node.nodeId} is an exception marker without a kpiId.`);
    if (node.kind === 'asset' && (node.refs?.assetIds?.length ?? 0) !== 1) throw new Error(`Schematic node ${node.nodeId} is an asset marker without exactly one assetId.`);
  }
}
