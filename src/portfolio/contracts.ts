import type { AwardStatus, BudgetForecastInput } from '../forecast/budget-forecast.ts';

/**
 * Portfolio domain. Public builds carry synthetic records only; every record
 * declares its classification and the composition root refuses anything but
 * PUBLIC_SYNTHETIC in demo mode.
 */
export type DataClassificationLabel = 'PUBLIC_SYNTHETIC' | 'INTERNAL' | 'CONFIDENTIAL' | 'RESTRICTED';

export interface PortfolioInitiative extends BudgetForecastInput {
  classification: DataClassificationLabel;
  /** Provider that produced the record. */
  source: string;
}

export interface PortfolioDataProvider {
  readonly id: string;
  readonly mode: 'synthetic' | 'production';
  readonly classification: DataClassificationLabel;
  listInitiatives(): Promise<readonly PortfolioInitiative[]>;
}

export class ClassificationError extends Error {}

/** Public and demo builds accept PUBLIC_SYNTHETIC records only. */
export function assertPublicClassification(records: readonly { classification: DataClassificationLabel; initiativeId: string }[]): void {
  const offending = records.filter((r) => r.classification !== 'PUBLIC_SYNTHETIC');
  if (offending.length > 0) {
    throw new ClassificationError(`Public build refused: ${offending.length} record(s) are not PUBLIC_SYNTHETIC (${offending.slice(0, 3).map((r) => `${r.initiativeId}:${r.classification}`).join(', ')}).`);
  }
}

export const AWARD_STATUSES: readonly AwardStatus[] = ['Awarded / Delivery Party Identified', 'Not Awarded'];
