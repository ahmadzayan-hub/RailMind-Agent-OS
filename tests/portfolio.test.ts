import test from 'node:test';
import assert from 'node:assert/strict';

import { ClassificationError, assertPublicClassification, type PortfolioDataProvider } from '../src/portfolio/contracts.ts';
import { PortfolioService } from '../src/portfolio/service.ts';
import { createSyntheticPortfolioProvider, generateSyntheticPortfolio } from '../src/portfolio/synthetic.ts';

test('synthetic portfolio is deterministic, generic and PUBLIC_SYNTHETIC', () => {
  const a = generateSyntheticPortfolio();
  const b = generateSyntheticPortfolio();
  assert.deepEqual(a, b);
  assert.equal(a.length, 30);
  assert.ok(a.every((i) => i.classification === 'PUBLIC_SYNTHETIC' && /^SYN-\d{3}$/.test(i.initiativeId) && /^Business Area-0\d$/.test(i.businessArea)));
  assert.notDeepEqual(generateSyntheticPortfolio(7), a);
});

test('public builds refuse any record that is not PUBLIC_SYNTHETIC', async () => {
  assert.throws(() => assertPublicClassification([{ initiativeId: 'X', classification: 'CONFIDENTIAL' }]), ClassificationError);
  const leaky: PortfolioDataProvider = { id: 'private', mode: 'production', classification: 'RESTRICTED', async listInitiatives() { return generateSyntheticPortfolio().map((i) => ({ ...i, classification: 'RESTRICTED' as const, source: 'private' })); } };
  await assert.rejects(() => new PortfolioService(leaky, { publicBuild: true, now: () => '2026-09-09T00:00:00Z' }).build('2026-09-09', '2026-12-31'), ClassificationError);
  const internal = await new PortfolioService(leaky, { publicBuild: false, now: () => '2026-09-09T00:00:00Z' }).build('2026-09-09', '2026-12-31');
  assert.equal(internal.classification, 'RESTRICTED');
});

test('portfolio service aggregates cells, runs the governed forecast and exposes funding gaps as exceptions', async () => {
  const dto = await new PortfolioService(createSyntheticPortfolioProvider(), { publicBuild: true, now: () => '2026-09-09T00:00:00Z' }).build('2026-09-09', '2026-12-31');
  assert.equal(dto.totals.initiatives, 30);
  assert.equal(dto.cells.reduce((s, c) => s + c.count, 0), 30);
  assert.equal(Math.round(dto.cells.reduce((s, c) => s + c.totalCost, 0)), Math.round(dto.totals.totalCost));
  assert.equal(dto.forecastMeta.modelVersion, 'pace-quantile-v2');
  assert.ok(['ADEQUATE', 'LOW_CONFIDENCE', 'INSUFFICIENT_EVIDENCE'].includes(dto.forecastMeta.confidence));
  assert.ok(dto.forecastMeta.excluded.some((e) => e.reason === 'not awarded'));
  for (const exception of dto.exceptions) {
    assert.ok(exception.expectedFundingGap > 0);
    assert.match(exception.decisionRequired, /exceeds the approved budget/);
  }
  assert.equal(Math.round(dto.totals.fundingGapP50), Math.round(dto.cells.reduce((s, c) => s + c.fundingGapP50, 0)));
});
