import { AGENT_CATALOG } from '../agent-os/catalog.ts';
import type { ModelGateway } from '../agent-os/contracts.ts';
import { InMemoryMemoryStore, type MemoryStore } from '../agent-os/memory.ts';
import { AgentRuntime } from '../agent-os/orchestrator.ts';
import { buildStandardTools } from '../agent-os/standard-tools.ts';
import { createStandardHandlers } from '../agents/index.ts';
import { InMemoryAuditLog, type AuditLog } from '../audit/log.ts';
import { InMemoryDecisionLedger, type DecisionLedger } from '../ledger/contracts.ts';
import { createTokenDirectory } from '../auth/token-directory.ts';
import { InMemoryConditionReadPort } from '../connectors/condition/port.ts';
import { InMemoryContractReadPort } from '../connectors/contract/port.ts';
import { MaximoRestClient } from '../connectors/maximo/client.ts';
import { MockMaximoReadPort } from '../connectors/maximo/mock.ts';
import type { MaximoReadPort } from '../connectors/maximo/port.ts';
import type { AppConfig } from '../config.ts';
import { DEMO_ASSETS, DEMO_CONDITION_PROFILES, DEMO_CONTRACT_KPI_SET, DEMO_PM_RECORDS, DEMO_REPORT, DEMO_SCOPE, DEMO_WORK_ORDERS } from '../demo.ts';
import { OpenAiCompatibleGateway } from '../llm/openai-compatible.ts';
import type { SqlDatabase } from '../persistence/sql.ts';
import { InMemoryReportStore, type ReportStore } from '../reporting/store.ts';
import type { ApiDependencies } from '../api/router.ts';
import { ControlTowerService } from './control-tower-service.ts';
import { PortfolioService } from '../portfolio/service.ts';
import { createSyntheticPortfolioProvider } from '../portfolio/synthetic.ts';
import { assertConsistentMode, type DataProviders } from '../providers/contracts.ts';
import { createContractRepositoryProvider, createMaximoReadProvider } from '../providers/production.ts';
import { createSyntheticProviders } from '../providers/synthetic.ts';

/**
 * Composition root. Builds every port and adapter from configuration so the
 * server, tests and scripts share one wiring. Domain modules never read the
 * environment themselves.
 */
export interface Application {
  api: ApiDependencies;
  runtime: AgentRuntime;
  providers: DataProviders;
  controlTower: ControlTowerService;
  close(): Promise<void>;
}

export interface ComposeOverrides {
  /** Supplied by the host when DATABASE_URL is set (keeps `pg` out of the domain layer). */
  database?: SqlDatabase;
  maximo?: MaximoReadPort;
  modelGateway?: ModelGateway | null;
  now?: () => string;
}

export async function composeApplication(config: AppConfig, overrides: ComposeOverrides = {}): Promise<Application> {
  let auditLog: AuditLog;
  let memoryStore: MemoryStore;
  let reportStore: ReportStore;
  let ledger: DecisionLedger;
  let persistence: ApiDependencies['persistence'] = 'in-memory';
  let close: () => Promise<void> = async () => {};

  if (overrides.database) {
    const { PgAuditLog, PgDecisionLedger, PgMemoryStore, PgReportStore, ensureSchema } = await import('../persistence/postgres.ts');
    await ensureSchema(overrides.database);
    auditLog = new PgAuditLog(overrides.database);
    memoryStore = new PgMemoryStore(overrides.database);
    reportStore = new PgReportStore(overrides.database);
    ledger = new PgDecisionLedger(overrides.database);
    persistence = 'postgres';
    const db = overrides.database;
    close = () => db.close();
  } else {
    auditLog = new InMemoryAuditLog();
    memoryStore = new InMemoryMemoryStore();
    reportStore = new InMemoryReportStore();
    ledger = new InMemoryDecisionLedger();
  }

  /*
   * Provider selection. Demo mode uses the synthetic provider for everything.
   * Production mode requires live adapters for every source and refuses to
   * start otherwise: a missing source never falls back to synthetic data.
   */
  let providers: DataProviders;
  let maximo: MaximoReadPort;
  let contract;
  let condition;
  if (config.mode === 'production') {
    const missing: string[] = [];
    if (!config.maximo.baseUrl && !overrides.maximo) missing.push('MAXIMO_BASE_URL (Maximo read adapter)');
    missing.push('contract repository adapter (not implemented; only the in-memory demo set exists)');
    missing.push('condition-monitoring adapter (not implemented; only synthetic profiles exist)');
    throw new Error(`RAILMIND_MODE=production cannot start: ${missing.join('; ')}. Synthetic fallback is refused in production.`);
  }
  maximo = overrides.maximo ?? new MockMaximoReadPort({ assets: DEMO_ASSETS, workOrders: DEMO_WORK_ORDERS, preventiveMaintenance: DEMO_PM_RECORDS });
  contract = new InMemoryContractReadPort([DEMO_CONTRACT_KPI_SET]);
  condition = new InMemoryConditionReadPort(DEMO_CONDITION_PROFILES);
  providers = createSyntheticProviders({ assets: DEMO_ASSETS, workOrders: DEMO_WORK_ORDERS, preventiveMaintenance: DEMO_PM_RECORDS, conditionProfiles: DEMO_CONDITION_PROFILES, kpiSets: [DEMO_CONTRACT_KPI_SET] });
  assertConsistentMode(providers);
  void createMaximoReadProvider; void createContractRepositoryProvider; void MaximoRestClient;

  const modelGateway: ModelGateway | null = overrides.modelGateway !== undefined
    ? overrides.modelGateway
    : (config.llm.baseUrl ? new OpenAiCompatibleGateway({ baseUrl: config.llm.baseUrl, model: config.llm.model, apiKey: config.llm.apiKey }) : null);

  const runtime = new AgentRuntime({
    catalog: AGENT_CATALOG,
    tools: buildStandardTools({ maximo, contract, condition, memory: memoryStore }),
    handlers: createStandardHandlers(DEMO_SCOPE),
    auditLog,
    memoryStore,
    modelGateway,
    modelPolicy: { baseUrl: config.llm.baseUrl, remoteApprovedForInternal: config.llm.remoteApprovedForInternal, remoteApprovedForConfidential: config.llm.remoteApprovedForConfidential },
    ledger,
    now: overrides.now,
  });

  const controlTower = new ControlTowerService(providers, reportStore, DEMO_REPORT, overrides.now);
  /* Portfolio: synthetic provider in demo mode; a private provider would be injected here for internal builds and is refused in public builds by classification. */
  const portfolio = new PortfolioService(createSyntheticPortfolioProvider(), { now: overrides.now, publicBuild: config.mode === 'demo' });

  return {
    api: { reportStore, auditLog, memoryStore, seedReport: DEMO_REPORT, persistence, runtime, classification: config.classification, now: overrides.now, tokenDirectory: createTokenDirectory(config.usersJson), healthCheck: overrides.database ? async () => { await overrides.database?.query('SELECT 1'); } : undefined, controlTower, scope: DEMO_SCOPE, mode: providers.mode, ledger, portfolio },
    runtime,
    providers,
    controlTower,
    close,
  };
}
