import type { ControlTowerDto, DtoEvidence } from '../app/control-tower-service.ts';
import type { ContractObligation, ContractTwin, ReportingDuty } from './contracts.ts';

/**
 * Twin evaluation: obligations against governed facts. KPI obligations take
 * the KPI status and readiness from the Control Tower DTO; reporting duties
 * take the package status and the due rule. Nothing else is judged in P0:
 * evidence, response and payment obligations are listed as not evaluated so
 * a reader sees the obligation without a fabricated verdict.
 */
export type ObligationStatus = 'met' | 'breached' | 'not_decision_grade' | 'unavailable' | 'not_effective' | 'not_evaluated';
export type DutyStatus = 'met' | 'due' | 'overdue';

export interface ObligationView extends ContractObligation {
  status: ObligationStatus;
  /** Per-KPI outcome for kpi obligations. */
  kpis: readonly { kpiId: string; value: number | null; status: string; readiness: string; decisionGrade: boolean }[];
  evidence: readonly DtoEvidence[];
  reason: string;
}

export interface DutyView extends ReportingDuty {
  status: DutyStatus;
  /** Package this duty is evaluated against, when its cadence matches. */
  reportId: string | null;
  reportStatus: string | null;
  dueAt: string | null;
  reason: string;
}

export interface ContractTwinView {
  contractId: string;
  twinVersion: string;
  approvalStatus: ContractTwin['approvalStatus'];
  /** True only for an approved twin. A demo twin is never contractual. */
  contractual: boolean;
  title: string;
  parties: ContractTwin['parties'];
  term: ContractTwin['term'];
  evaluatedAt: string;
  period: { start: string; end: string; reportId: string; cadence: string };
  obligations: readonly ObligationView[];
  reportingDuties: readonly DutyView[];
  counts: { obligations: number; met: number; breached: number; notDecisionGrade: number; notEvaluated: number; dutiesOverdue: number };
  evidence: DtoEvidence;
  provenance: { facts: ControlTowerDto['provenance']; twinSource: string };
}

const RANK: Record<ObligationStatus, number> = { met: 0, not_evaluated: 0, not_effective: 0, unavailable: 1, not_decision_grade: 2, breached: 3 };

function addDays(iso: string, days: number): string {
  return new Date(Date.parse(iso) + days * 86_400_000).toISOString();
}

function evaluateObligation(obligation: ContractObligation, tower: ControlTowerDto): ObligationView {
  const { periodStart, periodEnd } = tower.report;
  if (obligation.effectiveFrom > periodEnd || (obligation.effectiveTo !== undefined && obligation.effectiveTo < periodStart)) {
    return { ...obligation, status: 'not_effective', kpis: [], evidence: [], reason: 'Obligation is not effective for the evaluated period.' };
  }
  if (obligation.kind !== 'kpi') {
    return { ...obligation, status: 'not_evaluated', kpis: [], evidence: [], reason: `${obligation.kind} obligations are recorded but not evaluated automatically in P0.` };
  }
  const kpis = (obligation.kpiIds ?? []).map((kpiId) => {
    const kpi = tower.kpis.find((k) => k.id === kpiId);
    return kpi
      ? { kpiId, value: kpi.value, status: kpi.status, readiness: kpi.readiness.state, decisionGrade: kpi.decisionGrade, evidence: kpi.evidence }
      : { kpiId, value: null, status: 'unavailable', readiness: 'BLOCKED', decisionGrade: false, evidence: [] as readonly DtoEvidence[] };
  });
  const statuses: ObligationStatus[] = kpis.map((k) => (k.status === 'unavailable' ? 'unavailable' : !k.decisionGrade || k.readiness === 'BLOCKED' ? 'not_decision_grade' : k.status === 'breach' ? 'breached' : 'met'));
  const status = statuses.reduce<ObligationStatus>((acc, s) => (RANK[s] > RANK[acc] ? s : acc), 'met');
  const reason = status === 'met' ? `All ${kpis.length} bound KPI(s) within their approved threshold on decision-grade data.`
    : status === 'breached' ? `Breach on ${kpis.filter((k) => k.status === 'breach').map((k) => k.kpiId).join(', ')} (decision-grade).`
    : status === 'not_decision_grade' ? `KPI(s) ${kpis.filter((k) => !k.decisionGrade).map((k) => k.kpiId).join(', ')} are not decision-grade; no contractual finding.`
    : `KPI(s) ${kpis.filter((k) => k.status === 'unavailable').map((k) => k.kpiId).join(', ')} are not in the governed set.`;
  return { ...obligation, status, kpis: kpis.map(({ evidence: _e, ...rest }) => rest), evidence: kpis.flatMap((k) => k.evidence), reason };
}

function evaluateDuty(duty: ReportingDuty, tower: ControlTowerDto, evaluatedAt: string): DutyView {
  if (duty.cadence === 'per_event' || duty.cadence !== tower.report.cadence) {
    return { ...duty, status: 'due', reportId: null, reportStatus: null, dueAt: null, reason: `Duty cadence ${duty.cadence} is not evaluated against the ${tower.report.cadence} package.` };
  }
  const dueAt = addDays(tower.report.periodEnd, duty.dueDaysAfterPeriodEnd);
  const delivered = tower.report.status === 'approved' || tower.report.status === 'locked';
  const status: DutyStatus = delivered ? 'met' : evaluatedAt > dueAt ? 'overdue' : 'due';
  const reason = delivered ? `Package ${tower.report.reportId} is ${tower.report.status}.` : status === 'overdue' ? `Package ${tower.report.reportId} is ${tower.report.status} after the due date.` : `Package ${tower.report.reportId} is ${tower.report.status}; due ${dueAt.slice(0, 10)}.`;
  return { ...duty, status, reportId: tower.report.reportId, reportStatus: tower.report.status, dueAt, reason };
}

export function evaluateContractTwin(twin: ContractTwin, tower: ControlTowerDto, evaluatedAt: string = tower.generatedAt): ContractTwinView {
  const obligations = twin.obligations.map((o) => evaluateObligation(o, tower));
  const reportingDuties = twin.reportingDuties.map((d) => evaluateDuty(d, tower, evaluatedAt));
  return {
    contractId: twin.contractId,
    twinVersion: twin.twinVersion,
    approvalStatus: twin.approvalStatus,
    contractual: twin.approvalStatus === 'approved',
    title: twin.title,
    parties: twin.parties,
    term: twin.term,
    evaluatedAt,
    period: { start: tower.report.periodStart, end: tower.report.periodEnd, reportId: tower.report.reportId, cadence: tower.report.cadence },
    obligations,
    reportingDuties,
    counts: {
      obligations: obligations.length,
      met: obligations.filter((o) => o.status === 'met').length,
      breached: obligations.filter((o) => o.status === 'breached').length,
      notDecisionGrade: obligations.filter((o) => o.status === 'not_decision_grade').length,
      notEvaluated: obligations.filter((o) => o.status === 'not_evaluated' || o.status === 'not_effective' || o.status === 'unavailable').length,
      dutiesOverdue: reportingDuties.filter((d) => d.status === 'overdue').length,
    },
    evidence: { sourceSystem: twin.evidence.sourceSystem, entityType: twin.evidence.entityType, entityId: twin.evidence.entityId, observedAt: twin.evidence.observedAt },
    provenance: { facts: tower.provenance, twinSource: twin.evidence.sourceUri ?? `${twin.evidence.sourceSystem}/${twin.evidence.entityId}` },
  };
}
