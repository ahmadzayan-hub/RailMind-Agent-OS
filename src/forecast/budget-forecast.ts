/**
 * Portfolio expenditure forecast: a schedule-adjusted pace model.
 *
 * Model version and semantics are explicit. P25 / P50 / P75 are quantiles of
 * the observed spending-pace distribution used as scenarios; they are NOT
 * statistical confidence intervals. Completed initiatives (execution end on
 * or before the as-of date) are excluded from calibration because their pace
 * is no longer an observation of in-flight behaviour. Forecasts are never
 * capped to approved budget: a shortfall is exposed as a funding gap.
 */
export const FORECAST_MODEL_VERSION = 'pace-quantile-v2';
export const SCENARIO_SEMANTICS = 'Quantiles of the observed schedule-adjusted spending-pace distribution used as planning scenarios; not statistical confidence intervals.';

export type AwardStatus = 'Awarded / Delivery Party Identified' | 'Not Awarded';

export interface BudgetForecastInput {
  initiativeId: string;
  portfolio: string;
  businessArea: string;
  awardStatus: AwardStatus;
  totalEstimatedCost: number;
  recordedExpenditure: number;
  approvedBudget: number;
  /** Contractually committed amount where known (purchase orders, contracts). */
  committedAmount?: number;
  executionStart: string;
  executionEnd: string;
}

export type ForecastConfidence = 'ADEQUATE' | 'LOW_CONFIDENCE' | 'INSUFFICIENT_EVIDENCE';

export interface PaceDistribution {
  sampleSize: number;
  p25: number;
  p50: number;
  p75: number;
  confidence: ForecastConfidence;
  /** Ids used for calibration and ids excluded with the reason. */
  calibration: { included: readonly string[]; excluded: readonly { initiativeId: string; reason: string }[] };
  asOf: string;
  modelVersion: string;
}

export interface ForecastScenario {
  label: 'P25' | 'P50' | 'P75';
  paceFactor: number;
  additionalExpenditure: number;
  projectedCumulativeExpenditure: number;
  /** Approved budget minus projected cumulative expenditure; negative means a gap. */
  remainingApprovedAllocation: number;
  /** Positive when projected expenditure exceeds the approved budget. */
  expectedFundingGap: number;
}

export interface InitiativeForecast {
  initiativeId: string;
  eligible: boolean;
  ineligibleReason?: string;
  scheduleProgressAtAsOf: number | null;
  scheduleProgressAtHorizon: number | null;
  approvedBudget: number;
  committedAmount: number | null;
  /** Approved budget minus committed amount when committed is known. */
  uncommittedAllocation: number | null;
  scenarios: readonly ForecastScenario[];
  /** Management decision required when the central scenario exceeds the approved budget. */
  decisionRequired: string | null;
  confidence: ForecastConfidence;
  provenance: { modelVersion: string; asOf: string; horizon: string; calibrationSampleSize: number; scenarioSemantics: string };
}

const AWARDED: AwardStatus = 'Awarded / Delivery Party Identified';
export const MIN_ADEQUATE_SAMPLE = 8;
export const MIN_LOW_CONFIDENCE_SAMPLE = 3;

function asDate(value: string): Date | null {
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function clamp(value: number, lower = 0, upper = 1): number {
  return Math.min(upper, Math.max(lower, value));
}

function scheduleProgress(start: Date, end: Date, point: Date): number {
  const duration = end.getTime() - start.getTime();
  if (duration <= 0) return 0;
  return clamp((point.getTime() - start.getTime()) / duration);
}

function interpolateQuantile(values: readonly number[], probability: number): number {
  const ordered = [...values].sort((a, b) => a - b);
  if (ordered.length === 0) return 0;
  const position = (ordered.length - 1) * probability;
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  const lowerValue = ordered[lower];
  const upperValue = ordered[upper];
  if (lowerValue === undefined || upperValue === undefined) return 0;
  return lowerValue + (upperValue - lowerValue) * (position - lower);
}

export function confidenceFor(sampleSize: number): ForecastConfidence {
  if (sampleSize >= MIN_ADEQUATE_SAMPLE) return 'ADEQUATE';
  if (sampleSize >= MIN_LOW_CONFIDENCE_SAMPLE) return 'LOW_CONFIDENCE';
  return 'INSUFFICIENT_EVIDENCE';
}

/**
 * Builds the pace distribution from in-flight, awarded initiatives with
 * recorded expenditure and enough schedule progress. Completed initiatives are
 * excluded. Never throws for a thin sample: the confidence label says so.
 */
export function buildPaceDistribution(
  inputs: readonly BudgetForecastInput[],
  asOfDate: string,
  minimumScheduleProgress = 0.1,
): PaceDistribution {
  const asOf = asDate(asOfDate);
  if (!asOf) throw new Error(`Invalid as-of date: ${asOfDate}`);

  const included: string[] = [];
  const excluded: { initiativeId: string; reason: string }[] = [];
  const paces: number[] = [];
  for (const input of inputs) {
    const start = asDate(input.executionStart);
    const end = asDate(input.executionEnd);
    const skip = (reason: string) => excluded.push({ initiativeId: input.initiativeId, reason });
    if (input.awardStatus !== AWARDED) { skip('not awarded'); continue; }
    if (input.totalEstimatedCost <= 0) { skip('no estimated cost'); continue; }
    if (input.recordedExpenditure <= 0) { skip('no recorded expenditure'); continue; }
    if (!start || !end) { skip('invalid execution dates'); continue; }
    if (end <= asOf) { skip('completed on or before the as-of date'); continue; }
    const progress = scheduleProgress(start, end, asOf);
    if (progress < minimumScheduleProgress) { skip(`schedule progress ${progress.toFixed(2)} below ${minimumScheduleProgress}`); continue; }
    included.push(input.initiativeId);
    paces.push((input.recordedExpenditure / input.totalEstimatedCost) / progress);
  }

  return {
    sampleSize: paces.length,
    p25: interpolateQuantile(paces, 0.25),
    p50: interpolateQuantile(paces, 0.5),
    p75: interpolateQuantile(paces, 0.75),
    confidence: confidenceFor(paces.length),
    calibration: { included, excluded },
    asOf: asOfDate,
    modelVersion: FORECAST_MODEL_VERSION,
  };
}

/**
 * Forecasts additional expenditure through the horizon. Projected cumulative
 * expenditure is bounded by the total estimated cost (an initiative cannot
 * spend more than its estimate under this model) but never by the approved
 * budget: the shortfall is reported as a funding gap and a decision required.
 */
export function forecastInitiative(
  input: BudgetForecastInput,
  distribution: PaceDistribution,
  asOfDate: string,
  horizonDate: string,
): InitiativeForecast {
  const asOf = asDate(asOfDate);
  const horizon = asDate(horizonDate);
  const start = asDate(input.executionStart);
  const end = asDate(input.executionEnd);
  if (!asOf || !horizon || !start || !end) {
    throw new Error('Forecast inputs require valid as-of, horizon, start and end dates.');
  }
  const committed = input.committedAmount ?? null;
  const uncommitted = committed === null ? null : input.approvedBudget - committed;
  const provenance = { modelVersion: distribution.modelVersion, asOf: asOfDate, horizon: horizonDate, calibrationSampleSize: distribution.sampleSize, scenarioSemantics: SCENARIO_SEMANTICS };
  const progressAtAsOf = scheduleProgress(start, end, asOf);
  const progressAtHorizon = scheduleProgress(start, end, horizon);

  const ineligibleReason = input.awardStatus !== AWARDED ? 'not awarded'
    : input.totalEstimatedCost <= 0 ? 'no estimated cost'
    : end <= asOf ? 'completed on or before the as-of date'
    : start > horizon ? 'starts after the horizon'
    : distribution.confidence === 'INSUFFICIENT_EVIDENCE' ? 'insufficient calibration evidence'
    : undefined;

  if (ineligibleReason) {
    return { initiativeId: input.initiativeId, eligible: false, ineligibleReason, scheduleProgressAtAsOf: progressAtAsOf, scheduleProgressAtHorizon: progressAtHorizon, approvedBudget: input.approvedBudget, committedAmount: committed, uncommittedAllocation: uncommitted, scenarios: [], decisionRequired: null, confidence: distribution.confidence, provenance };
  }

  const scenarioDefinitions: readonly [ForecastScenario['label'], number][] = [['P25', distribution.p25], ['P50', distribution.p50], ['P75', distribution.p75]];
  const scenarios = scenarioDefinitions.map(([label, paceFactor]) => {
    const projectedCumulativeExpenditure = Math.min(input.totalEstimatedCost, Math.max(input.recordedExpenditure, input.totalEstimatedCost * paceFactor * progressAtHorizon));
    const remainingApprovedAllocation = input.approvedBudget - projectedCumulativeExpenditure;
    return { label, paceFactor, projectedCumulativeExpenditure, additionalExpenditure: Math.max(0, projectedCumulativeExpenditure - input.recordedExpenditure), remainingApprovedAllocation, expectedFundingGap: Math.max(0, -remainingApprovedAllocation) };
  });
  const central = scenarios[1]!;
  const decisionRequired = central.expectedFundingGap > 0
    ? `Central scenario exceeds the approved budget by ${Math.round(central.expectedFundingGap)}; confirm reprofiling, additional allocation or scope decision.`
    : null;

  return { initiativeId: input.initiativeId, eligible: true, scheduleProgressAtAsOf: progressAtAsOf, scheduleProgressAtHorizon: progressAtHorizon, approvedBudget: input.approvedBudget, committedAmount: committed, uncommittedAllocation: uncommitted, scenarios, decisionRequired, confidence: distribution.confidence, provenance };
}

/* ---------- Backtesting, error metrics and drift monitoring ---------- */

export interface BacktestCase {
  /** Inputs as they were known at the historical as-of date. */
  inputsAtAsOf: readonly BudgetForecastInput[];
  asOf: string;
  horizon: string;
  /** Actual cumulative expenditure observed at the horizon, per initiative. */
  actualAtHorizon: Readonly<Record<string, number>>;
}

export interface ForecastErrorMetrics {
  modelVersion: string;
  asOf: string;
  horizon: string;
  evaluated: number;
  /** Mean absolute percentage error of the P50 projection against actuals (undefined when nothing was evaluable). */
  mape: number | null;
  /** Mean signed error (projected minus actual) divided by actual; positive means the model over-forecasts. */
  bias: number | null;
  /** Share of actuals that fell within the P25..P75 scenario band. */
  bandCoverage: number | null;
  confidence: ForecastConfidence;
}

export function backtest(testCase: BacktestCase): ForecastErrorMetrics {
  const distribution = buildPaceDistribution(testCase.inputsAtAsOf, testCase.asOf);
  const errors: number[] = [];
  const signed: number[] = [];
  let inBand = 0;
  let evaluated = 0;
  for (const input of testCase.inputsAtAsOf) {
    const actual = testCase.actualAtHorizon[input.initiativeId];
    if (actual === undefined || actual <= 0) continue;
    const forecast = forecastInitiative(input, distribution, testCase.asOf, testCase.horizon);
    if (!forecast.eligible) continue;
    const p25 = forecast.scenarios[0]!.projectedCumulativeExpenditure;
    const p50 = forecast.scenarios[1]!.projectedCumulativeExpenditure;
    const p75 = forecast.scenarios[2]!.projectedCumulativeExpenditure;
    evaluated += 1;
    errors.push(Math.abs(p50 - actual) / actual);
    signed.push((p50 - actual) / actual);
    if (actual >= p25 && actual <= p75) inBand += 1;
  }
  const mean = (values: number[]) => (values.length ? values.reduce((a, b) => a + b, 0) / values.length : null);
  return { modelVersion: FORECAST_MODEL_VERSION, asOf: testCase.asOf, horizon: testCase.horizon, evaluated, mape: mean(errors), bias: mean(signed), bandCoverage: evaluated ? inBand / evaluated : null, confidence: distribution.confidence };
}

export interface DriftObservation {
  at: string;
  metrics: ForecastErrorMetrics;
}

export interface DriftStatus {
  observations: number;
  latestMape: number | null;
  baselineMape: number | null;
  /** True when the latest MAPE exceeds the baseline by more than the tolerance. */
  drifting: boolean;
  recommendation: string;
}

/** Drift monitoring port. Implementations persist observations; the in-memory one supports tests and the demo. */
export interface ForecastDriftMonitor {
  record(observation: DriftObservation): Promise<void>;
  status(tolerance?: number): Promise<DriftStatus>;
}

export class InMemoryForecastDriftMonitor implements ForecastDriftMonitor {
  readonly #observations: DriftObservation[] = [];

  async record(observation: DriftObservation): Promise<void> {
    this.#observations.push(observation);
  }

  async status(tolerance = 0.1): Promise<DriftStatus> {
    const withMape = this.#observations.filter((o) => o.metrics.mape !== null);
    const baseline = withMape[0]?.metrics.mape ?? null;
    const latest = withMape[withMape.length - 1]?.metrics.mape ?? null;
    const drifting = baseline !== null && latest !== null && latest > baseline + tolerance;
    return {
      observations: this.#observations.length,
      latestMape: latest,
      baselineMape: baseline,
      drifting,
      recommendation: drifting ? 'Recalibrate the pace distribution and review exclusions before further planning use.' : withMape.length === 0 ? 'No backtest recorded yet; run a backtest before relying on the forecast.' : 'Error within tolerance; keep monitoring each reporting cycle.',
    };
  }
}

export interface RecalibrationMetadata {
  modelVersion: string;
  calibratedAt: string;
  asOf: string;
  sampleSize: number;
  confidence: ForecastConfidence;
  excludedCount: number;
  minimumScheduleProgress: number;
}

export function recalibrationMetadata(distribution: PaceDistribution, calibratedAt: string, minimumScheduleProgress = 0.1): RecalibrationMetadata {
  return { modelVersion: distribution.modelVersion, calibratedAt, asOf: distribution.asOf, sampleSize: distribution.sampleSize, confidence: distribution.confidence, excludedCount: distribution.calibration.excluded.length, minimumScheduleProgress };
}
