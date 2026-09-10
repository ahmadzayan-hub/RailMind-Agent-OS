import { writeFileSync } from 'node:fs';
import { buildDemoPack, renderDemoPackModule } from '../src/web/demo-pack.ts';
import { buildPortfolioPack, renderPortfolioPackModule } from '../src/web/portfolio-pack.ts';

writeFileSync(new URL('../web/data/demo-pack.js', import.meta.url), renderDemoPackModule(await buildDemoPack()), 'utf8');
writeFileSync(new URL('../web/data/portfolio-pack.js', import.meta.url), renderPortfolioPackModule(await buildPortfolioPack()), 'utf8');
console.log('Wrote web/data/demo-pack.js and web/data/portfolio-pack.js from the application services (synthetic providers).');
