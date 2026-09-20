import type { AgentRunRecord } from './contracts.ts';

/**
 * Run record store. Every governed run is written once and never mutated;
 * the audit trail and the ledger already hold the durable governance events,
 * and this store keeps the full run record reproducible after a restart.
 */
export interface RunStore {
  append(record: AgentRunRecord): Promise<void>;
  get(runId: string): Promise<AgentRunRecord | null>;
  all(): Promise<readonly AgentRunRecord[]>;
}

export class InMemoryRunStore implements RunStore {
  readonly #records = new Map<string, AgentRunRecord>();

  async append(record: AgentRunRecord): Promise<void> {
    if (this.#records.has(record.runId)) throw new Error(`Run ${record.runId} is already recorded; run records are immutable.`);
    this.#records.set(record.runId, record);
  }

  async get(runId: string): Promise<AgentRunRecord | null> {
    return this.#records.get(runId) ?? null;
  }

  async all(): Promise<readonly AgentRunRecord[]> {
    return [...this.#records.values()];
  }
}
