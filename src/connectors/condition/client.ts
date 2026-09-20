import type { ConditionSignal } from '../../asset-intelligence/types.ts';
import type { AssetConditionProfile, ConditionReadPort } from './port.ts';

/**
 * Read-only condition-monitoring REST adapter. It exposes GET only, maps a
 * deployment's JSON field names into the RailMind condition profile and
 * surfaces every HTTP failure as an error; it never fabricates a profile.
 *
 * Expected endpoints (configurable base URL):
 *   GET {base}/assets                    -> { assets: [{ assetId }] } or a bare list
 *   GET {base}/assets/{assetId}/profile  -> one profile object
 */
export interface ConditionMonitoringRestClientConfig {
  baseUrl: string;
  apiKey?: string;
  authorizationHeader?: string;
  fetchImpl?: typeof fetch;
}

type JsonObject = Record<string, unknown>;

function asObject(value: unknown): JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? value as JsonObject : {};
}

function text(record: JsonObject, ...keys: string[]): string | undefined {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'string' && value.trim()) return value;
    if (typeof value === 'number') return String(value);
  }
  return undefined;
}

function numberValue(record: JsonObject, ...keys: string[]): number | undefined {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string' && value.trim() && Number.isFinite(Number(value))) return Number(value);
  }
  return undefined;
}

function boolValue(record: JsonObject, ...keys: string[]): boolean | undefined {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'boolean') return value;
    if (typeof value === 'string') { const v = value.trim().toLowerCase(); if (['true', 'yes', '1'].includes(v)) return true; if (['false', 'no', '0'].includes(v)) return false; }
  }
  return undefined;
}

function signals(value: unknown): readonly ConditionSignal[] {
  if (!Array.isArray(value)) return [];
  return value.map(asObject).flatMap((row) => {
    const name = text(row, 'name', 'signal', 'parameter');
    const changePct = numberValue(row, 'changePct', 'change_pct', 'change');
    const weight = numberValue(row, 'weight');
    return name && changePct !== undefined ? [{ name, changePct, weight: weight === undefined ? 0.5 : Math.min(1, Math.max(0, weight)) }] : [];
  });
}

export class ConditionMonitoringRestClient implements ConditionReadPort {
  readonly #config: ConditionMonitoringRestClientConfig;
  readonly #fetch: typeof fetch;

  constructor(config: ConditionMonitoringRestClientConfig) {
    this.#config = config;
    this.#fetch = config.fetchImpl ?? fetch;
  }

  async #get(path: string): Promise<unknown> {
    const base = this.#config.baseUrl.replace(/\/$/, '');
    const headers: Record<string, string> = { Accept: 'application/json' };
    if (this.#config.apiKey) headers['X-API-Key'] = this.#config.apiKey;
    if (this.#config.authorizationHeader) headers.Authorization = this.#config.authorizationHeader;
    const response = await this.#fetch(`${base}${path}`, { method: 'GET', headers });
    if (response.status === 404) return null;
    if (!response.ok) throw new Error(`Condition monitoring read failed: HTTP ${response.status}`);
    return response.json();
  }

  /** Maps one source profile; returns null when the payload lacks the minimum fields. */
  static mapProfile(assetId: string, payload: unknown): AssetConditionProfile | null {
    const row = asObject(payload);
    const healthIndex = numberValue(row, 'healthIndex', 'health_index', 'health');
    const observedAt = text(row, 'observedAt', 'observed_at', 'timestamp');
    if (healthIndex === undefined || !observedAt || Number.isNaN(Date.parse(observedAt))) return null;
    const id = text(row, 'assetId', 'asset_id', 'assetnum') ?? assetId;
    return {
      assetId: id,
      healthIndex: Math.min(100, Math.max(0, healthIndex)),
      healthIndex90dAgo: Math.min(100, Math.max(0, numberValue(row, 'healthIndex90dAgo', 'health_index_90d_ago', 'healthIndexPrevious') ?? healthIndex)),
      signals: signals(row.signals),
      serviceCritical: boolValue(row, 'serviceCritical', 'service_critical') ?? false,
      section: text(row, 'section', 'line', 'area') ?? 'unknown',
      observedAt,
      evidence: { sourceSystem: 'condition_monitoring', entityType: 'condition-profile', entityId: text(row, 'profileId', 'profile_id', 'id') ?? `CM-${id}`, observedAt, sourceUri: text(row, 'uri', 'href') },
    };
  }

  async getProfile(assetId: string): Promise<AssetConditionProfile | null> {
    const payload = await this.#get(`/assets/${encodeURIComponent(assetId)}/profile`);
    return payload === null ? null : ConditionMonitoringRestClient.mapProfile(assetId, payload);
  }

  async listAssetIds(): Promise<readonly string[]> {
    const payload = await this.#get('/assets');
    const list = Array.isArray(payload) ? payload : asObject(payload).assets ?? asObject(payload).member ?? asObject(payload).items;
    if (!Array.isArray(list)) return [];
    return list.flatMap((row) => { const id = typeof row === 'string' ? row : text(asObject(row), 'assetId', 'asset_id', 'assetnum', 'id'); return id ? [id] : []; });
  }

  /** ConditionMonitoringSource shape used by the production provider. */
  async listProfiles(assetIds: readonly string[]): Promise<readonly AssetConditionProfile[]> {
    const profiles = await Promise.all(assetIds.map((id) => this.getProfile(id)));
    return profiles.flatMap((p) => (p ? [p] : []));
  }
}
