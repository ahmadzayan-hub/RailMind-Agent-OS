import type { DataClassification } from './agent-os/contracts.ts';

/**
 * Typed runtime configuration read from environment variables. Missing values
 * fall back to the synthetic in-memory demo. Secrets are never logged.
 */
export interface AppConfig {
  port: number;
  /** demo: synthetic providers. production: live providers only; synthetic fallback refused. */
  mode: 'demo' | 'production';
  databaseUrl: string | null;
  classification: DataClassification;
  /** JSON directory of principals with token hashes; null selects the demo directory. */
  usersJson: string | null;
  llm: { baseUrl: string | null; model: string; apiKey: string | undefined; remoteApprovedForInternal: boolean; remoteApprovedForConfidential: boolean };
  maximo: { baseUrl: string | null; apiKey: string | undefined; objectStructures: { assets: string; workOrders: string; preventiveMaintenance: string; meters: string; invoices: string } };
  /** Read-only condition-monitoring REST source (production only). */
  condition: { baseUrl: string | null; apiKey: string | undefined };
  /** Path to the approved contract repository export (JSON); read by the host, parsed by the domain. */
  contractRepositoryPath: string | null;
  /** Reporting scope: the contract and period the deployment serves. Null selects the synthetic demo scope. */
  scope: { contractId: string; periodStart: string; periodEnd: string } | null;
}

type Env = Readonly<Record<string, string | undefined>>;

function flag(value: string | undefined): boolean {
  return value !== undefined && ['1', 'true', 'yes', 'on'].includes(value.trim().toLowerCase());
}

function classification(value: string | undefined): DataClassification {
  return value === 'internal' || value === 'confidential' ? value : 'synthetic';
}

export function loadConfig(env: Env): AppConfig {
  const port = Number(env.PORT ?? 4173);
  return {
    port: Number.isFinite(port) && port >= 0 ? port : 4173,
    mode: env.RAILMIND_MODE?.trim() === 'production' ? 'production' : 'demo',
    databaseUrl: env.DATABASE_URL?.trim() || null,
    classification: classification(env.DATA_CLASSIFICATION?.trim()),
    usersJson: env.RAILMIND_USERS?.trim() || null,
    llm: {
      baseUrl: env.LLM_BASE_URL?.trim() || null,
      model: env.LLM_MODEL?.trim() || 'Qwen3-8B',
      apiKey: env.LLM_API_KEY?.trim() || undefined,
      remoteApprovedForInternal: flag(env.LLM_REMOTE_APPROVED_FOR_INTERNAL),
      remoteApprovedForConfidential: flag(env.LLM_REMOTE_APPROVED_FOR_CONFIDENTIAL),
    },
    maximo: {
      baseUrl: env.MAXIMO_BASE_URL?.trim() || null,
      apiKey: env.MAXIMO_API_KEY?.trim() || undefined,
      objectStructures: {
        assets: env.MAXIMO_OS_ASSETS?.trim() || 'MXAPIASSET',
        workOrders: env.MAXIMO_OS_WORKORDERS?.trim() || 'MXAPIWODETAIL',
        preventiveMaintenance: env.MAXIMO_OS_PM?.trim() || 'MXAPIPM',
        meters: env.MAXIMO_OS_METERS?.trim() || 'MXAPIMETER',
        invoices: env.MAXIMO_OS_INVOICES?.trim() || 'MXAPIINVOICE',
      },
    },
    condition: { baseUrl: env.CONDITION_BASE_URL?.trim() || null, apiKey: env.CONDITION_API_KEY?.trim() || undefined },
    contractRepositoryPath: env.CONTRACT_REPOSITORY_PATH?.trim() || null,
    scope: scope(env),
  };
}

function scope(env: Env): AppConfig['scope'] {
  const contractId = env.RAILMIND_CONTRACT_ID?.trim();
  const periodStart = env.RAILMIND_PERIOD_START?.trim();
  const periodEnd = env.RAILMIND_PERIOD_END?.trim();
  if (!contractId && !periodStart && !periodEnd) return null;
  if (!contractId || !periodStart || !periodEnd) throw new Error('RAILMIND_CONTRACT_ID, RAILMIND_PERIOD_START and RAILMIND_PERIOD_END must be set together.');
  if (Number.isNaN(Date.parse(periodStart)) || Number.isNaN(Date.parse(periodEnd)) || periodStart >= periodEnd) throw new Error('RAILMIND_PERIOD_START must be an ISO timestamp before RAILMIND_PERIOD_END.');
  return { contractId, periodStart, periodEnd };
}

/** Configuration summary safe to log: no secrets, only which integrations are active. */
export function describeConfig(config: AppConfig): Record<string, string | number | boolean> {
  return {
    port: config.port,
    mode: config.mode,
    persistence: config.databaseUrl ? 'postgres' : 'in-memory',
    classification: config.classification,
    auth: config.usersJson ? 'token' : 'demo',
    model: config.llm.baseUrl ? `${config.llm.model} @ ${config.llm.baseUrl}` : 'none (deterministic only)',
    maximo: config.maximo.baseUrl ? 'rest (read-only)' : 'mock',
    condition: config.condition.baseUrl ? 'rest (read-only)' : 'synthetic profiles',
    contractRepository: config.contractRepositoryPath ? 'document' : 'demo set',
    scope: config.scope ? `${config.scope.contractId} ${config.scope.periodStart.slice(0, 10)}..${config.scope.periodEnd.slice(0, 10)}` : 'synthetic demo scope',
  };
}
