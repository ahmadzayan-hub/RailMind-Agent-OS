import { buildGisView, type GisViewDto } from '../gis/service.ts';
import { DEMO_SCHEMATIC } from '../gis/demo-schematic.ts';
import { buildDemoPack } from './demo-pack.ts';

/**
 * Static GIS pack for the browser preview: the synthetic schematic joined
 * with the same Control Tower DTO the demo pack carries. Generated at build
 * time; `npm run check:web-data` fails when the committed file drifts.
 */
export type GisPack = GisViewDto;

export async function buildGisPack(): Promise<GisPack> {
  return buildGisView(DEMO_SCHEMATIC, await buildDemoPack());
}

export function renderGisPackModule(pack: GisPack): string {
  return [
    '// GENERATED FILE. Do not edit by hand.',
    '// Source: src/web/gis-pack.ts via `npm run build:web-data`. Verified by `npm run check:web-data`.',
    '// Synthetic schematic joined with the Control Tower DTO. Positions are canvas percentages, not coordinates.',
    `export const GIS_PACK = ${JSON.stringify(pack, null, 2)};`,
    '',
  ].join('\n');
}
