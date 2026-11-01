import type { PortfolioDataProvider, PortfolioInitiative } from './contracts.ts';

/**
 * Deterministic synthetic portfolio. Values come from a seeded generator, not
 * from any organisation's records. Business areas and portfolios are generic
 * labels. The generator is reproducible so the static fallback and the API
 * agree byte for byte.
 */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const AREAS = ['Business Area-01', 'Business Area-02', 'Business Area-03', 'Business Area-04', 'Business Area-05'];

function isoDate(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export function generateSyntheticPortfolio(seed = 44, count = 30): readonly PortfolioInitiative[] {
  const random = mulberry32(seed);
  const records: PortfolioInitiative[] = [];
  for (let index = 0; index < count; index += 1) {
    const portfolio = random() < 0.85 ? 'Capital' : 'Operating';
    const area = AREAS[Math.floor(random() * AREAS.length)]!;
    const awarded = random() < 0.66;
    const cost = Math.round((2 + random() * 28) * 1_000_000 * 100) / 100;
    const startYear = 2024 + Math.floor(random() * 3);
    const startMonth = 1 + Math.floor(random() * 12);
    const durationMonths = 8 + Math.floor(random() * 30);
    const endTotal = startYear * 12 + (startMonth - 1) + durationMonths;
    const endYear = Math.floor(endTotal / 12);
    const endMonth = (endTotal % 12) + 1;
    const executionStart = isoDate(startYear, startMonth, 1);
    const executionEnd = isoDate(endYear, endMonth, 28);
    const elapsed = Math.max(0, Math.min(1, ((2026 * 12 + 8) - (startYear * 12 + startMonth - 1)) / durationMonths));
    const spendShare = awarded ? Math.min(0.95, elapsed * (0.4 + random() * 0.9)) : 0;
    const expenditure = Math.round(cost * spendShare * 100) / 100;
    const budget = Math.round(cost * (0.15 + random() * 0.35) * 100) / 100;
    const committed = awarded ? Math.round(Math.min(cost, expenditure + budget * random()) * 100) / 100 : 0;
    records.push({
      initiativeId: `SYN-${String(index + 1).padStart(3, '0')}`,
      portfolio,
      businessArea: area,
      awardStatus: awarded ? 'Awarded / Delivery Party Identified' : 'Not Awarded',
      totalEstimatedCost: cost,
      recordedExpenditure: expenditure,
      approvedBudget: budget,
      committedAmount: committed,
      executionStart,
      executionEnd,
      classification: 'PUBLIC_SYNTHETIC',
      source: 'synthetic-portfolio',
    });
  }
  return records;
}

export function createSyntheticPortfolioProvider(seed = 44): PortfolioDataProvider {
  const records = generateSyntheticPortfolio(seed);
  return { id: 'synthetic-portfolio', mode: 'synthetic', classification: 'PUBLIC_SYNTHETIC', async listInitiatives() { return records; } };
}
