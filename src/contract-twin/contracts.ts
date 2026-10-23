import type { EvidenceRef } from '../agent-os/contracts.ts';

/**
 * Contract digital twin (Phase 12).
 *
 * A structured, versioned copy of what an approved contract obliges:
 * obligations with clause references, the KPIs they bind, reporting duties
 * with due rules, evidence rules and consequences. The twin is read from the
 * contract repository and never authored here. RailMind evaluates the twin
 * against governed facts; it never redefines a clause, a threshold or a
 * date. A demo twin is labelled demo_only and is never contractual.
 */
export type ObligationKind = 'kpi' | 'reporting' | 'evidence' | 'response' | 'payment';
export type ObligationOwner = 'owner' | 'contractor' | 'both';
export type ReportingCadence = 'monthly' | 'quarterly' | 'annual' | 'per_event';

export interface ContractObligation {
  obligationId: string;
  clauseRef: string;
  kind: ObligationKind;
  title: string;
  description: string;
  owner: ObligationOwner;
  /** KPI ids the obligation binds (kind 'kpi'). */
  kpiIds?: readonly string[];
  /** Evidence the owner may demand for this obligation. Copied from the contract. */
  evidenceRules: readonly string[];
  /** Contractual consequence of non-performance, copied verbatim where available. */
  consequence?: string;
  effectiveFrom: string;
  effectiveTo?: string;
}

export interface ReportingDuty {
  dutyId: string;
  clauseRef: string;
  cadence: ReportingCadence;
  title: string;
  /** Calendar days after period end by which the package is due. */
  dueDaysAfterPeriodEnd: number;
  requiredContents: readonly string[];
  recipients: readonly string[];
}

export interface ContractTwin {
  contractId: string;
  twinVersion: string;
  approvalStatus: 'approved' | 'draft' | 'unapproved' | 'demo_only';
  title: string;
  parties: { owner: string; contractor: string };
  term: { start: string; end: string };
  obligations: readonly ContractObligation[];
  reportingDuties: readonly ReportingDuty[];
  evidence: EvidenceRef;
}

const KINDS: readonly ObligationKind[] = ['kpi', 'reporting', 'evidence', 'response', 'payment'];
const OWNERS: readonly ObligationOwner[] = ['owner', 'contractor', 'both'];
const CADENCES: readonly ReportingCadence[] = ['monthly', 'quarterly', 'annual', 'per_event'];
const isTimestamp = (value: unknown): value is string => typeof value === 'string' && !Number.isNaN(Date.parse(value));

/** Returns the reasons a twin is not valid; empty when it is. */
export function validateTwin(twin: ContractTwin): readonly string[] {
  const problems: string[] = [];
  if (!twin.contractId?.trim()) problems.push('contractId is required');
  if (!twin.twinVersion?.trim()) problems.push('twinVersion is required');
  if (!['approved', 'draft', 'unapproved', 'demo_only'].includes(twin.approvalStatus)) problems.push('approvalStatus is invalid');
  if (!isTimestamp(twin.term?.start) || !isTimestamp(twin.term?.end) || twin.term.start >= twin.term.end) problems.push('term must have a start before its end');
  if (!twin.parties?.owner?.trim() || !twin.parties?.contractor?.trim()) problems.push('parties.owner and parties.contractor are required');
  const ids = new Set<string>();
  for (const obligation of twin.obligations ?? []) {
    const where = `obligation ${obligation.obligationId ?? '?'}`;
    if (!obligation.obligationId?.trim()) problems.push('an obligation has no obligationId');
    else if (ids.has(obligation.obligationId)) problems.push(`${where} is duplicated`);
    ids.add(obligation.obligationId);
    if (!obligation.clauseRef?.trim()) problems.push(`${where}: clauseRef is required`);
    if (!KINDS.includes(obligation.kind)) problems.push(`${where}: kind is invalid`);
    if (!OWNERS.includes(obligation.owner)) problems.push(`${where}: owner is invalid`);
    if (obligation.kind === 'kpi' && (obligation.kpiIds?.length ?? 0) === 0) problems.push(`${where}: a kpi obligation must bind at least one kpiId`);
    if (!isTimestamp(obligation.effectiveFrom)) problems.push(`${where}: effectiveFrom must be a timestamp`);
    if (obligation.effectiveTo !== undefined && (!isTimestamp(obligation.effectiveTo) || obligation.effectiveTo <= obligation.effectiveFrom)) problems.push(`${where}: effectiveTo must follow effectiveFrom`);
    if (!Array.isArray(obligation.evidenceRules)) problems.push(`${where}: evidenceRules must be a list`);
  }
  const duties = new Set<string>();
  for (const duty of twin.reportingDuties ?? []) {
    const where = `reporting duty ${duty.dutyId ?? '?'}`;
    if (!duty.dutyId?.trim()) problems.push('a reporting duty has no dutyId');
    else if (duties.has(duty.dutyId)) problems.push(`${where} is duplicated`);
    duties.add(duty.dutyId);
    if (!duty.clauseRef?.trim()) problems.push(`${where}: clauseRef is required`);
    if (!CADENCES.includes(duty.cadence)) problems.push(`${where}: cadence is invalid`);
    if (!Number.isInteger(duty.dueDaysAfterPeriodEnd) || duty.dueDaysAfterPeriodEnd < 0) problems.push(`${where}: dueDaysAfterPeriodEnd must be a non-negative integer`);
  }
  if (!twin.evidence || twin.evidence.sourceSystem !== 'contract_repository') problems.push('evidence must reference the contract repository');
  return problems;
}
