import { PortfolioService, type PortfolioDto } from '../portfolio/service.ts';
import { createSyntheticPortfolioProvider } from '../portfolio/synthetic.ts';

/** Static fallback for the portfolio workspace without the API; produced by the same service as `/api/portfolio`. */
export const PORTFOLIO_AS_OF = '2026-09-09';
export const PORTFOLIO_HORIZON = '2026-12-31';
export const PORTFOLIO_GENERATED_AT = '2026-09-09T00:00:00Z';

export async function buildPortfolioPack(): Promise<PortfolioDto> {
  const service = new PortfolioService(createSyntheticPortfolioProvider(), { now: () => PORTFOLIO_GENERATED_AT, publicBuild: true });
  return service.build(PORTFOLIO_AS_OF, PORTFOLIO_HORIZON);
}

export function renderPortfolioPackModule(pack: PortfolioDto): string {
  return [
    '// GENERATED FILE. Do not edit by hand.',
    '// Source: src/web/portfolio-pack.ts via `npm run build:web-data`. Verified by `npm run check:portfolio`.',
    '// Synthetic portfolio produced by a seeded generator. No organisational totals, budgets, vendors or identifiers.',
    `export const PORTFOLIO_PACK = ${JSON.stringify(pack, null, 2)};`,
    '',
  ].join('\n');
}
