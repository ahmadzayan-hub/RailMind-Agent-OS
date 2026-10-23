import type { ContractKpiSet } from '../connectors/contract/port.ts';
import type { MaximoWorkOrderRecord } from '../connectors/maximo/port.ts';
import type { ProvidedRecord, ProviderMode } from '../providers/contracts.ts';

/**
 * Deterministic data-quality and readiness gate.
 *
 * READY: decision-grade. PROVISIONAL: usable with visible caveats. BLOCKED:
 * cannot become decision-grade; excluded from contractual exceptions and from
 * narrative facts. AI narrative never hides these states.
 */
export type ReadinessState = 'READY' | 'PROVISIONAL' | 'BLOCKED';

export type ReadinessCode =
  | 'no_source_records'
  | 'missing_kpi_definition'
  | 'unapproved_kpi_definition'
  | 'demo_kpi_definition'
  | 'duplicate_source_record'
  | 'invalid_timestamp'
  | 'missing_timestamp'
  | 'contradictory_record'
  | 'missing_downtime'
  | 'open_beyond_period'
  | 'rejected_source_record'
  | 'stale_source'
  | 'definition_not_effective'
  | 'unmapped_source_field'
  | 'missing_completion';

export interface ReadinessIssue {
  code: ReadinessCode;
  severity: 'block' | 'warn';
  detail: string;
  recordId?: string;
  /** KPI ids affected; empty means all. */
  kpiIds: readonly string[];
}

export interface ReadinessAssessment {
  state: ReadinessState;
  evaluatedAt: string;
  issues: readonly ReadinessIssue[];
  perKpi: Readonly<Record<string, { state: ReadinessState; issues: readonly ReadinessIssue[] }>>;
  freshness: { latestObservedAt: string | null; latestIngestedAt: string | null; ageHours: number | null; maxAgeHours: number };
  counts: { records: number; verified: number; provisional: number; rejected: number };
}

export interface ReadinessInput {
  workOrders: readonly ProvidedRecord<MaximoWorkOrderRecord>[];
  kpiSet: ProvidedRecord<ContractKpiSet> | null;
  periodStart: string;
  periodEnd: string;
  asOf: string;
  mode: ProviderMode;
  /** Source age beyond which data is provisional. */
  maxAgeHours?: number;
  /** Source age beyond which data is blocked. */
  blockAgeHours?: number;
}

const FAILURE_TYPES = new Set(['CM', 'CORRECTIVE', 'EM']);
const CLOSED = new Set(['COMP', 'CLOSE', 'CAN']);
const DOWNTIME_KPIS = ['availability', 'mttr', 'mtbf'];
const PM_TYPES = new Set(['PM']);
const PM_KPIS = ['pm_compliance'];

function validDate(value: string | undefined): boolean {
  return value !== undefined && !Number.isNaN(Date.parse(value));
}

export function assessReadiness(input: ReadinessInput): ReadinessAssessment {
  const issues: ReadinessIssue[] = [];
  const kpiIds = input.kpiSet?.value.definitions.map((d) => d.id) ?? [];
  const maxAgeHours = input.maxAgeHours ?? 24 * 7;
  const blockAgeHours = input.blockAgeHours ?? 24 * 60;

  if (!input.kpiSet) {
    issues.push({ code: 'missing_kpi_definition', severity: 'block', detail: 'No approved KPI definition set is available for this contract.', kpiIds: [] });
  } else {
    const approval = input.kpiSet.value.approvalStatus ?? (input.mode === 'synthetic' ? 'demo_only' : 'unapproved');
    if (approval === 'demo_only') issues.push({ code: 'demo_kpi_definition', severity: input.mode === 'production' ? 'block' : 'warn', detail: `KPI definition set ${input.kpiSet.value.definitionVersion} is DEMO ONLY and not contractually approved.`, kpiIds: [] });
    else if (approval !== 'approved') issues.push({ code: 'unapproved_kpi_definition', severity: 'block', detail: `KPI definition set ${input.kpiSet.value.definitionVersion} is ${approval}.`, kpiIds: [] });
  }

  for (const definition of input.kpiSet?.value.definitions ?? []) {
    if (definition.effectiveFrom > input.periodStart || (definition.effectiveTo !== undefined && definition.effectiveTo < input.periodEnd)) {
      issues.push({ code: 'definition_not_effective', severity: 'block', detail: `KPI ${definition.id}@${definition.formulaVersion} is not effective for the whole period.`, kpiIds: [definition.id] });
    }
    if (input.mode === 'production' && definition.approvalStatus !== 'approved') {
      issues.push({ code: 'unapproved_kpi_definition', severity: 'block', detail: `KPI ${definition.id}@${definition.formulaVersion} is ${definition.approvalStatus}; production requires approved definitions.`, kpiIds: [definition.id] });
    }
  }

  const records = input.workOrders;
  if (records.length === 0) issues.push({ code: 'no_source_records', severity: 'block', detail: 'No work-order records were provided for the period.', kpiIds: [] });

  const seen = new Set<string>();
  let latest: string | null = null;
  for (const record of records) {
    const wo = record.value;
    const id = wo.workOrderId;
    if (seen.has(id)) issues.push({ code: 'duplicate_source_record', severity: 'block', detail: `Work order ${id} appears more than once.`, recordId: id, kpiIds: [] });
    seen.add(id);
    if (record.provenance.qualityState === 'rejected') issues.push({ code: 'rejected_source_record', severity: 'warn', detail: `Work order ${id} was rejected at source and excluded from every calculation.`, recordId: id, kpiIds: [] });
    if (!wo.reportedAt) issues.push({ code: 'missing_timestamp', severity: 'block', detail: `Work order ${id} has no reported timestamp and cannot be placed in a period.`, recordId: id, kpiIds: [] });
    else if (!validDate(wo.reportedAt)) issues.push({ code: 'invalid_timestamp', severity: 'block', detail: `Work order ${id} has an unparseable reported timestamp.`, recordId: id, kpiIds: [] });
    else if (!latest || wo.reportedAt > latest) latest = wo.reportedAt;
    for (const [field, value] of [['actualStartAt', wo.actualStartAt], ['completedAt', wo.completedAt]] as const) {
      if (value !== undefined && !validDate(value)) issues.push({ code: 'invalid_timestamp', severity: 'block', detail: `Work order ${id} has an unparseable ${field}.`, recordId: id, kpiIds: [] });
    }
    if (wo.actualStartAt && wo.completedAt && validDate(wo.actualStartAt) && validDate(wo.completedAt) && wo.completedAt < wo.actualStartAt) {
      issues.push({ code: 'contradictory_record', severity: 'block', detail: `Work order ${id} completes before it starts.`, recordId: id, kpiIds: [] });
    }
    if (!wo.status) issues.push({ code: 'unmapped_source_field', severity: 'block', detail: `Work order ${id} has no status; backlog cannot be derived.`, recordId: id, kpiIds: ['backlog'] });
    const isFailure = wo.workType ? FAILURE_TYPES.has(wo.workType.toUpperCase()) : Boolean(wo.failureCode);
    if (isFailure && (wo.downtimeMinutes === undefined || wo.downtimeMinutes === null) && !(wo.actualStartAt && wo.completedAt)) {
      issues.push({ code: 'missing_downtime', severity: 'block', detail: `Failure work order ${id} has neither downtime nor start and completion timestamps.`, recordId: id, kpiIds: DOWNTIME_KPIS });
    }
    const isPm = wo.workType ? PM_TYPES.has(wo.workType.toUpperCase()) : false;
    if (isPm && CLOSED.has((wo.status ?? '').toUpperCase()) && wo.status.toUpperCase() !== 'CAN' && !wo.completedAt) {
      issues.push({ code: 'missing_completion', severity: 'warn', detail: `PM work order ${id} is closed without a completion timestamp; on-time compliance cannot be confirmed.`, recordId: id, kpiIds: PM_KPIS });
    }
    if (isFailure && !CLOSED.has((wo.status ?? '').toUpperCase()) && wo.reportedAt && wo.reportedAt <= input.periodEnd && input.asOf > input.periodEnd) {
      issues.push({ code: 'open_beyond_period', severity: 'warn', detail: `Failure work order ${id} is still open after period end; repair time may change on closure.`, recordId: id, kpiIds: DOWNTIME_KPIS });
    }
  }

  /* Freshness is the age of the extract (latest ingestion), not of the latest business event. */
  const latestIngested = records.reduce<string | null>((acc, r) => (!acc || r.provenance.ingestedAt > acc ? r.provenance.ingestedAt : acc), null);
  let ageHours: number | null = null;
  if (latestIngested) {
    ageHours = Math.max(0, Math.round(((Date.parse(input.asOf) - Date.parse(latestIngested)) / 3_600_000) * 10) / 10);
    if (ageHours > blockAgeHours) issues.push({ code: 'stale_source', severity: 'block', detail: `Latest source record is ${ageHours} h old; the extract is too stale to be decision-grade.`, kpiIds: [] });
    else if (ageHours > maxAgeHours) issues.push({ code: 'stale_source', severity: 'warn', detail: `Latest source record is ${ageHours} h old, older than the ${maxAgeHours} h freshness target.`, kpiIds: [] });
  }

  const stateOf = (list: readonly ReadinessIssue[]): ReadinessState => (list.some((i) => i.severity === 'block') ? 'BLOCKED' : list.length > 0 ? 'PROVISIONAL' : 'READY');
  const perKpi: Record<string, { state: ReadinessState; issues: readonly ReadinessIssue[] }> = {};
  for (const kpiId of kpiIds) {
    const relevant = issues.filter((i) => i.kpiIds.length === 0 || i.kpiIds.includes(kpiId));
    perKpi[kpiId] = { state: stateOf(relevant), issues: relevant };
  }
  const counts = { records: records.length, verified: 0, provisional: 0, rejected: 0 };
  for (const record of records) counts[record.provenance.qualityState] += 1;

  return {
    state: kpiIds.length === 0 ? stateOf(issues) : (Object.values(perKpi).some((k) => k.state === 'BLOCKED') && Object.values(perKpi).every((k) => k.state === 'BLOCKED') ? 'BLOCKED' : stateOf(issues.filter((i) => i.kpiIds.length === 0)) === 'BLOCKED' ? 'BLOCKED' : Object.values(perKpi).some((k) => k.state !== 'READY') || issues.length > 0 ? 'PROVISIONAL' : 'READY'),
    evaluatedAt: input.asOf,
    issues,
    perKpi,
    freshness: { latestObservedAt: latest, latestIngestedAt: latestIngested, ageHours, maxAgeHours },
    counts,
  };
}
