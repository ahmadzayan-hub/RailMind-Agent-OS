import { sha256Hex } from '../audit/log.ts';
import { isRole, isScopeType, type Principal, type Role, type Scope } from './principal.ts';

/**
 * Bearer-token directory.
 *
 * Tokens are never stored in clear: the directory holds SHA-256 hashes and
 * compares the hash of the presented token. Two modes exist:
 *
 * - `token`: principals and hashes come from RAILMIND_USERS (JSON). Use
 *   `node scripts/hash-token.mjs` to produce a hash for a new token.
 * - `demo`: fixed, documented demo identities for the synthetic preview. The
 *   demo directory is refused when RAILMIND_USERS is set, so a production
 *   deployment can never fall back to demo tokens silently.
 */
export type AuthMode = 'demo' | 'token';

export interface TokenDirectory {
  readonly mode: AuthMode;
  resolve(token: string): Promise<Principal | null>;
  /** Demo identities with their tokens. Only the demo directory returns entries. */
  demoIdentities(): readonly { principal: Principal; token: string }[];
}

export interface DirectoryEntry {
  principalId: string;
  displayName: string;
  role: Role;
  /** Scopes the principal may act within. No scopes means no scoped resource is reachable. */
  scopes: readonly Scope[];
  tokenSha256: string;
}

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export class StaticTokenDirectory implements TokenDirectory {
  readonly mode: AuthMode = 'token';
  readonly #entries: readonly DirectoryEntry[];

  constructor(entries: readonly DirectoryEntry[]) {
    if (entries.length === 0) throw new Error('Token directory requires at least one principal.');
    const ids = new Set<string>();
    for (const entry of entries) {
      if (!entry.principalId.trim() || !entry.displayName.trim()) throw new Error('Directory entries require principalId and displayName.');
      if (!isRole(entry.role)) throw new Error(`Unknown role for ${entry.principalId}: ${String(entry.role)}`);
      for (const scope of entry.scopes) {
        if (!isScopeType(scope.type)) throw new Error(`Unknown scope type for ${entry.principalId}: ${String(scope.type)}`);
        if (scope.type !== 'system' && !(typeof scope.id === 'string' && scope.id.trim())) throw new Error(`Scope ${scope.type} for ${entry.principalId} requires an id.`);
      }
      if (!/^[0-9a-f]{64}$/.test(entry.tokenSha256)) throw new Error(`tokenSha256 for ${entry.principalId} must be a 64-hex SHA-256.`);
      if (ids.has(entry.principalId)) throw new Error(`Duplicate principalId: ${entry.principalId}`);
      ids.add(entry.principalId);
    }
    this.#entries = entries;
  }

  async resolve(token: string): Promise<Principal | null> {
    if (!token) return null;
    const hash = await sha256Hex(token);
    for (const entry of this.#entries) {
      if (constantTimeEqual(entry.tokenSha256, hash)) {
        return { principalId: entry.principalId, displayName: entry.displayName, role: entry.role, scopes: entry.scopes };
      }
    }
    return null;
  }

  demoIdentities(): readonly { principal: Principal; token: string }[] {
    return [];
  }
}

/** Synthetic-preview identities. Tokens are public by design and only valid in demo mode. */
const DEMO_CONTRACT: Scope = { type: 'contract', id: 'DEMO-CONTRACT' };
const DEMO_PORTFOLIO: Scope = { type: 'portfolio', id: 'SYNTHETIC' };
const SYSTEM: Scope = { type: 'system' };

export const DEMO_IDENTITIES: readonly { principal: Principal; token: string }[] = [
  { principal: { principalId: 'demo.viewer', displayName: 'Demo Viewer', role: 'viewer', scopes: [SYSTEM] }, token: 'demo-viewer' },
  { principal: { principalId: 'demo.engineer', displayName: 'Demo Maintenance Engineer', role: 'maintenance_engineer', scopes: [DEMO_CONTRACT, DEMO_PORTFOLIO, { type: 'line', id: 'Red Line' }] }, token: 'demo-engineer' },
  { principal: { principalId: 'demo.reliability', displayName: 'Demo Reliability Engineer', role: 'reliability_engineer', scopes: [DEMO_CONTRACT, DEMO_PORTFOLIO] }, token: 'demo-reliability' },
  { principal: { principalId: 'demo.contract', displayName: 'Demo Contract Manager', role: 'contract_manager', scopes: [DEMO_CONTRACT, DEMO_PORTFOLIO] }, token: 'demo-contract' },
  { principal: { principalId: 'demo.finance', displayName: 'Demo Finance Reviewer', role: 'finance_reviewer', scopes: [DEMO_CONTRACT, DEMO_PORTFOLIO] }, token: 'demo-finance' },
  { principal: { principalId: 'demo.approver', displayName: 'Demo Approver', role: 'approver', scopes: [DEMO_CONTRACT, DEMO_PORTFOLIO] }, token: 'demo-approver' },
  { principal: { principalId: 'demo.admin', displayName: 'Demo Administrator', role: 'administrator', scopes: [SYSTEM] }, token: 'demo-admin' },
  { principal: { principalId: 'demo.other', displayName: 'Demo Engineer (other contract)', role: 'maintenance_engineer', scopes: [{ type: 'contract', id: 'OTHER-CONTRACT' }] }, token: 'demo-other-contract' },
];

export class DemoTokenDirectory implements TokenDirectory {
  readonly mode: AuthMode = 'demo';

  async resolve(token: string): Promise<Principal | null> {
    const found = DEMO_IDENTITIES.find((entry) => constantTimeEqual(entry.token, token));
    return found ? { ...found.principal } : null;
  }

  demoIdentities(): readonly { principal: Principal; token: string }[] {
    return DEMO_IDENTITIES;
  }
}

/** Parses RAILMIND_USERS JSON. Throws on malformed input so misconfiguration fails at start. */
export function parseDirectoryEntries(json: string): readonly DirectoryEntry[] {
  let parsed: unknown;
  try { parsed = JSON.parse(json); } catch { throw new Error('RAILMIND_USERS is not valid JSON.'); }
  if (!Array.isArray(parsed)) throw new Error('RAILMIND_USERS must be a JSON array.');
  return parsed.map((item, index) => {
    const row = typeof item === 'object' && item !== null ? item as Record<string, unknown> : {};
    const scopesRaw = Array.isArray(row.scopes) ? row.scopes : [];
    const scopes: Scope[] = scopesRaw.map((scope) => { const value = typeof scope === 'object' && scope !== null ? scope as Record<string, unknown> : {}; return { type: value.type as Scope['type'], id: typeof value.id === 'string' ? value.id : undefined }; });
    const entry = { principalId: String(row.principalId ?? ''), displayName: String(row.displayName ?? ''), role: row.role as Role, scopes, tokenSha256: String(row.tokenSha256 ?? '') };
    if (!entry.principalId) throw new Error(`RAILMIND_USERS[${index}] is missing principalId.`);
    return entry;
  });
}

export function createTokenDirectory(usersJson: string | null): TokenDirectory {
  return usersJson ? new StaticTokenDirectory(parseDirectoryEntries(usersJson)) : new DemoTokenDirectory();
}
