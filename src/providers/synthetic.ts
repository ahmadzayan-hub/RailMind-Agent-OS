import type { AssetConditionProfile } from '../connectors/condition/port.ts';
import type { ContractKpiSet } from '../connectors/contract/port.ts';
import type { ContractTwin } from '../contract-twin/contracts.ts';
import type { MaximoAssetRecord, MaximoInvoiceRecord, MaximoPmRecord, MaximoWorkOrderRecord } from '../connectors/maximo/port.ts';
import type { ConditionDataProvider, ContractDataProvider, DataProviders, FinanceDataProvider, MaintenanceDataProvider, Provenance } from './contracts.ts';

/**
 * Synthetic demo provider. Serves clearly labelled synthetic records with
 * provenance so the whole pipeline (readiness gate, engine, exceptions) runs
 * exactly as it would on production data.
 */
export interface SyntheticDataset {
  assets: readonly MaximoAssetRecord[];
  workOrders: readonly MaximoWorkOrderRecord[];
  preventiveMaintenance: readonly MaximoPmRecord[];
  conditionProfiles: readonly AssetConditionProfile[];
  kpiSets: readonly ContractKpiSet[];
  invoices?: readonly MaximoInvoiceRecord[];
  twins?: readonly ContractTwin[];
}

const INGESTED_AT = '2026-09-01T00:00:00Z';

function provenance(entityType: string, recordId: string, observedAt: string, sourceSystem: Provenance['sourceSystem'] = 'maximo'): Provenance {
  return { sourceSystem, sourceEntityType: entityType, sourceRecordId: recordId, observedAt, ingestedAt: INGESTED_AT, qualityState: 'verified', sourceUri: `synthetic://${sourceSystem}/${entityType}/${recordId}` };
}

export function createSyntheticProviders(dataset: SyntheticDataset): DataProviders {
  const maintenance: MaintenanceDataProvider = {
    id: 'synthetic-maximo',
    mode: 'synthetic',
    async listAssets(assetIds) {
      return dataset.assets.filter((a) => assetIds.includes(a.assetId)).map((a) => ({ value: a, provenance: provenance('asset', a.assetId, INGESTED_AT) }));
    },
    async listWorkOrders(assetIds, since) {
      return dataset.workOrders
        .filter((wo) => assetIds.includes(wo.assetId) && (!wo.reportedAt || wo.reportedAt >= since))
        .map((wo) => ({ value: wo, provenance: provenance('work-order', wo.workOrderId, wo.reportedAt ?? INGESTED_AT) }));
    },
    async listPreventiveMaintenance(assetIds) {
      return dataset.preventiveMaintenance.filter((pm) => assetIds.includes(pm.assetId)).map((pm) => ({ value: pm, provenance: provenance('pm', pm.pmId, pm.lastCompletedAt ?? INGESTED_AT) }));
    },
  };
  const contract: ContractDataProvider = {
    id: 'synthetic-contract',
    mode: 'synthetic',
    async getKpiSet(contractId) {
      const set = dataset.kpiSets.find((s) => s.contractId === contractId);
      return set ? { value: set, provenance: { ...provenance('kpi-definition-set', `${set.contractId}/${set.definitionVersion}`, set.evidence.observedAt, 'contract_repository'), qualityState: 'provisional' } } : null;
    },
    async getTwin(contractId) {
      const twin = (dataset.twins ?? []).find((t) => t.contractId === contractId);
      return twin ? { value: twin, provenance: { ...provenance('contract-twin', `${twin.contractId}/${twin.twinVersion}`, twin.evidence.observedAt, 'contract_repository'), qualityState: 'provisional' } } : null;
    },
  };
  const condition: ConditionDataProvider = {
    id: 'synthetic-condition',
    mode: 'synthetic',
    async listProfiles(assetIds) {
      return dataset.conditionProfiles.filter((p) => assetIds.includes(p.assetId)).map((p) => ({ value: p, provenance: provenance('condition-profile', p.evidence.entityId, p.observedAt, 'condition_monitoring') }));
    },
  };
  const finance: FinanceDataProvider = {
    id: 'synthetic-finance',
    mode: 'synthetic',
    async listInvoices(contractId, since) {
      return (dataset.invoices ?? []).filter((i) => i.contractId === contractId && (!since || !i.invoiceDate || i.invoiceDate >= since)).map((i) => ({ value: i, provenance: provenance('invoice', i.invoiceId, i.invoiceDate ?? INGESTED_AT, 'maximo_finance') }));
    },
  };
  return { mode: 'synthetic', maintenance, contract, condition, finance };
}
