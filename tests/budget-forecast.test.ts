import test from 'node:test';
import assert from 'node:assert/strict';

import {
  FORECAST_MODEL_VERSION,
  InMemoryForecastDriftMonitor,
  SCENARIO_SEMANTICS,
  backtest,
  buildPaceDistribution,
  forecastInitiative,
  recalibrationMetadata,
  type BudgetForecastInput,
  type PaceDistribution,
} from '../src/forecast/budget-forecast.ts';

const awarded = 'Awarded / Delivery Party Identified' as const;
const notAwarded = 'Not Awarded' as const;

function input(overrides: Partial<BudgetForecastInput> = {}): BudgetForecastInput {
  return { initiativeId: 'I-01', portfolio: 'Capital', businessArea: 'Business Area-01', awardStatus: awarded, totalEstimatedCost: 100, recordedExpenditure: 20, approvedBudget: 30, executionStart: '2026-01-01', executionEnd: '2026-12-31', ...overrides };
}

const dist = (over: Partial<PaceDistribution> = {}): PaceDistribution => ({ sampleSize: 10, p25: 0.4, p50: 0.6, p75: 0.9, confidence: 'ADEQUATE', calibration: { included: [], excluded: [] }, asOf: '2026-06-30', modelVersion: FORECAST_MODEL_VERSION, ...over });

test('calibration uses eligible in-flight initiatives only and records every exclusion with its reason', () => {
  const distribution = buildPaceDistribution([
    input({ initiativeId: 'A', recordedExpenditure: 20 }),
    input({ initiativeId: 'B', recordedExpenditure: 40 }),
    input({ initiativeId: 'C', recordedExpenditure: 0 }),
    input({ initiativeId: 'D', awardStatus: notAwarded, recordedExpenditure: 80 }),
  ], '2026-06-30');
  assert.equal(distribution.sampleSize, 2);
  assert.deepEqual(distribution.calibration.included, ['A', 'B']);
  assert.deepEqual(distribution.calibration.excluded.map((e) => e.reason), ['no recorded expenditure', 'not awarded']);
  assert.ok(distribution.p25 <= distribution.p50 && distribution.p50 <= distribution.p75);
  assert.equal(distribution.modelVersion, FORECAST_MODEL_VERSION);
});

test('regression: initiatives completed on or before the as-of date are excluded from calibration', () => {
  const inFlight = input({ initiativeId: 'LIVE', recordedExpenditure: 30 });
  const completedBefore = input({ initiativeId: 'DONE', executionStart: '2025-01-01', executionEnd: '2026-05-31', recordedExpenditure: 100 });
  const completedOnAsOf = input({ initiativeId: 'EDGE', executionStart: '2025-06-01', executionEnd: '2026-06-30', recordedExpenditure: 100 });
  const distribution = buildPaceDistribution([inFlight, completedBefore, completedOnAsOf], '2026-06-30');
  assert.deepEqual(distribution.calibration.included, ['LIVE']);
  assert.ok(distribution.calibration.excluded.every((e) => e.reason === 'completed on or before the as-of date'));
  const withoutCompleted = buildPaceDistribution([inFlight], '2026-06-30');
  assert.equal(distribution.p50, withoutCompleted.p50, 'completed initiatives must not move the distribution');
});

test('thin calibration samples are labelled instead of pretending precision', () => {
  assert.equal(buildPaceDistribution([input({ recordedExpenditure: 20 })], '2026-06-30').confidence, 'INSUFFICIENT_EVIDENCE');
  const three = buildPaceDistribution(['A', 'B', 'C'].map((id) => input({ initiativeId: id, recordedExpenditure: 20 })), '2026-06-30');
  assert.equal(three.confidence, 'LOW_CONFIDENCE');
  const eight = buildPaceDistribution(Array.from({ length: 8 }, (_, i) => input({ initiativeId: `I-${i}`, recordedExpenditure: 20 + i })), '2026-06-30');
  assert.equal(eight.confidence, 'ADEQUATE');
  const empty = buildPaceDistribution([], '2026-06-30');
  assert.equal(empty.sampleSize, 0);
  assert.equal(forecastInitiative(input(), empty, '2026-06-30', '2026-12-31').ineligibleReason, 'insufficient calibration evidence');
});

test('forecast never caps to the approved budget; the shortfall is a funding gap with a decision required', () => {
  const result = forecastInitiative(input({ recordedExpenditure: 20, approvedBudget: 50, committedAmount: 35 }), dist(), '2026-06-30', '2026-12-31');
  assert.equal(result.eligible, true);
  const central = result.scenarios[1]!;
  assert.equal(central.projectedCumulativeExpenditure, 60);
  assert.equal(central.additionalExpenditure, 40);
  assert.equal(central.remainingApprovedAllocation, -10);
  assert.equal(central.expectedFundingGap, 10);
  assert.equal(result.uncommittedAllocation, 15);
  assert.match(result.decisionRequired ?? '', /exceeds the approved budget/);
  assert.equal(result.provenance.scenarioSemantics, SCENARIO_SEMANTICS);
  assert.doesNotMatch(SCENARIO_SEMANTICS, /confidence interval(?!s)/);
});

test('forecast bounds projection by estimated cost, never below actual spend, and excludes unawarded, completed and future starts', () => {
  const capped = forecastInitiative(input({ recordedExpenditure: 85 }), dist({ p25: 0.8, p50: 1.3, p75: 2 }), '2026-06-30', '2026-12-31');
  assert.equal(capped.scenarios[1]?.projectedCumulativeExpenditure, 100);
  assert.equal(capped.scenarios[1]?.additionalExpenditure, 15);
  assert.equal(forecastInitiative(input({ awardStatus: notAwarded }), dist(), '2026-06-30', '2026-12-31').ineligibleReason, 'not awarded');
  assert.equal(forecastInitiative(input({ executionEnd: '2026-05-31' }), dist(), '2026-06-30', '2026-12-31').ineligibleReason, 'completed on or before the as-of date');
  assert.equal(forecastInitiative(input({ executionStart: '2027-02-01', executionEnd: '2027-12-31' }), dist(), '2026-06-30', '2026-12-31').ineligibleReason, 'starts after the horizon');
});

test('backtest reports error metrics, band coverage and the calibration confidence', () => {
  const inputs = Array.from({ length: 9 }, (_, i) => input({ initiativeId: `I-${i}`, recordedExpenditure: 15 + i * 2, approvedBudget: 100 }));
  const actuals = Object.fromEntries(inputs.map((i) => [i.initiativeId, 70]));
  const metrics = backtest({ inputsAtAsOf: inputs, asOf: '2026-06-30', horizon: '2026-12-31', actualAtHorizon: actuals });
  assert.equal(metrics.evaluated, 9);
  assert.ok(metrics.mape !== null && metrics.mape >= 0);
  assert.ok(metrics.bias !== null);
  assert.ok(metrics.bandCoverage !== null && metrics.bandCoverage >= 0 && metrics.bandCoverage <= 1);
  assert.equal(metrics.confidence, 'ADEQUATE');
  assert.equal(metrics.modelVersion, FORECAST_MODEL_VERSION);
});

test('drift monitor flags a deteriorating MAPE and recommends recalibration', async () => {
  const monitor = new InMemoryForecastDriftMonitor();
  assert.equal((await monitor.status()).recommendation.includes('No backtest recorded'), true);
  const base = { modelVersion: FORECAST_MODEL_VERSION, asOf: '2026-03-31', horizon: '2026-06-30', evaluated: 9, bias: 0, bandCoverage: 0.5, confidence: 'ADEQUATE' as const };
  await monitor.record({ at: '2026-07-01', metrics: { ...base, mape: 0.12 } });
  await monitor.record({ at: '2026-10-01', metrics: { ...base, mape: 0.31 } });
  const status = await monitor.status();
  assert.equal(status.drifting, true);
  assert.match(status.recommendation, /Recalibrate/);
  const meta = recalibrationMetadata(buildPaceDistribution([input()], '2026-06-30'), '2026-09-09T00:00:00Z');
  assert.equal(meta.confidence, 'INSUFFICIENT_EVIDENCE');
  assert.equal(meta.sampleSize, 1);
});
