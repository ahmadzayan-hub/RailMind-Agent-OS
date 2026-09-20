import { AGENT_CATALOG } from '../agent-os/catalog.ts';
import type { EvidenceRef } from '../agent-os/contracts.ts';
import type { MaximoWorkOrderRecord } from '../connectors/maximo/port.ts';
import { toControlTowerViewModel, type ControlTowerViewModel } from '../control-tower/view-model.ts';
import { exceptionsFromKpis } from '../exceptions/engine.ts';
import { computeGovernedKpis } from '../kpi/governed.ts';
import type { DataProviders, ProvidedRecord } from '../providers/contracts.ts';
import type { ReadinessAssessment } from '../readiness/gate.ts';
import { reportReadiness, type ReportReadiness } from '../reporting/approval.ts';
import type { KpiObservation, ReportException, ReportPackage } from '../reporting/contracts.ts';
import { buildReportPackage, deterministicExecutiveSummary } from '../reporting/generator.ts';
import type { ReportStore } from '../reporting/store.ts';

/**
 * Control Tower application service.
 *
 *   providers -> canonical records -> readiness gate -> deterministic KPI engine
 *   -> exception engine -> DTO
 *
 * The browser renders this DTO. It never calculates a KPI or an exception.
 */
export interface TowerScope {
  contractId: string;
  periodStart: string;
  periodEnd: string;
  priorBreachesByKpi?: Readonly<Record<string, number>>;
}

export interface DtoEvidence { sourceSystem: EvidenceRef['sourceSystem']; entityType: string; entityId: string; observedAt: string }
export interface DtoReadiness { state: 'READY' | 'PROVISIONAL' | 'BLOCKED'; reasons: readonly string[] }

export interface DtoKpi {
  id: string; name: string; unit: string; value: number; threshold: number | null;
  direction: 'higher_is_better' | 'lower_is_better' | 'target' | null; formulaVersion: string;
  status: KpiObservation['status']; readiness: DtoReadiness; decisionGrade: boolean;
  exceptionId: string | null; severity: ReportException['severity'] | null; evidence: readonly DtoEvidence[];
}

export interface DtoException {
  id: string; kpiId: string; severity: ReportException['severity']; title: string; whyItMatters: string;
  decisionRequired: string | null; evidence: readonly DtoEvidence[]; kind: 'kpi' | 'readiness';
}

export interface DtoAsset { assetId: string; openWorkOrders: number; failureWorkOrders: number; downtimeMinutes: number; lastReportedAt: string | null }
export interface DtoWorkOrder { workOrderId: string; assetId: string; workType: string | null; status: string; reportedAt: string | null; completedAt: string | null; downtimeMinutes: number; failureCode: string | null }
export interface DtoSnapshot { asOf: string; trigger: string; workOrdersSeen: number; kpis: readonly { id: string; value: number; status: KpiObservation['status']; readiness: DtoReadiness['state'] }[] }

export interface ControlTowerDto {
  provenance: { dataModule: string; engineModule: string; formulaVersion: string; synthetic: boolean; mode: DataProviders['mode']; providers: readonly string[] };
  generatedAt: string;
  asOf: string;
  report: { reportId: string; cadence: ReportPackage['cadence']; contractId: string; periodStart: string; periodEnd: string; status: ReportPackage['status'] };
  summary: string;
  controlTower: ControlTowerViewModel;
  approvalGate: ReportReadiness;
  readiness: ReadinessAssessment;
  freshness: { latestObservedAt: string | null; ingestedAt: string | null; ageHours: number | null; records: number };
  kpis: readonly DtoKpi[];
  exceptions: readonly DtoException[];
  assets: readonly DtoAsset[];
  workOrders: readonly DtoWorkOrder[];
  timeline: readonly DtoSnapshot[];
  agents: readonly { id: string; name: string; mayUseModel: boolean; allowedActionModes: readonly string[] }[];
}

const CLOSED = new Set(['COMP', 'CLOSE', 'CAN']);
const FAILURE_TYPES = new Set(['CM', 'CORRECTIVE', 'EM']);
const SEVERITY_RANK: Readonly<Record<ReportException['severity'], number>> = { critical: 0, high: 1, watch: 2 };

function dtoEvidence(refs: readonly EvidenceRef[]): readonly DtoEvidence[] {
  return refs.map((ref) => ({ sourceSystem: ref.sourceSystem, entityType: ref.entityType, entityId: ref.entityId, observedAt: ref.observedAt }));
}

function assetsFrom(workOrders: readonly MaximoWorkOrderRecord[]): readonly DtoAsset[] {
  const byAsset = new Map<string, DtoAsset>();
  for (const wo of workOrders) {
    const current = byAsset.get(wo.assetId) ?? { assetId: wo.assetId, openWorkOrders: 0, failureWorkOrders: 0, downtimeMinutes: 0, lastReportedAt: null };
    const isFailure = wo.workType ? FAILURE_TYPES.has(wo.workType.toUpperCase()) : Boolean(wo.failureCode);
    const open = !CLOSED.has(wo.status.toUpperCase());
    const reportedAt = wo.reportedAt ?? null;
    byAsset.set(wo.assetId, {
      assetId: wo.assetId,
      openWorkOrders: current.openWorkOrders + (open ? 1 : 0),
      failureWorkOrders: current.failureWorkOrders + (isFailure ? 1 : 0),
      downtimeMinutes: current.downtimeMinutes + (isFailure ? (wo.downtimeMinutes ?? 0) : 0),
      lastReportedAt: reportedAt && (!current.lastReportedAt || reportedAt > current.lastReportedAt) ? reportedAt : current.lastReportedAt,
    });
  }
  return [...byAsset.values()].sort((a, b) => a.assetId.localeCompare(b.assetId));
}

export class ControlTowerService {
  readonly #providers: DataProviders;
  readonly #reportStore: ReportStore;
  readonly #seedReport: ReportPackage;
  readonly #now: () => string;

  constructor(providers: DataProviders, reportStore: ReportStore, seedReport: ReportPackage, now?: () => string) {
    this.#providers = providers;
    this.#reportStore = reportStore;
    this.#seedReport = seedReport;
    this.#now = now ?? (() => new Date().toISOString());
  }

  /** Builds the DTO for a scope. `seed` names the package (id, cadence, seed state) the scope reports into; defaults to the deployment seed. */
  async build(scope: TowerScope, asOf?: string, seed: ReportPackage = this.#seedReport): Promise<ControlTowerDto> {
    const mode = this.#providers.mode;
    const kpiSet = await this.#providers.contract.getKpiSet(scope.contractId);
    const assetIds = kpiSet?.value.assetIds ?? [];
    const allWorkOrders = await this.#providers.maintenance.listWorkOrders(assetIds, scope.periodStart);
    const evaluatedAt = asOf ?? this.#now();
    const periodEnd = asOf && asOf < scope.periodEnd ? asOf : scope.periodEnd;
    const inPeriod = allWorkOrders.filter((r) => !r.value.reportedAt || r.value.reportedAt <= periodEnd);

    const governed = computeGovernedKpis({ kpiSet, workOrders: inPeriod, periodStart: scope.periodStart, periodEnd, asOf: evaluatedAt, mode, plannedServiceMinutes: asOf && asOf < scope.periodEnd ? Math.max(1, Math.round((Date.parse(periodEnd) - Date.parse(scope.periodStart)) / 60_000)) : undefined });
    const decisionGrade = governed.observations.filter((o) => o.decisionGrade);
    const kpiExceptions = exceptionsFromKpis(decisionGrade, { contractId: scope.contractId, priorBreachesByKpi: scope.priorBreachesByKpi });
    const blocked = governed.observations.filter((o) => !o.decisionGrade);
    const readinessExceptions: ReportException[] = blocked.length > 0 ? [{
      id: `${scope.contractId}:readiness:${periodEnd}`,
      severity: 'high',
      title: 'Data readiness blocked',
      whyItMatters: `${blocked.length} KPI(s) are BLOCKED by the data-quality gate (${blocked.map((o) => o.definition.id).join(', ')}) and cannot be decision-grade.`,
      decisionRequired: 'Resolve the source data issues before contractual conclusions are drawn.',
      evidence: governed.evidence,
    }] : [];
    /* Severity first; at equal severity a readiness exception precedes KPI exceptions because unresolved data blocks every conclusion. */
    const isReadiness = (x: ReportException): number => (x.id.includes(':readiness:') ? 0 : 1);
    const exceptions = [...readinessExceptions, ...kpiExceptions].sort((a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity] || isReadiness(a) - isReadiness(b) || a.id.localeCompare(b.id));

    const report = buildReportPackage({ reportId: seed.reportId, cadence: seed.cadence, contractId: scope.contractId, periodStart: scope.periodStart, periodEnd: scope.periodEnd, kpis: governed.observations, priorBreachesByKpi: scope.priorBreachesByKpi });
    const stored = await this.#reportStore.get(seed.reportId);
    const status = stored?.status ?? seed.status;
    const gateReport: ReportPackage = { ...(stored ?? seed), kpis: governed.observations, exceptions };

    const kpis: DtoKpi[] = governed.observations.map((o) => {
      const exception = kpiExceptions.find((x) => x.id === `${scope.contractId}:${o.definition.id}:${o.periodEnd}`) ?? null;
      return { id: o.definition.id, name: o.definition.name, unit: o.definition.unit, value: o.value, threshold: o.definition.threshold ?? null, direction: o.definition.direction ?? null, formulaVersion: o.definition.formulaVersion, status: o.status, readiness: o.readiness ?? { state: 'READY', reasons: [] }, decisionGrade: o.decisionGrade ?? true, exceptionId: exception?.id ?? null, severity: exception?.severity ?? null, evidence: dtoEvidence(o.evidence) };
    });
    const exceptionDtos: DtoException[] = exceptions.map((x) => ({ id: x.id, kpiId: governed.observations.find((o) => x.id === `${scope.contractId}:${o.definition.id}:${o.periodEnd}`)?.definition.id ?? 'readiness', severity: x.severity, title: x.title, whyItMatters: x.whyItMatters, decisionRequired: x.decisionRequired ?? null, evidence: dtoEvidence(x.evidence), kind: x.id.includes(':readiness:') ? 'readiness' : 'kpi' }));

    const latest = governed.readiness.freshness.latestObservedAt;
    const ingested = inPeriod.reduce<string | null>((acc, r) => (!acc || r.provenance.ingestedAt > acc ? r.provenance.ingestedAt : acc), null);
    const workOrders = inPeriod.map((r) => r.value);

    return {
      provenance: { dataModule: mode === 'synthetic' ? 'src/demo.ts' : 'live providers', engineModule: 'src/kpi/engine.ts', formulaVersion: kpiSet?.value.definitionVersion ?? 'unknown', synthetic: mode === 'synthetic', mode, providers: [this.#providers.maintenance.id, this.#providers.contract.id, this.#providers.condition.id, this.#providers.finance.id] },
      generatedAt: this.#now(),
      asOf: evaluatedAt,
      report: { reportId: report.reportId, cadence: report.cadence, contractId: report.contractId, periodStart: report.periodStart, periodEnd: report.periodEnd, status },
      summary: deterministicExecutiveSummary({ ...report, exceptions }),
      controlTower: toControlTowerViewModel({ ...report, exceptions }),
      approvalGate: reportReadiness({ ...gateReport, status }),
      readiness: governed.readiness,
      freshness: { latestObservedAt: latest, ingestedAt: ingested, ageHours: governed.readiness.freshness.ageHours, records: inPeriod.length },
      kpis,
      exceptions: exceptionDtos,
      assets: assetsFrom(workOrders),
      workOrders: workOrders.map((wo) => ({ workOrderId: wo.workOrderId, assetId: wo.assetId, workType: wo.workType ?? null, status: wo.status, reportedAt: wo.reportedAt ?? null, completedAt: wo.completedAt ?? null, downtimeMinutes: wo.downtimeMinutes ?? 0, failureCode: wo.failureCode ?? null })),
      timeline: await this.timeline(scope, allWorkOrders, kpiSet ? { kpiSet, mode } : null),
      agents: AGENT_CATALOG.map((agent) => ({ id: agent.id, name: agent.name, mayUseModel: agent.mayUseModel, allowedActionModes: agent.allowedActionModes })),
    };
  }

  /**
   * A report package for the scope built through the governed pipeline, used
   * as the seed of a deployment whose package does not exist yet. The seed
   * carries the current observations; the API refreshes them on every read.
   */
  async seedPackage(scope: TowerScope, seed: Pick<ReportPackage, 'reportId' | 'cadence'> = this.#seedReport): Promise<ReportPackage> {
    const kpiSet = await this.#providers.contract.getKpiSet(scope.contractId);
    const workOrders = await this.#providers.maintenance.listWorkOrders(kpiSet?.value.assetIds ?? [], scope.periodStart);
    const governed = computeGovernedKpis({ kpiSet, workOrders: workOrders.filter((r) => !r.value.reportedAt || r.value.reportedAt <= scope.periodEnd), periodStart: scope.periodStart, periodEnd: scope.periodEnd, asOf: this.#now(), mode: this.#providers.mode });
    return buildReportPackage({ reportId: seed.reportId, cadence: seed.cadence, contractId: scope.contractId, periodStart: scope.periodStart, periodEnd: scope.periodEnd, kpis: governed.observations, priorBreachesByKpi: scope.priorBreachesByKpi });
  }

  /** Period-to-date replay: each source event re-enters the same pipeline. Synthetic telemetry never edits KPI truth directly. */
  async timeline(scope: TowerScope, records: readonly ProvidedRecord<MaximoWorkOrderRecord>[], setup: { kpiSet: ProvidedRecord<import('../connectors/contract/port.ts').ContractKpiSet>; mode: DataProviders['mode'] } | null): Promise<readonly DtoSnapshot[]> {
    if (!setup) return [];
    const ordered = records.filter((r) => r.value.reportedAt).sort((a, b) => (a.value.reportedAt ?? '').localeCompare(b.value.reportedAt ?? ''));
    const points = ordered.map((r) => ({ asOf: r.value.reportedAt ?? scope.periodStart, trigger: r.value.workOrderId }));
    points.push({ asOf: scope.periodEnd, trigger: 'PERIOD-CLOSE' });
    return points.map((point) => {
      const seen = records.filter((r) => r.value.reportedAt && r.value.reportedAt <= point.asOf);
      const elapsedMinutes = Math.max(1, Math.round((Date.parse(point.asOf) - Date.parse(scope.periodStart)) / 60_000));
      const governed = computeGovernedKpis({ kpiSet: setup.kpiSet, workOrders: seen, periodStart: scope.periodStart, periodEnd: point.asOf, asOf: point.asOf, mode: setup.mode, plannedServiceMinutes: elapsedMinutes });
      return { asOf: point.asOf, trigger: point.trigger, workOrdersSeen: seen.length, kpis: governed.observations.map((o) => ({ id: o.definition.id, value: o.value, status: o.status, readiness: o.readiness?.state ?? 'READY' })) };
    });
  }
}
