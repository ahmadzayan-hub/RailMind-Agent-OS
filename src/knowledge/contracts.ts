import type { DataClassification, EvidenceRef } from '../agent-os/contracts.ts';

/**
 * Private knowledge runtime (Phase 15).
 *
 * Reference documents (procedures, definition guides, clause summaries) live
 * in RailMind's own store with a classification per document. Retrieval is
 * deterministic lexical scoring, so the same query over the same corpus
 * returns the same passages in the same order, and every hit carries an
 * evidence reference to the document it came from. Passages are context for
 * wording; they are never a source of KPI values, thresholds or dates.
 *
 * Classification is enforced at retrieval: a deployment classified
 * `synthetic` never receives an `internal` or `confidential` passage, and a
 * document above the caller's ceiling is invisible, not redacted.
 */
export interface KnowledgePassage {
  passageId: string;
  section?: string;
  text: string;
}

export interface KnowledgeDocument {
  documentId: string;
  title: string;
  version: string;
  classification: DataClassification;
  source: { system: EvidenceRef['sourceSystem']; uri?: string; observedAt: string };
  /** Contracts the document applies to; absent means general. */
  contractIds?: readonly string[];
  tags: readonly string[];
  passages: readonly KnowledgePassage[];
}

export interface KnowledgeQuery {
  query: string;
  /** Highest classification the caller may receive. */
  maxClassification: DataClassification;
  contractId?: string;
  tags?: readonly string[];
  limit?: number;
}

export interface KnowledgeHit {
  documentId: string;
  title: string;
  version: string;
  classification: DataClassification;
  passageId: string;
  section: string | null;
  text: string;
  score: number;
  /** Query terms found in the passage, in query order. */
  matchedTerms: readonly string[];
  evidence: EvidenceRef;
}

export interface KnowledgeDocumentSummary {
  documentId: string;
  title: string;
  version: string;
  classification: DataClassification;
  contractIds: readonly string[];
  tags: readonly string[];
  passages: number;
}

export interface KnowledgeReadPort {
  search(query: KnowledgeQuery): Promise<readonly KnowledgeHit[]>;
  get(documentId: string, maxClassification: DataClassification): Promise<KnowledgeDocument | null>;
  list(maxClassification: DataClassification): Promise<readonly KnowledgeDocumentSummary[]>;
}

/** A store RailMind owns: documents are loaded into it. Source systems are never written. */
export interface KnowledgeStore extends KnowledgeReadPort {
  upsert(document: KnowledgeDocument): Promise<void>;
}

export const CLASSIFICATION_RANK: Readonly<Record<DataClassification, number>> = { synthetic: 0, internal: 1, confidential: 2 };

export function withinClassification(document: Pick<KnowledgeDocument, 'classification'>, ceiling: DataClassification): boolean {
  return CLASSIFICATION_RANK[document.classification] <= CLASSIFICATION_RANK[ceiling];
}

const TOKEN = /[\p{L}\p{N}_]+/gu;
const STOP = new Set(['the', 'a', 'an', 'and', 'or', 'of', 'to', 'in', 'for', 'on', 'is', 'are', 'be', 'by', 'with', 'at', 'as', 'it', 'this', 'that', 'from', 'per']);

export function tokenise(text: string): readonly string[] {
  return (text.toLowerCase().match(TOKEN) ?? []).filter((t) => t.length > 1 && !STOP.has(t));
}

export function validateKnowledgeDocument(document: KnowledgeDocument): readonly string[] {
  const problems: string[] = [];
  if (!document.documentId?.trim()) problems.push('documentId is required');
  if (!document.title?.trim()) problems.push('title is required');
  if (!document.version?.trim()) problems.push('version is required');
  if (!(document.classification in CLASSIFICATION_RANK)) problems.push('classification is invalid');
  if (!document.source?.system || Number.isNaN(Date.parse(document.source?.observedAt ?? ''))) problems.push('source.system and an ISO source.observedAt are required');
  if (!Array.isArray(document.passages) || document.passages.length === 0) problems.push('at least one passage is required');
  const ids = new Set<string>();
  for (const passage of document.passages ?? []) {
    if (!passage.passageId?.trim() || !passage.text?.trim()) problems.push('every passage needs a passageId and text');
    if (ids.has(passage.passageId)) problems.push(`passage ${passage.passageId} is duplicated`);
    ids.add(passage.passageId);
  }
  return problems;
}

/**
 * Deterministic lexical ranking over the documents the caller may see.
 * Score = sum over distinct matched query terms of tf * idf, where idf is
 * computed across the visible passages. Ties break on documentId then
 * passageId so results are stable across runs and adapters.
 */
export function rankPassages(documents: readonly KnowledgeDocument[], query: KnowledgeQuery): readonly KnowledgeHit[] {
  const terms = [...new Set(tokenise(query.query))];
  if (terms.length === 0) return [];
  const visible = documents.filter((d) => withinClassification(d, query.maxClassification)
    && (!query.contractId || !d.contractIds || d.contractIds.includes(query.contractId))
    && (!query.tags || query.tags.length === 0 || query.tags.some((t) => d.tags.includes(t))));
  const passages = visible.flatMap((d) => d.passages.map((p) => ({ document: d, passage: p, tokens: tokenise(`${p.section ?? ''} ${p.text}`) })));
  if (passages.length === 0) return [];
  const df = new Map<string, number>();
  for (const entry of passages) for (const term of new Set(entry.tokens)) df.set(term, (df.get(term) ?? 0) + 1);
  const hits: KnowledgeHit[] = [];
  for (const entry of passages) {
    let score = 0;
    const matched: string[] = [];
    for (const term of terms) {
      const tf = entry.tokens.filter((t) => t === term).length;
      if (tf === 0) continue;
      matched.push(term);
      const idf = Math.log(1 + passages.length / (df.get(term) ?? 1));
      score += tf * idf;
    }
    if (matched.length === 0) continue;
    hits.push({
      documentId: entry.document.documentId,
      title: entry.document.title,
      version: entry.document.version,
      classification: entry.document.classification,
      passageId: entry.passage.passageId,
      section: entry.passage.section ?? null,
      text: entry.passage.text,
      score: Math.round(score * 1000) / 1000,
      matchedTerms: matched,
      evidence: { sourceSystem: entry.document.source.system, entityType: 'knowledge-passage', entityId: `${entry.document.documentId}/${entry.passage.passageId}`, observedAt: entry.document.source.observedAt, sourceUri: entry.document.source.uri },
    });
  }
  hits.sort((a, b) => b.score - a.score || a.documentId.localeCompare(b.documentId) || a.passageId.localeCompare(b.passageId));
  return hits.slice(0, Math.max(1, Math.min(query.limit ?? 5, 20)));
}

export function summariseKnowledgeDocument(document: KnowledgeDocument): KnowledgeDocumentSummary {
  return { documentId: document.documentId, title: document.title, version: document.version, classification: document.classification, contractIds: document.contractIds ?? [], tags: document.tags, passages: document.passages.length };
}

export class InMemoryKnowledgeStore implements KnowledgeStore {
  readonly #documents = new Map<string, KnowledgeDocument>();

  constructor(documents: readonly KnowledgeDocument[] = []) {
    for (const document of documents) {
      const problems = validateKnowledgeDocument(document);
      if (problems.length > 0) throw new Error(`Knowledge document ${document.documentId}: ${problems.join('; ')}.`);
      this.#documents.set(document.documentId, document);
    }
  }

  async upsert(document: KnowledgeDocument): Promise<void> {
    const problems = validateKnowledgeDocument(document);
    if (problems.length > 0) throw new Error(`Knowledge document ${document.documentId}: ${problems.join('; ')}.`);
    this.#documents.set(document.documentId, document);
  }

  async search(query: KnowledgeQuery): Promise<readonly KnowledgeHit[]> {
    return rankPassages([...this.#documents.values()], query);
  }

  async get(documentId: string, maxClassification: DataClassification): Promise<KnowledgeDocument | null> {
    const document = this.#documents.get(documentId);
    return document && withinClassification(document, maxClassification) ? document : null;
  }

  async list(maxClassification: DataClassification): Promise<readonly KnowledgeDocumentSummary[]> {
    return [...this.#documents.values()].filter((d) => withinClassification(d, maxClassification)).map(summariseKnowledgeDocument).sort((a, b) => a.documentId.localeCompare(b.documentId));
  }
}
