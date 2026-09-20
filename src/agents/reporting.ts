import type { CapabilityHandler, CapabilityResult } from '../agent-os/handlers.ts';
import type { ContractReadInput, KnowledgeReadInput, MemoryReadInput } from '../agent-os/standard-tools.ts';
import type { KnowledgeHit } from '../knowledge/contracts.ts';
import type { ContractKpiSet } from '../connectors/contract/port.ts';
import type { MemoryRecord } from '../agent-os/memory.ts';
import { ModelUnavailableError } from '../agent-os/model-guard.ts';
import { draftGroundedReportNarrative } from '../llm/report-narrative.ts';
import type { ReportCadence, ReportException, ReportPackage } from '../reporting/contracts.ts';
import { buildReportPackage, deterministicExecutiveSummary } from '../reporting/generator.ts';
import { gatherKpiEvidence } from './maintenance-kpi.ts';
import { resolveScope, type AnalysisScope } from './scope.ts';

/**
 * Reporting Agent. Builds the report package from deterministic facts, then
 * drafts narrative with the model only when the runtime granted one. The
 * narrative never introduces numbers that are not in the package.
 */
export interface ReportingCitation {
  ref: string;
  title: string;
  section: string | null;
  classification: KnowledgeHit['classification'];
}

export interface ReportingValue {
  report: ReportPackage;
  narrative: string;
  narrativeSource: 'model' | 'deterministic' | 'deterministic_fallback';
  /** Reference passages retrieved for the narrative (context for wording, never a fact source). */
  citations: readonly ReportingCitation[];
}

/** Query built from the package: the contract, the breached KPIs and the exception titles. */
export function knowledgeQueryFor(report: ReportPackage): string {
  const breached = report.kpis.filter((k) => k.status === 'breach').map((k) => `${k.definition.id} ${k.definition.name}`);
  return [report.contractId, ...breached, ...report.exceptions.map((x) => x.title)].join(' ');
}

function reportIdFor(cadence: ReportCadence, scope: AnalysisScope): string {
  const end = scope.periodEnd.slice(0, 7);
  return `${scope.contractId}-${cadence.toUpperCase()}-${end}`;
}

export function createReportingHandler(cadence: ReportCadence, defaults: AnalysisScope): CapabilityHandler<ReportingValue> {
  return {
    capability: `${cadence}-report`,
    async execute(context): Promise<CapabilityResult<ReportingValue>> {
      const pack = await gatherKpiEvidence(context, defaults);
      const report = buildReportPackage({
        reportId: reportIdFor(cadence, pack.scope),
        cadence,
        contractId: pack.scope.contractId,
        periodStart: pack.scope.periodStart,
        periodEnd: pack.scope.periodEnd,
        kpis: pack.observations,
        priorBreachesByKpi: pack.scope.priorBreachesByKpi,
      });
      const priorDecisions = await context.tools.call<MemoryReadInput, readonly MemoryRecord[]>('memory.read', { kind: 'decision' });
      const passages: readonly KnowledgeHit[] = context.model && context.tools.available('knowledge.read')
        ? await context.tools.call<KnowledgeReadInput, readonly KnowledgeHit[]>('knowledge.read', { query: knowledgeQueryFor(report), contractId: pack.scope.contractId, limit: 4 })
        : [];
      let narrative = deterministicExecutiveSummary(report);
      let narrativeSource: ReportingValue['narrativeSource'] = 'deterministic';
      let modelUsed = false;
      let modelFailure: string | null = null;
      if (context.model) {
        try {
          narrative = await draftGroundedReportNarrative(report, context.model, passages);
          narrativeSource = 'model';
          modelUsed = true;
        } catch (error) {
          if (!(error instanceof ModelUnavailableError)) throw error;
          modelFailure = error.message;
          narrativeSource = 'deterministic_fallback';
        }
      }
      return {
        value: { report: { ...report, narrativeDraft: narrative }, narrative, narrativeSource, citations: passages.map((p) => ({ ref: `${p.documentId}/${p.passageId}`, title: p.title, section: p.section, classification: p.classification })) },
        evidence: [...pack.evidence, ...passages.map((p) => p.evidence)],
        assumptions: [
          narrativeSource === 'model' ? 'Narrative drafted by a model from the package facts only; interpretation is labelled as such and requires review.'
            : narrativeSource === 'deterministic_fallback' ? `Model unavailable (${modelFailure}); narrative is the deterministic executive summary. Facts are unaffected.`
            : 'No model was granted; narrative is the deterministic executive summary.',
          `${priorDecisions.length} prior decision record(s) were available in memory for context.`,
          ...(passages.length > 0 ? [`${passages.length} reference passage(s) were supplied to the model for wording only (${passages.map((p) => `${p.documentId}/${p.passageId}`).join(', ')}); no number, threshold or date comes from them.`] : []),
        ],
        modelUsed,
      };
    },
  };
}

export interface BriefingDecision {
  exceptionId: string;
  severity: ReportException['severity'];
  title: string;
  decisionRequired: string;
  owner: 'contract-owner' | 'maintenance-manager' | 'planner';
}

export interface ExecutiveBriefingValue {
  contractId: string;
  headline: string;
  basedOnRun: string | null;
  decisions: readonly BriefingDecision[];
}

function parseDecisionValue(record: MemoryRecord): { value?: unknown } | null {
  try {
    const parsed: unknown = JSON.parse(record.content);
    return typeof parsed === 'object' && parsed !== null ? parsed as { value?: unknown } : null;
  } catch {
    return null;
  }
}

/**
 * Executive Briefing Agent. It does not recompute anything: it reads the
 * latest exception analysis from decision memory (produced by a governed run)
 * and converts it into decisions required. Its tools are memory.read and
 * contract.read only, so it cannot reach Maximo directly.
 */
export function createExecutiveBriefingHandler(defaults: AnalysisScope): CapabilityHandler<ExecutiveBriefingValue> {
  return {
    capability: 'executive-briefing',
    async execute(context): Promise<CapabilityResult<ExecutiveBriefingValue>> {
      const scope = resolveScope(context.task, defaults);
      const kpiSet = await context.tools.call<ContractReadInput, ContractKpiSet | null>('contract.read', { contractId: scope.contractId });
      if (!kpiSet) throw new Error(`No approved KPI definition set is available for contract ${scope.contractId}.`);
      const decisions = await context.tools.call<MemoryReadInput, readonly MemoryRecord[]>('memory.read', { kind: 'decision' });
      const latest = [...decisions].reverse().find((record) => record.tags.includes('exception-analysis'));
      const parsed = latest ? parseDecisionValue(latest) : null;
      const analysis = parsed && typeof parsed.value === 'object' && parsed.value !== null ? parsed.value as { contractId?: string; exceptions?: ReportException[] } : null;
      const exceptions = analysis?.contractId === scope.contractId && Array.isArray(analysis.exceptions) ? analysis.exceptions : null;

      if (!exceptions) {
        return {
          value: { contractId: scope.contractId, headline: 'No governed exception analysis is available for this scope; run exception-analysis first.', basedOnRun: null, decisions: [] },
          evidence: [kpiSet.evidence],
          assumptions: ['Briefing requires a prior exception-analysis run recorded in decision memory. None was found.'],
        };
      }
      const ranked = [...exceptions].sort((a, b) => ['critical', 'high', 'watch'].indexOf(a.severity) - ['critical', 'high', 'watch'].indexOf(b.severity));
      const briefing: BriefingDecision[] = ranked.map((exception) => ({
        exceptionId: exception.id,
        severity: exception.severity,
        title: exception.title,
        decisionRequired: exception.decisionRequired ?? 'Review during the current cycle.',
        owner: exception.severity === 'critical' ? 'contract-owner' : exception.severity === 'high' ? 'maintenance-manager' : 'planner',
      }));
      const critical = briefing.filter((d) => d.severity === 'critical').length;
      const headline = briefing.length === 0 ? 'No exceptions require a management decision this period.' : `${briefing.length} decision(s) required; ${critical} critical.`;
      return {
        value: { contractId: scope.contractId, headline, basedOnRun: latest?.id ?? null, decisions: briefing },
        evidence: [kpiSet.evidence, ...(latest?.evidence ?? [])],
        assumptions: [
          'Owner routing is a demo default by severity, not a contractual assignment.',
          `Based on decision memory ${latest?.id ?? 'n/a'} recorded ${latest?.createdAt ?? 'n/a'}.`,
        ],
      };
    },
  };
}
