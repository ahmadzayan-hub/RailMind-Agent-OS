import type { ConditionReadPort } from '../connectors/condition/port.ts';
import type { ContractReadPort } from '../connectors/contract/port.ts';
import type { MaximoReadPort } from '../connectors/maximo/port.ts';
import type { MemoryKind, MemoryStore } from './memory.ts';
import { ToolRegistry } from './tools.ts';

/**
 * Standard read-only tools bound to the ports of a deployment. Tool ids match
 * the ids referenced by AGENT_CATALOG. Tools that have no port in a deployment
 * are simply not registered, so a plan that lists them fails closed.
 */
export type MaximoReadInput =
  | { kind: 'asset'; assetId: string }
  | { kind: 'workOrders'; assetId: string; since?: string }
  | { kind: 'preventiveMaintenance'; assetId: string }
  | { kind: 'meters'; assetId: string; since?: string }
  | { kind: 'invoices'; contractId: string; since?: string };

export interface ContractReadInput { contractId: string; /** 'kpiSet' (default) or the contract digital twin. */ kind?: 'kpiSet' | 'twin' }
export interface FinanceReadInput { contractId: string; since?: string }
export interface MemoryReadInput { taskId?: string; kind?: MemoryKind }
export type ConditionReadInput = { kind: 'profile'; assetId: string } | { kind: 'assetIds' };

export interface StandardToolPorts {
  maximo?: MaximoReadPort;
  contract?: ContractReadPort;
  condition?: ConditionReadPort;
  memory?: MemoryStore;
}

export function buildStandardTools(ports: StandardToolPorts): ToolRegistry {
  const registry = new ToolRegistry();
  const maximo = ports.maximo;
  if (maximo) {
    registry.register<MaximoReadInput, unknown>({
      id: 'maximo.read',
      description: 'Read-only access to Maximo assets, work orders, PM, meters and invoices.',
      readOnly: true,
      summarise: (input) => `${input.kind} ${'assetId' in input ? input.assetId : input.contractId}${'since' in input && input.since ? ` since ${input.since}` : ''}`,
      invoke: async (input) => {
        switch (input.kind) {
          case 'asset': return maximo.getAsset(input.assetId);
          case 'workOrders': return maximo.listWorkOrders(input.assetId, input.since);
          case 'preventiveMaintenance': return maximo.listPreventiveMaintenance(input.assetId);
          case 'meters': return maximo.listMeterReadings(input.assetId, input.since);
          case 'invoices': return maximo.listInvoices(input.contractId, input.since);
        }
      },
    });
    registry.register<FinanceReadInput, unknown>({
      id: 'finance.read',
      description: 'Read-only invoice and workflow status through the Maximo finance objects.',
      readOnly: true,
      summarise: (input) => `invoices ${input.contractId}${input.since ? ` since ${input.since}` : ''}`,
      invoke: async (input) => maximo.listInvoices(input.contractId, input.since),
    });
  }
  const contract = ports.contract;
  if (contract) {
    registry.register<ContractReadInput, unknown>({
      id: 'contract.read',
      description: 'Approved contract KPI definitions, thresholds, scope and evidence rules; or the contract digital twin (obligations, reporting duties).',
      readOnly: true,
      summarise: (input) => `${input.kind === 'twin' ? 'twin' : 'kpi-set'} ${input.contractId}`,
      invoke: async (input) => (input.kind === 'twin' ? contract.getTwin(input.contractId) : contract.getKpiSet(input.contractId)),
    });
  }
  const condition = ports.condition;
  if (condition) {
    registry.register<ConditionReadInput, unknown>({
      id: 'condition.read',
      description: 'Read-only condition-monitoring profiles: health index, trend and condition signals.',
      readOnly: true,
      summarise: (input) => (input.kind === 'profile' ? `profile ${input.assetId}` : 'asset ids'),
      invoke: async (input) => (input.kind === 'profile' ? condition.getProfile(input.assetId) : condition.listAssetIds()),
    });
  }
  const memory = ports.memory;
  if (memory) {
    registry.register<MemoryReadInput, unknown>({
      id: 'memory.read',
      description: 'Read RailMind decision and episodic memory.',
      readOnly: true,
      summarise: (input) => `memory ${input.taskId ? `task ${input.taskId}` : `kind ${input.kind ?? 'decision'}`}`,
      invoke: async (input) => (input.taskId ? memory.byTask(input.taskId) : memory.byKind(input.kind ?? 'decision')),
    });
  }
  return registry;
}
