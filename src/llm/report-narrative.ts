import type { ModelGateway } from '../agent-os/contracts.ts';
import type { ReportPackage } from '../reporting/contracts.ts';
import type { KnowledgeHit } from '../knowledge/contracts.ts';

export async function draftGroundedReportNarrative(
  report: ReportPackage,
  model: ModelGateway,
  passages: readonly KnowledgeHit[] = [],
): Promise<string> {
  const blocked = report.kpis.filter((kpi) => kpi.decisionGrade === false).map((kpi) => ({ id: kpi.definition.id, readiness: kpi.readiness?.state ?? 'BLOCKED', reasons: kpi.readiness?.reasons ?? [] }));
  const facts = report.kpis.filter((kpi) => kpi.decisionGrade !== false).map((kpi) => ({
    id: kpi.definition.id,
    name: kpi.definition.name,
    value: kpi.value,
    unit: kpi.definition.unit,
    threshold: kpi.definition.threshold,
    status: kpi.status,
    formulaVersion: kpi.definition.formulaVersion,
    readiness: kpi.readiness?.state ?? 'READY',
    readinessNotes: kpi.readiness?.reasons ?? [],
    evidence: kpi.evidence,
  }));
  const exceptions = report.exceptions.map((exception) => ({
    severity: exception.severity,
    title: exception.title,
    whyItMatters: exception.whyItMatters,
    decisionRequired: exception.decisionRequired,
  }));

  const result = await model.generate({
    temperature: 0,
    maxTokens: 800,
    messages: [
      {
        role: 'system',
        content: 'You are RailMind Reporting Agent. Use only supplied facts. Do not calculate new KPI values, invent causes, contractual clauses, dates or amounts. Clearly label any interpretation as interpretation. State every PROVISIONAL readiness note and list every BLOCKED KPI as blocked; never present blocked or provisional data as settled. If evidence is insufficient, say so. Reference passages, when supplied, are context for wording only: cite a passage you rely on as [documentId/passageId] and never take a number, threshold or date from a passage.',
      },
      {
        role: 'user',
        content: `Draft a concise management narrative for this approved report data:\n${JSON.stringify({ reportId: report.reportId, cadence: report.cadence, periodStart: report.periodStart, periodEnd: report.periodEnd, facts, blockedKpis: blocked, exceptions, referencePassages: passages.map((p) => ({ ref: `${p.documentId}/${p.passageId}`, title: p.title, section: p.section, text: p.text })) })}`,
      },
    ],
  });
  return result.text;
}
