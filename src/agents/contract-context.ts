import type { EvidenceRef } from '../agent-os/contracts.ts';
import type { CapabilityHandler, CapabilityResult } from '../agent-os/handlers.ts';
import { ModelUnavailableError } from '../agent-os/model-guard.ts';
import type { ContractReadInput } from '../agent-os/standard-tools.ts';
import type { ContractKpiSet } from '../connectors/contract/port.ts';
import type { ContractTwin } from '../contract-twin/contracts.ts';
import type { GovernedKpiDefinition } from '../kpi/registry.ts';
import { resolveScope, type AnalysisScope } from './scope.ts';

/**
 * Contract Context Agent. Retrieves the approved KPI definitions, thresholds,
 * clause references, evidence rules and reporting duties for a contract
 * through contract.read only. It never redefines an obligation: every field
 * is copied from the approved definition set, and the set's approval status
 * is carried so a demo_only set can never be mistaken for a contractual one.
 * A model, when granted, may add a plain-language explanation labelled as
 * interpretation; it contributes no clause, threshold or date.
 */
export interface ContractDefinitionSummary {
  id: string;
  name: string;
  unit: string;
  formulaVersion: string;
  formulaKind: GovernedKpiDefinition['formulaKind'];
  threshold: number | null;
  direction: GovernedKpiDefinition['direction'] | null;
  clauseRef: string | null;
  effectiveFrom: string;
  effectiveTo: string | null;
  includedEvents: readonly string[];
  excludedEvents: readonly string[];
  requiredSourceFields: readonly string[];
  dataQualityRequirements: readonly string[];
  evidenceRules: readonly string[];
  owner: string;
  reviewer: string;
  approvalStatus: GovernedKpiDefinition['approvalStatus'];
}

export interface ContractContextValue {
  contractId: string;
  definitionVersion: string;
  approvalStatus: NonNullable<ContractKpiSet['approvalStatus']>;
  /** True only when the set and every definition are approved; demo sets are never contractual. */
  contractual: boolean;
  periodStart: string;
  periodEnd: string;
  plannedServiceMinutes: number;
  assetIds: readonly string[];
  definitions: readonly ContractDefinitionSummary[];
  /** Definitions in the set that are not effective for the requested period. */
  notEffective: readonly string[];
  /** Plain-language interpretation from a model, when one was granted. Never a fact source. */
  interpretation: string | null;
  /** The contract digital twin, copied from the repository when it publishes one. */
  twin: {
    twinVersion: string;
    approvalStatus: ContractTwin['approvalStatus'];
    contractual: boolean;
    title: string;
    parties: ContractTwin['parties'];
    term: ContractTwin['term'];
    obligations: ContractTwin['obligations'];
    reportingDuties: ContractTwin['reportingDuties'];
    /** Obligations binding KPIs that are not in the definition set. */
    unboundKpiIds: readonly string[];
  } | null;
}

export function summariseDefinition(definition: GovernedKpiDefinition): ContractDefinitionSummary {
  return {
    id: definition.id,
    name: definition.name,
    unit: definition.unit,
    formulaVersion: definition.formulaVersion,
    formulaKind: definition.formulaKind,
    threshold: definition.threshold ?? null,
    direction: definition.direction ?? null,
    clauseRef: definition.authority.clauseRef ?? definition.contractClauseRef ?? null,
    effectiveFrom: definition.effectiveFrom,
    effectiveTo: definition.effectiveTo ?? null,
    includedEvents: definition.includedEvents,
    excludedEvents: definition.excludedEvents,
    requiredSourceFields: definition.requiredSourceFields,
    dataQualityRequirements: definition.dataQualityRequirements,
    evidenceRules: definition.evidenceRules,
    owner: definition.owner,
    reviewer: definition.reviewer,
    approvalStatus: definition.approvalStatus,
  };
}

export function createContractContextHandler(defaults: AnalysisScope): CapabilityHandler<ContractContextValue> {
  return {
    capability: 'contract-context',
    async execute(context): Promise<CapabilityResult<ContractContextValue>> {
      const scope = resolveScope(context.task, defaults);
      const kpiSet = await context.tools.call<ContractReadInput, ContractKpiSet | null>('contract.read', { contractId: scope.contractId });
      if (!kpiSet) throw new Error(`No approved KPI definition set is available for contract ${scope.contractId}.`);
      const approvalStatus = kpiSet.approvalStatus ?? 'unapproved';
      const definitions = kpiSet.definitions.map(summariseDefinition);
      const notEffective = kpiSet.definitions.filter((d) => d.effectiveFrom > scope.periodStart || (d.effectiveTo !== undefined && d.effectiveTo < scope.periodEnd)).map((d) => d.id);
      const contractual = approvalStatus === 'approved' && kpiSet.definitions.every((d) => d.approvalStatus === 'approved');
      const twinRecord = await context.tools.call<ContractReadInput, ContractTwin | null>('contract.read', { contractId: scope.contractId, kind: 'twin' });
      const definitionIds = new Set(kpiSet.definitions.map((d) => d.id));
      const twin: ContractContextValue['twin'] = twinRecord ? {
        twinVersion: twinRecord.twinVersion,
        approvalStatus: twinRecord.approvalStatus,
        contractual: twinRecord.approvalStatus === 'approved',
        title: twinRecord.title,
        parties: twinRecord.parties,
        term: twinRecord.term,
        obligations: twinRecord.obligations,
        reportingDuties: twinRecord.reportingDuties,
        unboundKpiIds: [...new Set(twinRecord.obligations.flatMap((o) => o.kpiIds ?? []).filter((id) => !definitionIds.has(id)))],
      } : null;
      let interpretation: string | null = null;
      let modelUsed = false;
      let modelFailure: string | null = null;
      if (context.model) {
        try {
        const response = await context.model.generate({
          temperature: 0,
          maxTokens: 400,
          messages: [
            { role: 'system', content: 'You are RailMind Contract Context Agent. Explain the supplied KPI definitions in plain language for a maintenance manager. Use only the supplied fields. Do not add clauses, thresholds, dates or obligations. Label the text as interpretation.' },
            { role: 'user', content: JSON.stringify({ contractId: scope.contractId, definitionVersion: kpiSet.definitionVersion, approvalStatus, definitions }) },
          ],
        });
        interpretation = response.text;
        modelUsed = true;
        } catch (error) {
          if (!(error instanceof ModelUnavailableError)) throw error;
          modelFailure = error.message;
        }
      }
      const evidence: EvidenceRef[] = twinRecord ? [kpiSet.evidence, twinRecord.evidence] : [kpiSet.evidence];
      return {
        value: {
          contractId: scope.contractId,
          definitionVersion: kpiSet.definitionVersion,
          approvalStatus,
          contractual,
          periodStart: scope.periodStart,
          periodEnd: scope.periodEnd,
          plannedServiceMinutes: kpiSet.plannedServiceMinutesPerPeriod(scope.periodStart, scope.periodEnd),
          assetIds: kpiSet.assetIds,
          definitions,
          notEffective,
          interpretation,
          twin,
        },
        evidence,
        assumptions: [
          contractual ? `Definition set ${kpiSet.definitionVersion} is approved and contractual.` : `Definition set ${kpiSet.definitionVersion} is ${approvalStatus}; it is NOT a contractual authority and must not be cited as one.`,
          'Every field is copied from the approved definition set; nothing is derived or redefined here.',
          twin ? `Contract twin ${twin.twinVersion} is ${twin.approvalStatus}${twin.contractual ? '' : ' and is NOT a contractual authority'}; ${twin.obligations.length} obligation(s) and ${twin.reportingDuties.length} reporting dut(y/ies) copied without change.` : 'The contract repository publishes no digital twin for this contract; obligations and reporting duties are unavailable.',
          ...(twin && twin.unboundKpiIds.length > 0 ? [`Twin obligations bind KPI(s) ${twin.unboundKpiIds.join(', ')} that are not in the approved definition set.`] : []),
          ...(interpretation ? ['The interpretation text was drafted by a model and is not a source of contractual fact.'] : []),
          ...(modelFailure ? [`Model unavailable (${modelFailure}); no interpretation was drafted. The definitions above are unaffected.`] : []),
        ],
        modelUsed,
      };
    },
  };
}
