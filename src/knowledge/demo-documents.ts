import type { KnowledgeDocument } from './contracts.ts';

/**
 * DEMO ONLY knowledge corpus. Every document is synthetic and classified
 * `synthetic`, except one `internal` note that exists to show classification
 * gating: a synthetic deployment never receives it. None of the text is an
 * RTA procedure, contract term or definition.
 */
const observedAt = '2026-08-01T00:00:00Z';

export const DEMO_KNOWLEDGE_DOCUMENTS: readonly KnowledgeDocument[] = [
  {
    documentId: 'KB-DEMO-KPI-GUIDE',
    title: 'Demo KPI definitions guide',
    version: 'demo-v1',
    classification: 'synthetic',
    source: { system: 'manual', uri: 'synthetic://knowledge/kpi-guide', observedAt },
    tags: ['kpi', 'definitions', 'mttr', 'availability'],
    passages: [
      { passageId: 'P1', section: 'MTTR clock', text: 'In the demo definition the repair clock for MTTR starts at the Maximo reported time and stops at the completion time of the corrective work order. Waiting time for track access is included unless an approved exclusion is recorded.' },
      { passageId: 'P2', section: 'Availability', text: 'Demo availability is planned service minutes less downtime minutes, divided by planned service minutes. Planned service minutes come from the approved definition set for the period.' },
      { passageId: 'P3', section: 'Readiness', text: 'A KPI is decision-grade only when its readiness is READY. PROVISIONAL results are reported with their readiness notes; BLOCKED results carry no contractual finding.' },
    ],
  },
  {
    documentId: 'KB-DEMO-REVIEW-PROCEDURE',
    title: 'Demo report review procedure',
    version: 'demo-v1',
    classification: 'synthetic',
    source: { system: 'manual', uri: 'synthetic://knowledge/review-procedure', observedAt },
    tags: ['review', 'procedure', 'approval', 'disagreement'],
    passages: [
      { passageId: 'P1', section: 'Comment sheet', text: 'The owner and the contractor record questions and answers on the comment sheet of the package under review. A comment stays open until the raising party closes it or the other party has responded.' },
      { passageId: 'P2', section: 'Disagreements', text: 'When the parties disagree on a KPI result, both positions are recorded with evidence before a named approver resolves or escalates. An open disagreement holds approval of the package.' },
      { passageId: 'P3', section: 'Narrative', text: 'The executive narrative explains the approved facts. It must not introduce numbers, causes or clauses that are not in the package, and any interpretation is labelled as interpretation.' },
    ],
  },
  {
    documentId: 'KB-DEMO-CONTRACT-NOTES',
    title: 'Demo contract clause notes',
    version: 'demo-v1',
    classification: 'synthetic',
    source: { system: 'contract_repository', uri: 'synthetic://knowledge/contract-notes', observedAt },
    contractIds: ['DEMO-CONTRACT'],
    tags: ['contract', 'clauses', 'obligations'],
    passages: [
      { passageId: 'P1', section: 'Demo clause 12.1', text: 'Demo clause 12.1 binds service availability to the approved threshold each reporting period. A breach on decision-grade data triggers the demo service credit calculation, which is not automated in P0.' },
      { passageId: 'P2', section: 'Demo clause 12.2', text: 'Demo clause 12.2 binds MTBF and MTTR. A repair-time breach requires a remediation plan within ten days; access delays caused by the owner may be excluded when both parties record the exclusion.' },
      { passageId: 'P3', section: 'Demo clause 18.1', text: 'Demo clause 18.1 requires the monthly performance report within ten calendar days of period end, with evidence references for every KPI and a named approval.' },
    ],
  },
  {
    documentId: 'KB-DEMO-INTERNAL-NOTE',
    title: 'Synthetic internal-only note (classification demo)',
    version: 'demo-v1',
    classification: 'internal',
    source: { system: 'manual', uri: 'synthetic://knowledge/internal-note', observedAt },
    tags: ['classification'],
    passages: [
      { passageId: 'P1', section: 'Purpose', text: 'This synthetic note is classified internal only to demonstrate retrieval gating. A deployment classified synthetic never receives it; an internal deployment does. It contains no real information about MTTR, availability or any contract.' },
    ],
  },
];
