import type { EvidenceRef } from '../../agent-os/contracts.ts';
import { validateDefinition, type GovernedKpiDefinition } from '../../kpi/registry.ts';
import { InMemoryContractReadPort, type ContractKpiSet, type ContractReadPort } from './port.ts';
import { validateTwin, type ContractTwin } from '../../contract-twin/contracts.ts';

/**
 * Contract repository document adapter.
 *
 * An approved contract repository exports its KPI definition sets as a JSON
 * document (one file per deployment, versioned with the contract). The host
 * reads the file and hands the parsed JSON to this parser, so the domain
 * layer never touches the filesystem. Every definition is validated by the
 * KPI authority registry rules; in production every set must be approved.
 */
export const CONTRACT_REPOSITORY_SCHEMA = 'railmind.contract-kpi-sets/1';

export interface ContractRepositorySetDocument {
  contractId: string;
  definitionVersion: string;
  approvalStatus: NonNullable<ContractKpiSet['approvalStatus']>;
  /** Planned service minutes per calendar day; the port derives the period figure. */
  plannedServiceMinutesPerDay: number;
  assetIds: readonly string[];
  definitions: readonly GovernedKpiDefinition[];
  /** Where the set came from and when it was observed there. */
  source: { uri?: string; observedAt: string; snapshotHash?: string };
}

/** A twin as the repository exports it: the twin fields plus where it came from. */
export interface ContractRepositoryTwinDocument extends Omit<ContractTwin, 'evidence'> {
  source: { uri?: string; observedAt: string; snapshotHash?: string };
}

export interface ContractRepositoryDocument {
  schema: typeof CONTRACT_REPOSITORY_SCHEMA;
  sets: readonly ContractRepositorySetDocument[];
  /** Optional contract digital twins, one per contract. */
  twins?: readonly ContractRepositoryTwinDocument[];
}

export class ContractRepositoryDocumentError extends Error {}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function requireString(record: Record<string, unknown>, key: string, where: string): string {
  const value = record[key];
  if (typeof value !== 'string' || value.trim().length === 0) throw new ContractRepositoryDocumentError(`${where}: ${key} is required.`);
  return value;
}

const APPROVAL: readonly NonNullable<ContractKpiSet['approvalStatus']>[] = ['approved', 'draft', 'unapproved', 'demo_only'];

/** Parses and validates a contract repository document into port-ready KPI sets. */
export function parseContractRepositoryDocument(json: unknown): readonly ContractKpiSet[] {
  if (!isObject(json)) throw new ContractRepositoryDocumentError('Contract repository document must be a JSON object.');
  if (json.schema !== CONTRACT_REPOSITORY_SCHEMA) throw new ContractRepositoryDocumentError(`Contract repository document schema must be "${CONTRACT_REPOSITORY_SCHEMA}".`);
  if (!Array.isArray(json.sets) || json.sets.length === 0) throw new ContractRepositoryDocumentError('Contract repository document must contain at least one set.');
  const seen = new Set<string>();
  return json.sets.map((raw, index) => {
    const where = `set[${index}]`;
    if (!isObject(raw)) throw new ContractRepositoryDocumentError(`${where} must be an object.`);
    const contractId = requireString(raw, 'contractId', where);
    const definitionVersion = requireString(raw, 'definitionVersion', where);
    const approvalStatus = raw.approvalStatus;
    if (typeof approvalStatus !== 'string' || !(APPROVAL as readonly string[]).includes(approvalStatus)) throw new ContractRepositoryDocumentError(`${where} (${contractId}): approvalStatus must be one of ${APPROVAL.join(', ')}.`);
    const perDay = raw.plannedServiceMinutesPerDay;
    if (typeof perDay !== 'number' || !Number.isFinite(perDay) || perDay <= 0 || perDay > 24 * 60) throw new ContractRepositoryDocumentError(`${where} (${contractId}): plannedServiceMinutesPerDay must be a number between 1 and 1440.`);
    if (!Array.isArray(raw.assetIds) || raw.assetIds.length === 0 || !raw.assetIds.every((id) => typeof id === 'string' && id.trim())) throw new ContractRepositoryDocumentError(`${where} (${contractId}): assetIds must be a non-empty list of ids.`);
    if (!Array.isArray(raw.definitions) || raw.definitions.length === 0) throw new ContractRepositoryDocumentError(`${where} (${contractId}): definitions must be a non-empty list.`);
    const source = raw.source;
    if (!isObject(source) || typeof source.observedAt !== 'string' || Number.isNaN(Date.parse(source.observedAt))) throw new ContractRepositoryDocumentError(`${where} (${contractId}): source.observedAt must be a timestamp.`);
    const key = `${contractId}/${definitionVersion}`;
    if (seen.has(key)) throw new ContractRepositoryDocumentError(`Duplicate set ${key}.`);
    seen.add(key);
    const ids = new Set<string>();
    const definitions = raw.definitions.map((candidate, dIndex) => {
      if (!isObject(candidate)) throw new ContractRepositoryDocumentError(`${where} (${contractId}) definition[${dIndex}] must be an object.`);
      const definition = candidate as unknown as GovernedKpiDefinition;
      const problems = validateDefinition(definition);
      if (problems.length > 0) throw new ContractRepositoryDocumentError(`${where} (${contractId}) definition ${String(definition.id)}: ${problems.join('; ')}.`);
      if (definition.authority.contractId !== undefined && definition.authority.contractId !== contractId) throw new ContractRepositoryDocumentError(`${where} (${contractId}) definition ${definition.id}: authority.contractId must equal the set contractId.`);
      if (ids.has(definition.id)) throw new ContractRepositoryDocumentError(`${where} (${contractId}) definition ${definition.id} is duplicated.`);
      ids.add(definition.id);
      if (approvalStatus === 'approved' && definition.approvalStatus !== 'approved') throw new ContractRepositoryDocumentError(`${where} (${contractId}) definition ${definition.id} is ${definition.approvalStatus}; an approved set may contain approved definitions only.`);
      return definition;
    });
    const evidence: EvidenceRef = { sourceSystem: 'contract_repository', entityType: 'kpi-definition-set', entityId: key, observedAt: source.observedAt, sourceUri: typeof source.uri === 'string' ? source.uri : undefined, snapshotHash: typeof source.snapshotHash === 'string' ? source.snapshotHash : undefined };
    return {
      contractId,
      definitionVersion,
      approvalStatus: approvalStatus as ContractKpiSet['approvalStatus'],
      definitions,
      plannedServiceMinutesPerPeriod: (start: string, end: string) => Math.max(1, Math.round(((Date.parse(end) - Date.parse(start)) / 86_400_000) * perDay)),
      assetIds: raw.assetIds as string[],
      evidence,
    } satisfies ContractKpiSet;
  });
}

/** Parses and validates the optional twins of a repository document. */
export function parseContractRepositoryTwins(json: unknown): readonly ContractTwin[] {
  if (!isObject(json) || json.twins === undefined) return [];
  if (!Array.isArray(json.twins)) throw new ContractRepositoryDocumentError('Contract repository twins must be a list.');
  const seen = new Set<string>();
  return json.twins.map((raw, index) => {
    const where = `twin[${index}]`;
    if (!isObject(raw)) throw new ContractRepositoryDocumentError(`${where} must be an object.`);
    const source = raw.source;
    if (!isObject(source) || typeof source.observedAt !== 'string' || Number.isNaN(Date.parse(source.observedAt))) throw new ContractRepositoryDocumentError(`${where}: source.observedAt must be a timestamp.`);
    const { source: _source, ...rest } = raw;
    const contractId = typeof rest.contractId === 'string' ? rest.contractId : '?';
    const twin: ContractTwin = {
      ...(rest as unknown as Omit<ContractTwin, 'evidence'>),
      obligations: Array.isArray(rest.obligations) ? rest.obligations as ContractTwin['obligations'] : [],
      reportingDuties: Array.isArray(rest.reportingDuties) ? rest.reportingDuties as ContractTwin['reportingDuties'] : [],
      evidence: { sourceSystem: 'contract_repository', entityType: 'contract-twin', entityId: `${contractId}/${String(rest.twinVersion)}`, observedAt: source.observedAt, sourceUri: typeof source.uri === 'string' ? source.uri : undefined, snapshotHash: typeof source.snapshotHash === 'string' ? source.snapshotHash : undefined },
    };
    const problems = validateTwin(twin);
    if (problems.length > 0) throw new ContractRepositoryDocumentError(`${where} (${contractId}): ${problems.join('; ')}.`);
    if (seen.has(twin.contractId)) throw new ContractRepositoryDocumentError(`Duplicate twin for contract ${twin.contractId}.`);
    seen.add(twin.contractId);
    return twin;
  });
}

/** Read port over a parsed repository document. */
export function createDocumentContractReadPort(json: unknown): ContractReadPort & { readonly sets: readonly ContractKpiSet[]; readonly twins: readonly ContractTwin[] } {
  const sets = parseContractRepositoryDocument(json);
  const twins = parseContractRepositoryTwins(json);
  const port = new InMemoryContractReadPort(sets, twins);
  return { sets, twins, getKpiSet: (contractId) => port.getKpiSet(contractId), getTwin: (contractId) => port.getTwin(contractId) };
}
