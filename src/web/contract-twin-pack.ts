import { evaluateContractTwin, type ContractTwinView } from '../contract-twin/service.ts';
import { DEMO_CONTRACT_TWIN } from '../demo.ts';
import { buildDemoPack } from './demo-pack.ts';

/**
 * Static contract twin pack for the browser preview: the demo twin evaluated
 * against the same Control Tower DTO the demo pack carries. Generated at
 * build time; `npm run check:web-data` fails when the committed file drifts.
 */
export type ContractTwinPack = ContractTwinView;

export async function buildContractTwinPack(): Promise<ContractTwinPack> {
  return evaluateContractTwin(DEMO_CONTRACT_TWIN, await buildDemoPack());
}

export function renderContractTwinPackModule(pack: ContractTwinPack): string {
  return [
    '// GENERATED FILE. Do not edit by hand.',
    '// Source: src/web/contract-twin-pack.ts via `npm run build:web-data`. Verified by `npm run check:web-data`.',
    '// Demo contract twin (demo_only, synthetic clauses) evaluated against the Control Tower DTO.',
    `export const CONTRACT_TWIN_PACK = ${JSON.stringify(pack, null, 2)};`,
    '',
  ].join('\n');
}
