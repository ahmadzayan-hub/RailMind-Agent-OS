import { writeFileSync } from 'node:fs';
import { buildDemoPack, renderDemoPackModule } from '../src/web/demo-pack.ts';
import { buildPortfolioPack, renderPortfolioPackModule } from '../src/web/portfolio-pack.ts';
import { buildGisPack, renderGisPackModule } from '../src/web/gis-pack.ts';
import { buildContractTwinPack, renderContractTwinPackModule } from '../src/web/contract-twin-pack.ts';

writeFileSync(new URL('../web/data/demo-pack.js', import.meta.url), renderDemoPackModule(await buildDemoPack()), 'utf8');
writeFileSync(new URL('../web/data/portfolio-pack.js', import.meta.url), renderPortfolioPackModule(await buildPortfolioPack()), 'utf8');
writeFileSync(new URL('../web/data/gis-pack.js', import.meta.url), renderGisPackModule(await buildGisPack()), 'utf8');
writeFileSync(new URL('../web/data/contract-twin-pack.js', import.meta.url), renderContractTwinPackModule(await buildContractTwinPack()), 'utf8');
console.log('Wrote web/data/demo-pack.js, web/data/gis-pack.js, web/data/contract-twin-pack.js and web/data/portfolio-pack.js from the application services (synthetic providers).');
