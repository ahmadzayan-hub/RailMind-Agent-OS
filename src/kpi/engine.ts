import type { EvidenceRef } from '../agent-os/contracts.ts';
import type { MaximoWorkOrderRecord } from '../connectors/maximo/port.ts';
import type { KpiDefinition, KpiObservation } from '../reporting/contracts.ts';

export type KpiFormulaKind =
  | 'availability_percent'
  | 'failure_count'
  | 'mtbf_hours'
  | 'mttr_hours'
  | 'backlog_count'
  | 'pm_compliance_percent';

export interface ExecutableKpiDefinition extends KpiDefinition {
  formulaKind: KpiFormulaKind;
}

export interface KpiPeriodInput {
  periodStart: string;
  periodEnd: string;
  /** Planned service minutes in the reporting period. Contract definition must supply this. */
  plannedServiceMinutes: number;
  workOrders: readonly MaximoWorkOrderRecord[];
  failureWorkTypes?: readonly string[];
  closedStatuses?: readonly string[];
  /** Work types that identify preventive-maintenance orders. */
  pmWorkTypes?: readonly string[];
}

function inPeriod(timestamp: string | undefined, start: string, end: string): boolean {
  if (!timestamp) return false;
  return timestamp >= start && timestamp <= end;
}

function failureOrders(input: KpiPeriodInput): readonly MaximoWorkOrderRecord[] {
  const failureTypes = new Set((input.failureWorkTypes ?? ['CM', 'CORRECTIVE', 'EM']).map((v) => v.toUpperCase()));
  return input.workOrders.filter((wo) => {
    const workType = wo.workType?.toUpperCase();
    const isFailureType = workType ? failureTypes.has(workType) : Boolean(wo.failureCode);
    return isFailureType && inPeriod(wo.reportedAt, input.periodStart, input.periodEnd);
  });
}

function repairMinutes(wo: MaximoWorkOrderRecord): number {
  if (typeof wo.downtimeMinutes === 'number' && wo.downtimeMinutes >= 0) return wo.downtimeMinutes;
  if (!wo.actualStartAt || !wo.completedAt) return 0;
  const diff = Date.parse(wo.completedAt) - Date.parse(wo.actualStartAt);
  return Number.isFinite(diff) && diff > 0 ? diff / 60_000 : 0;
}

/**
 * PM schedule compliance: preventive-maintenance work orders due in the
 * period, completed on or before their due date. Due date is the target start
 * when Maximo carries one, otherwise the reported date. Nothing due means
 * nothing missed, so the value is 100.
 */
export function pmComplianceOrders(input: KpiPeriodInput): { due: readonly MaximoWorkOrderRecord[]; onTime: readonly MaximoWorkOrderRecord[] } {
  const pmTypes = new Set((input.pmWorkTypes ?? ['PM']).map((v) => v.toUpperCase()));
  const closed = new Set((input.closedStatuses ?? ['COMP', 'CLOSE', 'CAN']).map((v) => v.toUpperCase()));
  const due = input.workOrders.filter((wo) => {
    if (!wo.workType || !pmTypes.has(wo.workType.toUpperCase())) return false;
    if (wo.status.toUpperCase() === 'CAN') return false;
    return inPeriod(wo.targetStartAt ?? wo.reportedAt, input.periodStart, input.periodEnd);
  });
  const onTime = due.filter((wo) => {
    const dueAt = wo.targetStartAt ?? wo.reportedAt;
    return closed.has(wo.status.toUpperCase()) && Boolean(wo.completedAt) && Boolean(dueAt) && (wo.completedAt as string) <= (dueAt as string);
  });
  return { due, onTime };
}

function round(value: number, digits = 2): number {
  const scale = 10 ** digits;
  return Math.round((value + Number.EPSILON) * scale) / scale;
}

export function computeKpiValue(definition: ExecutableKpiDefinition, input: KpiPeriodInput): number {
  const failures = failureOrders(input);
  const totalDowntime = failures.reduce((sum, wo) => sum + repairMinutes(wo), 0);

  switch (definition.formulaKind) {
    case 'availability_percent': {
      if (input.plannedServiceMinutes <= 0) return 0;
      return round(Math.max(0, (input.plannedServiceMinutes - totalDowntime) / input.plannedServiceMinutes) * 100, 3);
    }
    case 'failure_count':
      return failures.length;
    case 'mtbf_hours': {
      if (failures.length === 0) return round(input.plannedServiceMinutes / 60, 2);
      return round(Math.max(0, input.plannedServiceMinutes - totalDowntime) / 60 / failures.length, 2);
    }
    case 'mttr_hours':
      return failures.length === 0 ? 0 : round(totalDowntime / 60 / failures.length, 2);
    case 'backlog_count': {
      const closed = new Set((input.closedStatuses ?? ['COMP', 'CLOSE', 'CAN']).map((v) => v.toUpperCase()));
      return input.workOrders.filter((wo) => !closed.has(wo.status.toUpperCase())).length;
    }
    case 'pm_compliance_percent': {
      const { due, onTime } = pmComplianceOrders(input);
      if (due.length === 0) return 100;
      return round((onTime.length / due.length) * 100, 1);
    }
  }
}

export function statusFor(definition: KpiDefinition, value: number): KpiObservation['status'] {
  if (definition.threshold === undefined || definition.direction === undefined) return 'not_applicable';
  if (definition.direction === 'higher_is_better') return value >= definition.threshold ? 'within_target' : 'breach';
  if (definition.direction === 'lower_is_better') return value <= definition.threshold ? 'within_target' : 'breach';
  return Math.abs(value - definition.threshold) < 0.000001 ? 'within_target' : 'watch';
}

export function computeKpiObservation(
  definition: ExecutableKpiDefinition,
  input: KpiPeriodInput,
  evidence: readonly EvidenceRef[],
): KpiObservation {
  const value = computeKpiValue(definition, input);
  return {
    definition,
    periodStart: input.periodStart,
    periodEnd: input.periodEnd,
    value,
    status: statusFor(definition, value),
    evidence,
  };
}
