import type { GovernedKpiDefinition } from './registry.ts';

/**
 * DEMO ONLY. These are not RTA contractual formulas or thresholds.
 * A production deployment must replace them with approved, versioned contract
 * definitions registered in the KPI authority registry. Every entry here is
 * labelled approvalStatus 'demo_only' and can never be admitted in production.
 */
const DEMO_GOVERNANCE = {
  authority: { contractId: 'DEMO-CONTRACT', clauseRef: 'DEMO-CLAUSE (illustrative)' },
  effectiveFrom: '2026-01-01T00:00:00Z',
  dataQualityRequirements: ['reported timestamp present', 'no duplicate work-order ids'],
  evidenceRules: ['every included work order referenced by id with its reported timestamp'],
  owner: 'demo.owner (synthetic)',
  reviewer: 'demo.reviewer (synthetic)',
  approvalStatus: 'demo_only' as const,
};

export const DEMO_KPI_DEFINITIONS: readonly GovernedKpiDefinition[] = [
  {
    id: 'availability',
    name: 'Availability',
    unit: '%',
    formulaVersion: 'demo-v1',
    formulaKind: 'availability_percent',
    threshold: 99.5,
    direction: 'higher_is_better',
    ...DEMO_GOVERNANCE,
    includedEvents: ['CM', 'CORRECTIVE', 'EM'],
    excludedEvents: ['PM', 'INSPECTION'],
    requiredSourceFields: ['workOrderId', 'workType', 'reportedAt', 'downtimeMinutes or actualStartAt+completedAt'],
  },
  {
    id: 'failures',
    name: 'Failures',
    unit: 'count',
    formulaVersion: 'demo-v1',
    formulaKind: 'failure_count',
    threshold: 4,
    direction: 'lower_is_better',
    ...DEMO_GOVERNANCE,
    includedEvents: ['CM', 'CORRECTIVE', 'EM'],
    excludedEvents: ['PM', 'INSPECTION'],
    requiredSourceFields: ['workOrderId', 'workType', 'reportedAt'],
  },
  {
    id: 'mtbf',
    name: 'MTBF',
    unit: 'hours',
    formulaVersion: 'demo-v1',
    formulaKind: 'mtbf_hours',
    threshold: 120,
    direction: 'higher_is_better',
    ...DEMO_GOVERNANCE,
    includedEvents: ['CM', 'CORRECTIVE', 'EM'],
    excludedEvents: ['PM', 'INSPECTION'],
    requiredSourceFields: ['workOrderId', 'workType', 'reportedAt', 'downtimeMinutes or actualStartAt+completedAt'],
  },
  {
    id: 'mttr',
    name: 'MTTR',
    unit: 'hours',
    formulaVersion: 'demo-v1',
    formulaKind: 'mttr_hours',
    threshold: 2,
    direction: 'lower_is_better',
    ...DEMO_GOVERNANCE,
    includedEvents: ['CM', 'CORRECTIVE', 'EM'],
    excludedEvents: ['PM', 'INSPECTION'],
    requiredSourceFields: ['workOrderId', 'workType', 'reportedAt', 'downtimeMinutes or actualStartAt+completedAt'],
  },
  {
    id: 'backlog',
    name: 'Maintenance Backlog',
    unit: 'work orders',
    formulaVersion: 'demo-v1',
    formulaKind: 'backlog_count',
    threshold: 5,
    direction: 'lower_is_better',
    ...DEMO_GOVERNANCE,
    includedEvents: ['any work order not in COMP, CLOSE or CAN'],
    excludedEvents: ['COMP', 'CLOSE', 'CAN'],
    requiredSourceFields: ['workOrderId', 'status'],
  },
  {
    id: 'pm_compliance',
    name: 'PM Compliance',
    unit: '%',
    formulaVersion: 'demo-v1',
    formulaKind: 'pm_compliance_percent',
    threshold: 90,
    direction: 'higher_is_better',
    ...DEMO_GOVERNANCE,
    includedEvents: ['PM work orders due in the period (target start, else reported date)'],
    excludedEvents: ['CM', 'CORRECTIVE', 'EM', 'CAN'],
    requiredSourceFields: ['workOrderId', 'workType', 'status', 'targetStartAt or reportedAt', 'completedAt'],
  },
];
