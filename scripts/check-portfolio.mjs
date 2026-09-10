import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildPortfolioPack, renderPortfolioPackModule } from '../src/web/portfolio-pack.ts';
import { generateSyntheticPortfolio } from '../src/portfolio/synthetic.ts';

const html = readFileSync(new URL('../web/portfolio.html', import.meta.url), 'utf8');
const js = readFileSync(new URL('../web/portfolio.js', import.meta.url), 'utf8');
const packSource = readFileSync(new URL('../web/data/portfolio-pack.js', import.meta.url), 'utf8');

// 1. Privacy boundary: no organisation, vendor, project or source-system identifiers in the public workspace.
const restricted = /(?<![A-Z0-9])(?:RTA|RMD|DUBAI|METRO|TRAM|HITATCHI|ALSTOM|WSP|SENER|TTE|AVALON|SHARAF|WINSTAR|WAAGNER|TUV|THYSSENKRUPP|ENOVA|WILO|HEAD QUARTER|GROUP 4|G4S|KINKISHARYO|JEBEL|BUSINESS BAY|ONPASSIVE|QDP|JDP|OVPD|RAA\/RMD|RA\/RM|MAXIMO)(?![A-Z0-9])/i;
for (const [name, text] of [['portfolio.html', html], ['portfolio.js', js], ['portfolio-pack.js', packSource]]) {
  assert.equal(restricted.test(text), false, `${name} contains a restricted identifier.`);
}

// 2. Known real aggregate fingerprints from the retired embedded snapshot must never reappear.
const retiredFingerprints = ['364969387', '72805360', '122403998', '11706580', '15067608', '35491353', '0.44737723965408616', '0.5660501300389731', '0.8301974534532033'];
for (const [name, text] of [['portfolio.html', html], ['portfolio.js', js], ['portfolio-pack.js', packSource]]) {
  for (const fingerprint of retiredFingerprints) assert.equal(text.includes(fingerprint), false, `${name} contains retired real aggregate ${fingerprint}.`);
}

// 3. Local, dependency-free: scripts may only be local module files.
assert.equal(/<script[^>]*src=["'](?!\.\/)/i.test(html), false, 'Portfolio workspace must not load external scripts.');
assert.equal(/<script>(?!\s*<\/script>)/i.test(html), false, 'Portfolio workspace must not embed inline scripts (CSP).');
assert.match(html, /SYNTHETIC/, 'Portfolio workspace must carry the synthetic watermark.');
new Function(js.replace(/^import .*$/gm, '').replace(/^export /gm, ''));

// 4. The static pack equals the service output and is provably synthetic.
const pack = await buildPortfolioPack();
assert.equal(packSource, renderPortfolioPackModule(pack), 'web/data/portfolio-pack.js has drifted. Run `npm run build:web-data`.');
assert.equal(pack.classification, 'PUBLIC_SYNTHETIC');
assert.equal(pack.mode, 'synthetic');
assert.equal(pack.totals.initiatives, generateSyntheticPortfolio().length);
assert.ok(pack.forecastMeta.paceP25 <= pack.forecastMeta.paceP50 && pack.forecastMeta.paceP50 <= pack.forecastMeta.paceP75);
assert.ok(pack.forecastMeta.excluded.every((e) => e.reason !== undefined));
assert.equal(pack.forecastMeta.excluded.some((e) => e.reason === 'completed on or before the as-of date') || generateSyntheticPortfolio().every((i) => i.executionEnd > pack.forecastMeta.asOf), true);
assert.doesNotMatch(pack.forecastMeta.scenarioSemantics, /confidence interval(?!s)/);
for (const cell of pack.cells) {
  assert.deepEqual(Object.keys(cell).sort(), ['awardStatus', 'budget2026', 'businessArea', 'committed', 'count', 'expenditure', 'forecastEligibleBudget', 'forecastEligibleCount', 'forecastP25', 'forecastP50', 'forecastP75', 'fundingGapP50', 'portfolio', 'totalCost']);
}
console.log('PASS: portfolio workspace is synthetic, dependency-free, privacy-bounded and matches the service.');
