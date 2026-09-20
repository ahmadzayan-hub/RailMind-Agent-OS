import type { AssetConditionProfile } from '../connectors/condition/port.ts';
import type { ContractReadPort } from '../connectors/contract/port.ts';
import type { MaximoReadPort } from '../connectors/maximo/port.ts';
import { SourceUnavailableError, snapshotHash, type ConditionDataProvider, type ContractDataProvider, type FinanceDataProvider, type MaintenanceDataProvider, type ProvidedRecord, type Provenance } from './contracts.ts';

/**
 * Production providers wrap live read-only ports. Any failure is surfaced as
 * SourceUnavailableError. There is no fallback path to synthetic data.
 */
export interface ProductionProviderOptions {
  now?: () => string;
}

async function withProvenance<T>(value: T, entityType: string, recordId: string, observedAt: string, sourceSystem: Provenance['sourceSystem'], now: () => string, quality: Provenance['qualityState'] = 'verified'): Promise<ProvidedRecord<T>> {
  return { value, provenance: { sourceSystem, sourceEntityType: entityType, sourceRecordId: recordId, observedAt, ingestedAt: now(), qualityState: quality, snapshotHash: await snapshotHash(value) } };
}

async function guarded<T>(sourceSystem: Provenance['sourceSystem'], operation: string, fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    throw new SourceUnavailableError(sourceSystem, `${sourceSystem} ${operation} failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

export function createMaximoReadProvider(port: MaximoReadPort, options: ProductionProviderOptions = {}): MaintenanceDataProvider & FinanceDataProvider {
  const now = options.now ?? (() => new Date().toISOString());
  return {
    id: 'maximo-rest',
    mode: 'production',
    async listAssets(assetIds) {
      const records = await Promise.all(assetIds.map((id) => guarded('maximo', `asset ${id}`, () => port.getAsset(id))));
      return Promise.all(records.flatMap((a) => (a ? [withProvenance(a, 'asset', a.assetId, now(), 'maximo', now)] : [])));
    },
    async listWorkOrders(assetIds, since) {
      const lists = await Promise.all(assetIds.map((id) => guarded('maximo', `work orders ${id}`, () => port.listWorkOrders(id, since))));
      return Promise.all(lists.flat().map((wo) => withProvenance(wo, 'work-order', wo.workOrderId, wo.reportedAt ?? now(), 'maximo', now, wo.reportedAt ? 'verified' : 'provisional')));
    },
    async listPreventiveMaintenance(assetIds) {
      const lists = await Promise.all(assetIds.map((id) => guarded('maximo', `pm ${id}`, () => port.listPreventiveMaintenance(id))));
      return Promise.all(lists.flat().map((pm) => withProvenance(pm, 'pm', pm.pmId, pm.lastCompletedAt ?? now(), 'maximo', now)));
    },
    async listInvoices(contractId, since) {
      const rows = await guarded('maximo_finance', `invoices ${contractId}`, () => port.listInvoices(contractId, since));
      return Promise.all(rows.map((i) => withProvenance(i, 'invoice', i.invoiceId, i.invoiceDate ?? now(), 'maximo_finance', now)));
    },
  };
}

export function createContractRepositoryProvider(port: ContractReadPort, options: ProductionProviderOptions = {}): ContractDataProvider {
  const now = options.now ?? (() => new Date().toISOString());
  return {
    id: 'contract-repository',
    mode: 'production',
    async getKpiSet(contractId) {
      const set = await guarded('contract_repository', `kpi set ${contractId}`, () => port.getKpiSet(contractId));
      return set ? withProvenance(set, 'kpi-definition-set', `${set.contractId}/${set.definitionVersion}`, set.evidence.observedAt, 'contract_repository', now) : null;
    },
    async getTwin(contractId) {
      const twin = await guarded('contract_repository', `twin ${contractId}`, () => port.getTwin(contractId));
      return twin ? withProvenance(twin, 'contract-twin', `${twin.contractId}/${twin.twinVersion}`, twin.evidence.observedAt, 'contract_repository', now) : null;
    },
  };
}

export interface ConditionMonitoringSource {
  listProfiles(assetIds: readonly string[]): Promise<readonly AssetConditionProfile[]>;
}

export function createConditionMonitoringProvider(source: ConditionMonitoringSource, options: ProductionProviderOptions = {}): ConditionDataProvider {
  const now = options.now ?? (() => new Date().toISOString());
  return {
    id: 'condition-monitoring',
    mode: 'production',
    async listProfiles(assetIds) {
      const rows = await guarded('condition_monitoring', 'profiles', () => source.listProfiles(assetIds));
      return Promise.all(rows.map((p) => withProvenance(p, 'condition-profile', p.evidence.entityId, p.observedAt, 'condition_monitoring', now)));
    },
  };
}
