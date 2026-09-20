import type { EvidenceRef } from './agent-os/contracts.ts';
import type { AssetConditionProfile } from './connectors/condition/port.ts';
import type { ContractKpiSet } from './connectors/contract/port.ts';
import type { MaximoAssetRecord, MaximoInvoiceRecord, MaximoPmRecord, MaximoWorkOrderRecord } from './connectors/maximo/port.ts';
import { DEMO_KPI_DEFINITIONS } from './kpi/demo-definitions.ts';
import { computeKpiObservation } from './kpi/engine.ts';
import { buildReportPackage, deterministicExecutiveSummary } from './reporting/generator.ts';

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

/** DEMO ONLY approved-definition set served through the contract port. */
export const DEMO_CONTRACT_KPI_SET: ContractKpiSet = {
  contractId: 'DEMO-CONTRACT',
  definitionVersion: 'demo-v1',
  approvalStatus: 'demo_only',
  definitions: DEMO_KPI_DEFINITIONS,
  plannedServiceMinutesPerPeriod: (start, end) => Math.max(1, Math.round((Date.parse(end) - Date.parse(start)) / 60_000)),
  assetIds: DEMO_ASSETS.map((asset) => asset.assetId),
  evidence: { sourceSystem: 'contract_repository', entityType: 'kpi-definition-set', entityId: 'DEMO-CONTRACT/demo-v1', observedAt: periodStart },
};
