import type { SourceSystem } from '../agent-os/contracts.ts';
import type { AssetConditionProfile } from '../connectors/condition/port.ts';
import type { ContractKpiSet } from '../connectors/contract/port.ts';
import type { MaximoAssetRecord, MaximoInvoiceRecord, MaximoPmRecord, MaximoWorkOrderRecord } from '../connectors/maximo/port.ts';

/**
 * Data provider architecture.
 *
 * A provider delivers records with provenance. The synthetic provider serves
 * the public demo; production providers wrap live read-only integrations and
 * fail closed: an unavailable source throws, it never falls back to synthetic
 * data. The composition root refuses to mix modes.
 */
export type ProviderMode = 'synthetic' | 'production';
export type QualityState = 'verified' | 'provisional' | 'rejected';

export interface Provenance {
  sourceSystem: SourceSystem;
  sourceEntityType: string;
  sourceRecordId: string;
  observedAt: string;
  ingestedAt: string;
  qualityState: QualityState;
  sourceUri?: string;
  snapshotHash?: string;
}

export interface ProvidedRecord<T> {
  value: T;
  provenance: Provenance;
}

export interface ScopeQuery {
  contractId: string;
  periodStart: string;
  periodEnd: string;
  /** Explicit asset ids; when absent the contract's in-scope assets are used. */
  assetIds?: readonly string[];
}

export interface MaintenanceDataProvider {
  readonly id: string;
  readonly mode: ProviderMode;
  listAssets(assetIds: readonly string[]): Promise<readonly ProvidedRecord<MaximoAssetRecord>[]>;
  listWorkOrders(assetIds: readonly string[], since: string): Promise<readonly ProvidedRecord<MaximoWorkOrderRecord>[]>;
  listPreventiveMaintenance(assetIds: readonly string[]): Promise<readonly ProvidedRecord<MaximoPmRecord>[]>;
}

export interface ContractDataProvider {
  readonly id: string;
  readonly mode: ProviderMode;
  getKpiSet(contractId: string): Promise<ProvidedRecord<ContractKpiSet> | null>;
}

export interface ConditionDataProvider {
  readonly id: string;
  readonly mode: ProviderMode;
  listProfiles(assetIds: readonly string[]): Promise<readonly ProvidedRecord<AssetConditionProfile>[]>;
}

export interface FinanceDataProvider {
  readonly id: string;
  readonly mode: ProviderMode;
  listInvoices(contractId: string, since?: string): Promise<readonly ProvidedRecord<MaximoInvoiceRecord>[]>;
}

export interface DataProviders {
  mode: ProviderMode;
  maintenance: MaintenanceDataProvider;
  contract: ContractDataProvider;
  condition: ConditionDataProvider;
  finance: FinanceDataProvider;
}

export class ProviderModeError extends Error {}

/** Refuses a provider set that mixes synthetic and production sources. */
export function assertConsistentMode(providers: DataProviders): void {
  const modes = new Set([providers.maintenance.mode, providers.contract.mode, providers.condition.mode, providers.finance.mode]);
  if (modes.size > 1) {
    throw new ProviderModeError(`Providers mix modes (${[...modes].join(', ')}); synthetic and production data must never mix.`);
  }
  const [only] = [...modes];
  if (only !== providers.mode) {
    throw new ProviderModeError(`Provider set declares mode ${providers.mode} but its providers are ${only}.`);
  }
}

export class SourceUnavailableError extends Error {
  readonly sourceSystem: SourceSystem;
  constructor(sourceSystem: SourceSystem, message: string) {
    super(message);
    this.name = 'SourceUnavailableError';
    this.sourceSystem = sourceSystem;
  }
}

/** Deterministic content hash for provenance snapshots. */
export async function snapshotHash(value: unknown): Promise<string> {
  const bytes = new TextEncoder().encode(JSON.stringify(value));
  const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
