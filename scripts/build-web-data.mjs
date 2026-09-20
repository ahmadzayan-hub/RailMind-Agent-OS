import { writeFileSync } from 'node:fs';
import { buildDemoPack, renderDemoPackModule } from '../src/web/demo-pack.ts';
import { buildPortfolioPack, renderPortfolioPackModule } from '../src/web/portfolio-pack.ts';
import { buildGisPack, renderGisPackModule } from '../src/web/gis-pack.ts';

writeFileSync(new URL('../web/data/demo-pack.js', import.meta.url), renderDemoPackModule(await buildDemoPack()), 'utf8');
writeFileSync(new URL('../web/data/portfolio-pack.js', import.meta.url), renderPortfolioPackModule(await buildPortfolioPack()), 'utf8');
writeFileSync(new URL('../web/data/gis-pack.js', import.meta.url), renderGisPackModule(await buildGisPack()), 'utf8');
console.log('Wrote web/data/demo-pack.js, web/data/gis-pack.js and web/data/portfolio-pack.js from the application services (synthetic providers).');
