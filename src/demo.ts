import type { EvidenceRef } from './agent-os/contracts.ts';
import type { AssetConditionProfile } from './connectors/condition/port.ts';
import type { ContractKpiSet } from './connectors/contract/port.ts';
import type { ContractTwin } from './contract-twin/contracts.ts';
import type { MaximoAssetRecord, MaximoInvoiceRecord, MaximoPmRecord, MaximoWorkOrderRecord } from './connectors/maximo/port.ts';
import { DEMO_KPI_DEFINITIONS } from './kpi/demo-definitions.ts';
import { computeKpiObservation } from './kpi/engine.ts';
import type { SyntheticDataset } from './providers/synthetic.ts';
import { buildReportPackage, deterministicExecutiveSummary } from './reporting/generator.ts';
import type { ReportRegistration } from './reporting/registry.ts';

const periodStart = '2026-08-01T00:00:00Z';
const periodEnd = '2026-08-31T23:59:59Z';

export const DEMO_PERIOD = { start: periodStart, end: periodEnd } as const;

export const DEMO_WORK_ORDERS: readonly MaximoWorkOrderRecord[] = [
  { workOrderId: 'WO-1001', assetId: 'ATC-ZC-01', workType: 'CM', status: 'COMP', reportedAt: '2026-08-03T08:00:00Z', actualStartAt: '2026-08-03T08:20:00Z', completedAt: '2026-08-03T10:20:00Z', downtimeMinutes: 120, failureCode: 'COMM' },
  { workOrderId: 'WO-1002', assetId: 'ATC-ZC-02', workType: 'CM', status: 'COMP', reportedAt: '2026-08-10T10:00:00Z', actualStartAt: '2026-08-10T10:10:00Z', completedAt: '2026-08-10T13:10:00Z', downtimeMinutes: 180, failureCode: 'HW' },
  { workOrderId: 'WO-1003', assetId: 'ATC-ZC-02', workType: 'CM', status: 'COMP', reportedAt: '2026-08-17T09:00:00Z', actualStartAt: '2026-08-17T09:05:00Z', completedAt: '2026-08-17T11:35:00Z', downtimeMinutes: 150, failureCode: 'HW' },
  { workOrderId: 'WO-1004', assetId: 'TRAM-APS-03', workType: 'CM', status: 'INPRG', reportedAt: '2026-08-25T06:00:00Z', actualStartAt: '2026-08-25T06:30:00Z', downtimeMinutes: 210, failureCode: 'POWER' },
  { workOrderId: 'WO-1005', assetId: 'ATC-ZC-01', workType: 'PM', status: 'WAPPR', reportedAt: '2026-08-29T07:00:00Z', downtimeMinutes: 0 },
  { workOrderId: 'WO-1006', assetId: 'TRAM-APS-03', workType: 'PM', status: 'WAPPR', reportedAt: '2026-08-30T07:00:00Z', downtimeMinutes: 0 },
  { workOrderId: 'WO-1007', assetId: 'ATC-ZC-02', workType: 'PM', status: 'COMP', reportedAt: '2026-08-12T07:00:00Z', targetStartAt: '2026-08-14T00:00:00Z', actualStartAt: '2026-08-13T08:00:00Z', completedAt: '2026-08-13T11:00:00Z', downtimeMinutes: 0 },
  { workOrderId: 'WO-1008', assetId: 'TRAM-APS-03', workType: 'PM', status: 'COMP', reportedAt: '2026-08-18T07:00:00Z', targetStartAt: '2026-08-20T00:00:00Z', actualStartAt: '2026-08-19T08:00:00Z', completedAt: '2026-08-19T12:30:00Z', downtimeMinutes: 0 },
];

const evidence: readonly EvidenceRef[] = DEMO_WORK_ORDERS.map((wo) => ({
  sourceSystem: 'maximo',
  entityType: 'work-order',
  entityId: wo.workOrderId,
  observedAt: wo.reportedAt ?? periodEnd,
}));

const kpis = DEMO_KPI_DEFINITIONS.map((definition) => computeKpiObservation(definition, {
  periodStart,
  periodEnd,
  plannedServiceMinutes: 31 * 24 * 60,
  workOrders: DEMO_WORK_ORDERS,
}, evidence));

export const DEMO_REPORT = buildReportPackage({
  reportId: 'DEMO-2026-08',
  cadence: 'monthly',
  contractId: 'DEMO-CONTRACT',
  periodStart,
  periodEnd,
  kpis,
  priorBreachesByKpi: { mttr: 2 },
});

export const DEMO_SUMMARY = deterministicExecutiveSummary(DEMO_REPORT);

export const DEMO_ASSETS: readonly MaximoAssetRecord[] = [
  { assetId: 'ATC-ZC-01', name: 'Zone controller 01', assetClass: 'Signalling / ATC', location: 'Metro line', status: 'OPERATING', criticality: 'high' },
  { assetId: 'ATC-ZC-02', name: 'Zone controller 02', assetClass: 'Signalling / ATC', location: 'Metro line', status: 'OPERATING', criticality: 'high' },
  { assetId: 'TRAM-APS-03', name: 'APS segment 03', assetClass: 'Traction power', location: 'Tram', status: 'OPERATING', criticality: 'medium' },
];

/** Everything the synthetic provider serves, in one place. */
export const DEMO_PM_RECORDS: readonly MaximoPmRecord[] = [
  { pmId: 'PM-ATC-01', assetId: 'ATC-ZC-01', frequency: 90, frequencyUnit: 'DAYS', lastCompletedAt: '2026-05-20T00:00:00Z', nextDueAt: '2026-08-18T00:00:00Z', status: 'ACTIVE' },
  { pmId: 'PM-ATC-02', assetId: 'ATC-ZC-02', frequency: 90, frequencyUnit: 'DAYS', lastCompletedAt: '2026-03-01T00:00:00Z', nextDueAt: '2026-05-30T00:00:00Z', status: 'ACTIVE' },
  { pmId: 'PM-APS-03', assetId: 'TRAM-APS-03', frequency: 4, frequencyUnit: 'MONTHS', lastCompletedAt: '2026-07-15T00:00:00Z', nextDueAt: '2026-11-15T00:00:00Z', status: 'ACTIVE' },
];

/** DEMO ONLY invoices served through the finance port. Amounts are synthetic and carry no currency semantics. */
export const DEMO_INVOICES: readonly MaximoInvoiceRecord[] = [
  { invoiceId: 'INV-2026-08-01', contractId: 'DEMO-CONTRACT', vendorId: 'VENDOR-DEMO', status: 'APPR', invoiceDate: '2026-08-05T00:00:00Z', grossAmount: 125000, approvedAmount: 125000, currency: 'AED', workflowState: 'PAID' },
  { invoiceId: 'INV-2026-08-02', contractId: 'DEMO-CONTRACT', vendorId: 'VENDOR-DEMO', status: 'WAPPR', invoiceDate: '2026-08-20T00:00:00Z', grossAmount: 98000, approvedAmount: 0, currency: 'AED', workflowState: 'REVIEW' },
  { invoiceId: 'INV-2026-08-03', contractId: 'DEMO-CONTRACT', vendorId: 'VENDOR-DEMO', status: 'HOLD', invoiceDate: '2026-08-28T00:00:00Z', grossAmount: 41000, approvedAmount: 0, currency: 'AED', workflowState: 'DISPUTED' },
];

/** DEMO ONLY condition profiles (synthetic health indices and signals). */
export const DEMO_CONDITION_PROFILES: readonly AssetConditionProfile[] = [
  { assetId: 'ATC-ZC-01', healthIndex: 72, healthIndex90dAgo: 78, signals: [{ name: 'Communication retry rate', changePct: 14, weight: 0.7 }], serviceCritical: true, section: 'Red Line', observedAt: '2026-09-01T00:00:00Z', evidence: { sourceSystem: 'condition_monitoring', entityType: 'condition-profile', entityId: 'CM-ATC-ZC-01', observedAt: '2026-09-01T00:00:00Z' } },
  { assetId: 'ATC-ZC-02', healthIndex: 49, healthIndex90dAgo: 70, signals: [{ name: 'Processor temperature', changePct: 31, weight: 0.9 }, { name: 'Communication retry rate', changePct: 22, weight: 0.7 }], serviceCritical: true, section: 'Red Line', observedAt: '2026-09-01T00:00:00Z', evidence: { sourceSystem: 'condition_monitoring', entityType: 'condition-profile', entityId: 'CM-ATC-ZC-02', observedAt: '2026-09-01T00:00:00Z' } },
  { assetId: 'TRAM-APS-03', healthIndex: 61, healthIndex90dAgo: 66, signals: [{ name: 'Segment insulation resistance', changePct: 18, weight: 0.8 }], serviceCritical: true, section: 'Dubai Tram', observedAt: '2026-09-01T00:00:00Z', evidence: { sourceSystem: 'condition_monitoring', entityType: 'condition-profile', entityId: 'CM-TRAM-APS-03', observedAt: '2026-09-01T00:00:00Z' } },
];

/** Demo scope used by the composition root when a task carries no explicit scope. */
export const DEMO_SCOPE = { contractId: 'DEMO-CONTRACT', periodStart, periodEnd, priorBreachesByKpi: { mttr: 2 } } as const;

const plannedServiceMinutesPerPeriod = (start: string, end: string): number => Math.max(1, Math.round((Date.parse(end) - Date.parse(start)) / 60_000));

/** DEMO ONLY approved-definition set served through the contract port. */
export const DEMO_CONTRACT_KPI_SET: ContractKpiSet = {
  contractId: 'DEMO-CONTRACT',
  definitionVersion: 'demo-v1',
  approvalStatus: 'demo_only',
  definitions: DEMO_KPI_DEFINITIONS,
  plannedServiceMinutesPerPeriod,
  assetIds: DEMO_ASSETS.map((asset) => asset.assetId),
  evidence: { sourceSystem: 'contract_repository', entityType: 'kpi-definition-set', entityId: 'DEMO-CONTRACT/demo-v1', observedAt: periodStart },
};

/*
 * Multi-report and multi-contract demo. A second package for the same
 * contract (quarterly, Q3 2026, computed from the same synthetic orders) and
 * a second synthetic contract with its own assets, orders and definition
 * set. The second contract exists so scope enforcement can be demonstrated:
 * a principal scoped to one contract never sees the other.
 */
const quarterStart = '2026-07-01T00:00:00Z';
const quarterEnd = '2026-09-30T23:59:59Z';

export const DEMO_QUARTERLY_REPORT = buildReportPackage({
  reportId: 'DEMO-2026-Q3',
  cadence: 'quarterly',
  contractId: 'DEMO-CONTRACT',
  periodStart: quarterStart,
  periodEnd: quarterEnd,
  kpis: DEMO_KPI_DEFINITIONS.map((definition) => computeKpiObservation(definition, { periodStart: quarterStart, periodEnd: quarterEnd, plannedServiceMinutes: plannedServiceMinutesPerPeriod(quarterStart, quarterEnd), workOrders: DEMO_WORK_ORDERS }, evidence)),
  priorBreachesByKpi: { mttr: 2 },
});

export const DEMO_OTHER_ASSETS: readonly MaximoAssetRecord[] = [
  { assetId: 'ATC-ZC-11', name: 'Zone controller 11', assetClass: 'Signalling / ATC', location: 'Metro line', status: 'OPERATING', criticality: 'high' },
  { assetId: 'SCADA-RTU-12', name: 'SCADA RTU 12', assetClass: 'SCADA', location: 'Metro line', status: 'OPERATING', criticality: 'medium' },
];

export const DEMO_OTHER_WORK_ORDERS: readonly MaximoWorkOrderRecord[] = [
  { workOrderId: 'WO-2001', assetId: 'ATC-ZC-11', workType: 'CM', status: 'COMP', reportedAt: '2026-08-06T05:00:00Z', actualStartAt: '2026-08-06T05:15:00Z', completedAt: '2026-08-06T06:45:00Z', downtimeMinutes: 90, failureCode: 'COMM' },
  { workOrderId: 'WO-2002', assetId: 'SCADA-RTU-12', workType: 'CM', status: 'COMP', reportedAt: '2026-08-19T14:00:00Z', actualStartAt: '2026-08-19T14:20:00Z', completedAt: '2026-08-19T15:05:00Z', downtimeMinutes: 45, failureCode: 'HW' },
  { workOrderId: 'WO-2003', assetId: 'ATC-ZC-11', workType: 'PM', status: 'COMP', reportedAt: '2026-08-11T07:00:00Z', targetStartAt: '2026-08-13T00:00:00Z', actualStartAt: '2026-08-12T08:00:00Z', completedAt: '2026-08-12T10:00:00Z', downtimeMinutes: 0 },
];

export const DEMO_OTHER_SCOPE = { contractId: 'OTHER-CONTRACT', periodStart, periodEnd } as const;

export const DEMO_OTHER_CONTRACT_KPI_SET: ContractKpiSet = {
  contractId: 'OTHER-CONTRACT',
  definitionVersion: 'demo-v1',
  approvalStatus: 'demo_only',
  definitions: DEMO_KPI_DEFINITIONS,
  plannedServiceMinutesPerPeriod,
  assetIds: DEMO_OTHER_ASSETS.map((asset) => asset.assetId),
  evidence: { sourceSystem: 'contract_repository', entityType: 'kpi-definition-set', entityId: 'OTHER-CONTRACT/demo-v1', observedAt: periodStart },
};

export const DEMO_OTHER_REPORT = buildReportPackage({
  reportId: 'OTHER-2026-08',
  cadence: 'monthly',
  contractId: 'OTHER-CONTRACT',
  periodStart,
  periodEnd,
  kpis: DEMO_KPI_DEFINITIONS.map((definition) => computeKpiObservation(definition, { periodStart, periodEnd, plannedServiceMinutes: plannedServiceMinutesPerPeriod(periodStart, periodEnd), workOrders: DEMO_OTHER_WORK_ORDERS }, DEMO_OTHER_WORK_ORDERS.map((wo) => ({ sourceSystem: 'maximo', entityType: 'work-order', entityId: wo.workOrderId, observedAt: wo.reportedAt ?? periodEnd })))),
});

/**
 * DEMO ONLY contract digital twin. Clause references, obligations, due rules
 * and consequences are synthetic placeholders that exercise the twin
 * evaluation; none of them is an RTA or contractual term.
 */
export const DEMO_CONTRACT_TWIN: ContractTwin = {
  contractId: 'DEMO-CONTRACT',
  twinVersion: 'demo-twin-v1',
  approvalStatus: 'demo_only',
  title: 'Demo maintenance services agreement (synthetic)',
  parties: { owner: 'Demo asset owner', contractor: 'Demo maintenance contractor' },
  term: { start: '2026-01-01T00:00:00Z', end: '2028-12-31T23:59:59Z' },
  obligations: [
    { obligationId: 'OBL-AVAIL', clauseRef: 'Demo clause 12.1', kind: 'kpi', title: 'Service availability', description: 'Maintain service availability at or above the demo threshold each reporting period.', owner: 'contractor', kpiIds: ['availability'], evidenceRules: ['Maximo work orders with downtime minutes', 'Approved planned service minutes for the period'], consequence: 'Demo service credit per breached period (synthetic).', effectiveFrom: '2026-01-01T00:00:00Z' },
    { obligationId: 'OBL-RELIAB', clauseRef: 'Demo clause 12.2', kind: 'kpi', title: 'Reliability and repair time', description: 'Keep MTBF above and MTTR below the demo thresholds.', owner: 'contractor', kpiIds: ['mtbf', 'mttr'], evidenceRules: ['Corrective work orders with reported, start and completion timestamps'], consequence: 'Demo remediation plan within 10 days of a breach (synthetic).', effectiveFrom: '2026-01-01T00:00:00Z' },
    { obligationId: 'OBL-PM', clauseRef: 'Demo clause 14.3', kind: 'kpi', title: 'Preventive maintenance compliance', description: 'Complete scheduled preventive maintenance within its target window.', owner: 'contractor', kpiIds: ['pm_compliance'], evidenceRules: ['Preventive work orders with target start and completion timestamps'], effectiveFrom: '2026-01-01T00:00:00Z' },
    { obligationId: 'OBL-BACKLOG', clauseRef: 'Demo clause 14.5', kind: 'kpi', title: 'Backlog and failure count', description: 'Keep the open backlog and the failure count within the demo limits.', owner: 'contractor', kpiIds: ['backlog', 'failures'], evidenceRules: ['Open work orders at period close', 'Corrective work orders in the period'], effectiveFrom: '2026-01-01T00:00:00Z' },
    { obligationId: 'OBL-EVIDENCE', clauseRef: 'Demo clause 20.1', kind: 'evidence', title: 'Evidence retention', description: 'Retain source records for every reported KPI and make them available on request.', owner: 'contractor', evidenceRules: ['Work order history retained for the contract term'], effectiveFrom: '2026-01-01T00:00:00Z' },
    { obligationId: 'OBL-REVIEW', clauseRef: 'Demo clause 21.2', kind: 'response', title: 'Owner review response', description: 'Respond to owner review comments on a report package within 5 working days.', owner: 'contractor', evidenceRules: ['Dated review comment sheet and response'], effectiveFrom: '2026-01-01T00:00:00Z' },
    { obligationId: 'OBL-FUTURE', clauseRef: 'Demo clause 30.1', kind: 'kpi', title: 'Future obligation (not yet effective)', description: 'A demo obligation that starts after the evaluated period, to show effectivity handling.', owner: 'contractor', kpiIds: ['availability'], evidenceRules: [], effectiveFrom: '2027-01-01T00:00:00Z' },
  ],
  reportingDuties: [
    { dutyId: 'DUTY-MONTHLY', clauseRef: 'Demo clause 18.1', cadence: 'monthly', title: 'Monthly performance report', dueDaysAfterPeriodEnd: 10, requiredContents: ['KPI results with evidence references', 'Exceptions and decisions required', 'Named approval'], recipients: ['Demo asset owner'] },
    { dutyId: 'DUTY-QUARTERLY', clauseRef: 'Demo clause 18.2', cadence: 'quarterly', title: 'Quarterly executive review', dueDaysAfterPeriodEnd: 20, requiredContents: ['Trend across the quarter', 'Remediation status'], recipients: ['Demo asset owner', 'Demo steering committee'] },
  ],
  evidence: { sourceSystem: 'contract_repository', entityType: 'contract-twin', entityId: 'DEMO-CONTRACT/demo-twin-v1', observedAt: periodStart, sourceUri: 'synthetic://contract_repository/contract-twin/DEMO-CONTRACT' },
};

/** Everything the synthetic providers serve for both demo contracts. */
export const DEMO_DATASET: SyntheticDataset = {
  assets: [...DEMO_ASSETS, ...DEMO_OTHER_ASSETS],
  workOrders: [...DEMO_WORK_ORDERS, ...DEMO_OTHER_WORK_ORDERS],
  preventiveMaintenance: DEMO_PM_RECORDS,
  conditionProfiles: DEMO_CONDITION_PROFILES,
  kpiSets: [DEMO_CONTRACT_KPI_SET, DEMO_OTHER_CONTRACT_KPI_SET],
  invoices: DEMO_INVOICES,
  twins: [DEMO_CONTRACT_TWIN],
};

/** Packages the demo deployment serves; the first is the default package. */
export const DEMO_REPORT_REGISTRATIONS: readonly ReportRegistration[] = [
  { seed: DEMO_REPORT, priorBreachesByKpi: DEMO_SCOPE.priorBreachesByKpi },
  { seed: DEMO_QUARTERLY_REPORT, priorBreachesByKpi: DEMO_SCOPE.priorBreachesByKpi },
  { seed: DEMO_OTHER_REPORT },
];
