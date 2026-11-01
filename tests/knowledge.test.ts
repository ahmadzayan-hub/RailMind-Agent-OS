import test from 'node:test';
import assert from 'node:assert/strict';

import { InMemoryKnowledgeStore, rankPassages, tokenise, validateKnowledgeDocument, withinClassification, type KnowledgeDocument } from '../src/knowledge/contracts.ts';
import { DEMO_KNOWLEDGE_DOCUMENTS } from '../src/knowledge/demo-documents.ts';

test('demo corpus validates; documents need ids, passages and a classification', () => {
  for (const document of DEMO_KNOWLEDGE_DOCUMENTS) assert.deepEqual(validateKnowledgeDocument(document), [], document.documentId);
  const first = DEMO_KNOWLEDGE_DOCUMENTS[0]!;
  assert.ok(validateKnowledgeDocument({ ...first, passages: [] }).some((p) => /at least one passage/.test(p)));
  assert.ok(validateKnowledgeDocument({ ...first, passages: [first.passages[0]!, first.passages[0]!] }).some((p) => /duplicated/.test(p)));
  assert.ok(validateKnowledgeDocument({ ...first, classification: 'secret' as KnowledgeDocument['classification'] }).some((p) => /classification/.test(p)));
  assert.throws(() => new InMemoryKnowledgeStore([{ ...first, title: '' }]), /title is required/);
  assert.deepEqual(tokenise('The MTTR clock starts at the Maximo reported time.'), ['mttr', 'clock', 'starts', 'maximo', 'reported', 'time']);
});

test('retrieval is deterministic, ranks by matched terms and cites the document as evidence', async () => {
  const store = new InMemoryKnowledgeStore(DEMO_KNOWLEDGE_DOCUMENTS);
  const first = await store.search({ query: 'MTTR repair clock track access', maxClassification: 'synthetic', limit: 3 });
  const again = await store.search({ query: 'MTTR repair clock track access', maxClassification: 'synthetic', limit: 3 });
  assert.deepEqual(first, again);
  assert.equal(first[0]?.documentId, 'KB-DEMO-KPI-GUIDE');
  assert.equal(first[0]?.passageId, 'P1');
  assert.deepEqual(first[0]?.matchedTerms, ['mttr', 'repair', 'clock', 'track', 'access']);
  assert.equal(first[0]?.evidence.entityType, 'knowledge-passage');
  assert.equal(first[0]?.evidence.entityId, 'KB-DEMO-KPI-GUIDE/P1');
  assert.equal(first[0]?.evidence.sourceSystem, 'manual');
  assert.ok(first.every((h, i) => i === 0 || (first[i - 1]!.score >= h.score)));
  assert.deepEqual(await store.search({ query: '', maxClassification: 'synthetic' }), []);
  assert.deepEqual(await store.search({ query: 'zzzz qqqq', maxClassification: 'synthetic' }), []);
});

test('classification gating: a synthetic ceiling never sees internal documents; the contract filter keeps general documents', async () => {
  const store = new InMemoryKnowledgeStore(DEMO_KNOWLEDGE_DOCUMENTS);
  const gated = await store.search({ query: 'classification gating internal note', maxClassification: 'synthetic' });
  assert.ok(gated.every((h) => h.classification === 'synthetic'));
  assert.ok(!gated.some((h) => h.documentId === 'KB-DEMO-INTERNAL-NOTE'));
  const internal = await store.search({ query: 'classification gating internal note', maxClassification: 'internal' });
  assert.equal(internal[0]?.documentId, 'KB-DEMO-INTERNAL-NOTE');
  assert.equal(await store.get('KB-DEMO-INTERNAL-NOTE', 'synthetic'), null);
  assert.equal((await store.get('KB-DEMO-INTERNAL-NOTE', 'confidential'))?.classification, 'internal');
  assert.equal((await store.list('synthetic')).length, 3);
  assert.equal((await store.list('internal')).length, 4);
  assert.equal(withinClassification({ classification: 'confidential' }, 'internal'), false);
  const other = await store.search({ query: 'clause 12.2 MTBF MTTR remediation', maxClassification: 'synthetic', contractId: 'OTHER-CONTRACT' });
  assert.ok(!other.some((h) => h.documentId === 'KB-DEMO-CONTRACT-NOTES'), 'contract-bound notes are hidden for another contract');
  assert.ok(other.some((h) => h.documentId === 'KB-DEMO-KPI-GUIDE'), 'general documents stay visible');
  const bound = await store.search({ query: 'clause 12.2 MTBF MTTR remediation', maxClassification: 'synthetic', contractId: 'DEMO-CONTRACT' });
  assert.equal(bound[0]?.documentId, 'KB-DEMO-CONTRACT-NOTES');
  assert.equal(bound[0]?.passageId, 'P2');
  const tagged = rankPassages(DEMO_KNOWLEDGE_DOCUMENTS, { query: 'approval disagreement', maxClassification: 'synthetic', tags: ['review'] });
  assert.ok(tagged.every((h) => h.documentId === 'KB-DEMO-REVIEW-PROCEDURE'));
});
