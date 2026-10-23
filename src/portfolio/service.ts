import { FORECAST_MODEL_VERSION, SCENARIO_SEMANTICS, buildPaceDistribution, forecastInitiative, recalibrationMetadata, type ForecastConfidence } from '../forecast/budget-forecast.ts';
import { assertPublicClassification, type DataClassificationLabel, type PortfolioDataProvider } from './contracts.ts';

/**
 * Portfolio application service. Aggregates initiatives into cells (portfolio,
 * business area, award status), runs the governed forecast and exposes funding
 * gaps as management exceptions. Individual source rows never leave the service
 * when the build is public.
 */
export interface PortfolioCell {
  portfolio: string;
  businessArea: string;
  awardStatus: string;
  count: number;
  totalCost: number;
  expenditure: number;
  budget2026: number;
  committed: number;
  forecastEligibleCount: number;
  forecastEligibleBudget: number;
  forecastP25: number;
  forecastP50: number;
  forecastP75: number;
  /** Sum of central-scenario funding gaps in the cell. */
  fundingGapP50: number;
}

export interface PortfolioException {
  initiativeId: string;
  businessArea: string;
  portfolio: string;
  severity: 'high' | 'watch';
  expectedFundingGap: number;
  decisionRequired: string;
}

export interface PortfolioDto {
  classification: DataClassificationLabel;
  provider: string;
  mode: 'synthetic' | 'production';
  generatedAt: string;
  cells: readonly PortfolioCell[];
  forecastMeta: {
    asOf: string;
    horizon: string;
    sampleSize: number;
    minimumScheduleProgress: number;
    paceP25: number;
    paceP50: number;
    paceP75: number;
    confidence: ForecastConfidence;
    modelVersion: string;
    scenarioSemantics: string;
    excluded: readonly { initiativeId: string; reason: string }[];
    recalibration: ReturnType<typeof recalibrationMetadata>;
  };
  totals: { initiatives: number; totalCost: number; expenditure: number; budget2026: number; committed: number; fundingGapP50: number };
  exceptions: readonly PortfolioException[];
}

const round2 = (value: number): number => Math.round(value * 100) / 100;

export class PortfolioService {
  readonly #provider: PortfolioDataProvider;
  readonly #now: () => string;
  readonly #publicBuild: boolean;

  constructor(provider: PortfolioDataProvider, options: { now?: () => string; publicBuild: boolean }) {
    this.#provider = provider;
    this.#now = options.now ?? (() => new Date().toISOString());
    this.#publicBuild = options.publicBuild;
  }

  async build(asOf: string, horizon: string): Promise<PortfolioDto> {
    const initiatives = await this.#provider.listInitiatives();
    if (this.#publicBuild) assertPublicClassification(initiatives);
    const distribution = buildPaceDistribution(initiatives, asOf);
    const cells = new Map<string, PortfolioCell>();
    const exceptions: PortfolioException[] = [];
    let gapTotal = 0;
    for (const initiative of initiatives) {
      const key = `${initiative.portfolio}|${initiative.businessArea}|${initiative.awardStatus}`;
      const cell = cells.get(key) ?? { portfolio: initiative.portfolio, businessArea: initiative.businessArea, awardStatus: initiative.awardStatus, count: 0, totalCost: 0, expenditure: 0, budget2026: 0, committed: 0, forecastEligibleCount: 0, forecastEligibleBudget: 0, forecastP25: 0, forecastP50: 0, forecastP75: 0, fundingGapP50: 0 };
      cell.count += 1;
      cell.totalCost = round2(cell.totalCost + initiative.totalEstimatedCost);
      cell.expenditure = round2(cell.expenditure + initiative.recordedExpenditure);
      cell.budget2026 = round2(cell.budget2026 + initiative.approvedBudget);
      cell.committed = round2(cell.committed + (initiative.committedAmount ?? 0));
      const forecast = forecastInitiative(initiative, distribution, asOf, horizon);
      if (forecast.eligible) {
        cell.forecastEligibleCount += 1;
        cell.forecastEligibleBudget = round2(cell.forecastEligibleBudget + initiative.approvedBudget);
        cell.forecastP25 = round2(cell.forecastP25 + forecast.scenarios[0]!.additionalExpenditure);
        cell.forecastP50 = round2(cell.forecastP50 + forecast.scenarios[1]!.additionalExpenditure);
        cell.forecastP75 = round2(cell.forecastP75 + forecast.scenarios[2]!.additionalExpenditure);
        const gap = forecast.scenarios[1]!.expectedFundingGap;
        if (gap > 0) {
          cell.fundingGapP50 = round2(cell.fundingGapP50 + gap);
          gapTotal += gap;
          exceptions.push({ initiativeId: initiative.initiativeId, businessArea: initiative.businessArea, portfolio: initiative.portfolio, severity: gap > initiative.approvedBudget * 0.25 ? 'high' : 'watch', expectedFundingGap: round2(gap), decisionRequired: forecast.decisionRequired ?? '' });
        }
      }
      cells.set(key, cell);
    }
    const ordered = [...cells.values()].sort((a, b) => a.portfolio.localeCompare(b.portfolio) || a.businessArea.localeCompare(b.businessArea) || a.awardStatus.localeCompare(b.awardStatus));
    const totals = ordered.reduce((acc, cell) => ({ initiatives: acc.initiatives + cell.count, totalCost: round2(acc.totalCost + cell.totalCost), expenditure: round2(acc.expenditure + cell.expenditure), budget2026: round2(acc.budget2026 + cell.budget2026), committed: round2(acc.committed + cell.committed), fundingGapP50: round2(gapTotal) }), { initiatives: 0, totalCost: 0, expenditure: 0, budget2026: 0, committed: 0, fundingGapP50: 0 });
    return {
      classification: this.#provider.classification,
      provider: this.#provider.id,
      mode: this.#provider.mode,
      generatedAt: this.#now(),
      cells: ordered,
      forecastMeta: { asOf, horizon, sampleSize: distribution.sampleSize, minimumScheduleProgress: 0.1, paceP25: distribution.p25, paceP50: distribution.p50, paceP75: distribution.p75, confidence: distribution.confidence, modelVersion: FORECAST_MODEL_VERSION, scenarioSemantics: SCENARIO_SEMANTICS, excluded: distribution.calibration.excluded, recalibration: recalibrationMetadata(distribution, this.#now()) },
      totals,
      exceptions: exceptions.sort((a, b) => b.expectedFundingGap - a.expectedFundingGap),
    };
  }
}
