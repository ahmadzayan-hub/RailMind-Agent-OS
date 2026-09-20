import type { EvidenceRef } from '../../agent-os/contracts.ts';
import type { GovernedKpiDefinition } from '../../kpi/registry.ts';
import type { ContractTwin } from '../../contract-twin/contracts.ts';

/**
 * Contract context port. Approved contract documents remain authoritative;
 * RailMind reads KPI definitions, reporting duties and evidence rules from an
 * approved repository and never redefines them.
 */
export interface ContractKpiSet {
  contractId: string;
  /** Version of the approved definition set, e.g. a document revision. */
  definitionVersion: string;
  /** Governance status of the definition set. Production readiness requires 'approved'. */
  approvalStatus?: 'approved' | 'draft' | 'unapproved' | 'demo_only';
  definitions: readonly GovernedKpiDefinition[];
  /** Planned service minutes per reporting period, as defined by the contract. */
  plannedServiceMinutesPerPeriod: (periodStart: string, periodEnd: string) => number;
  /** In-scope asset ids for KPI calculation. */
  assetIds: readonly string[];
  evidence: EvidenceRef;
}

export interface ContractReadPort {
  getKpiSet(contractId: string): Promise<ContractKpiSet | null>;
  /** The contract digital twin (obligations, reporting duties, evidence rules), when the repository publishes one. Read-only. */
  getTwin(contractId: string): Promise<ContractTwin | null>;
}

export class InMemoryContractReadPort implements ContractReadPort {
  readonly #sets: Map<string, ContractKpiSet>;
  readonly #twins: Map<string, ContractTwin>;

  constructor(sets: readonly ContractKpiSet[], twins: readonly ContractTwin[] = []) {
    this.#sets = new Map(sets.map((set) => [set.contractId, set]));
    this.#twins = new Map(twins.map((twin) => [twin.contractId, twin]));
  }

  async getKpiSet(contractId: string): Promise<ContractKpiSet | null> {
    return this.#sets.get(contractId) ?? null;
  }

  async getTwin(contractId: string): Promise<ContractTwin | null> {
    return this.#twins.get(contractId) ?? null;
  }
}
