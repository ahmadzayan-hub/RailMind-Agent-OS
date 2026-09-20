import { AGENT_CATALOG } from '../agent-os/catalog.ts';
import type { ModelGateway } from '../agent-os/contracts.ts';
import { InMemoryMemoryStore, type MemoryStore } from '../agent-os/memory.ts';
import { InMemoryRunStore, type RunStore } from '../agent-os/run-store.ts';
import { AgentRuntime } from '../agent-os/orchestrator.ts';
import { buildStandardTools } from '../agent-os/standard-tools.ts';
import { createStandardHandlers } from '../agents/index.ts';
import { InMemoryAuditLog, type AuditLog } from '../audit/log.ts';
import { InMemoryDecisionLedger, type DecisionLedger } from '../ledger/contracts.ts';
import { createTokenDirectory } from '../auth/token-directory.ts';
import { ConditionMonitoringRestClient } from '../connectors/condition/client.ts';
import { InMemoryConditionReadPort, type ConditionReadPort } from '../connectors/condition/port.ts';
import { InMemoryContractReadPort, type ContractReadPort } from '../connectors/contract/port.ts';
import { createDocumentContractReadPort } from '../connectors/contract/repository.ts';
import { MaximoRestClient } from '../connectors/maximo/client.ts';
import { MockMaximoReadPort } from '../connectors/maximo/mock.ts';
import type { MaximoReadPort } from '../connectors/maximo/port.ts';
import type { AppConfig } from '../config.ts';
import { DEMO_ASSETS, DEMO_CONDITION_PROFILES, DEMO_CONTRACT_KPI_SET, DEMO_INVOICES, DEMO_PM_RECORDS, DEMO_REPORT, DEMO_SCOPE, DEMO_WORK_ORDERS } from '../demo.ts';
import { OpenAiCompatibleGateway } from '../llm/openai-compatible.ts';
import type { SqlDatabase } from '../persistence/sql.ts';
import { InMemoryReportStore, type ReportStore } from '../reporting/store.ts';
import type { ApiDependencies } from '../api/router.ts';
import { ControlTowerService, type TowerScope } from './control-tower-service.ts';
import type { ReportPackage } from '../reporting/contracts.ts';
import { PortfolioService } from '../portfolio/service.ts';
import { createSyntheticPortfolioProvider } from '../portfolio/synthetic.ts';
import { assertConsistentMode, type DataProviders } from '../providers/contracts.ts';
import { createConditionMonitoringProvider, createContractRepositoryProvider, createMaximoReadProvider, type ConditionMonitoringSource } from '../providers/production.ts';
import { buildReportPackage } from '../reporting/generator.ts';
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
  /** Parsed JSON of the contract repository export; the host reads CONTRACT_REPOSITORY_PATH. */
  contractDocument?: unknown;
  contract?: ContractReadPort;
  condition?: ConditionReadPort & ConditionMonitoringSource;
  modelGateway?: ModelGateway | null;
  now?: () => string;
}

/** Everything production mode needs before it starts; every gap is named in one error. */
function productionGaps(config: AppConfig, overrides: ComposeOverrides): readonly string[] {
  const missing: string[] = [];
  if (!config.usersJson) missing.push('RAILMIND_USERS (demo tokens are refused in production)');
  if (!config.databaseUrl && !overrides.database) missing.push('DATABASE_URL (in-memory audit and ledger are refused in production)');
  if (!config.maximo.baseUrl && !overrides.maximo) missing.push('MAXIMO_BASE_URL (Maximo read adapter)');
  if (overrides.contractDocument === undefined && !overrides.contract) missing.push('CONTRACT_REPOSITORY_PATH (approved contract repository export)');
  if (!config.condition.baseUrl && !overrides.condition) missing.push('CONDITION_BASE_URL (condition-monitoring read adapter)');
  if (!config.scope) missing.push('RAILMIND_CONTRACT_ID, RAILMIND_PERIOD_START and RAILMIND_PERIOD_END (reporting scope)');
  return missing;
}

export async function composeApplication(config: AppConfig, overrides: ComposeOverrides = {}): Promise<Application> {
  let auditLog: AuditLog;
  let memoryStore: MemoryStore;
  let reportStore: ReportStore;
  let ledger: DecisionLedger;
  let runStore: RunStore;
  let persistence: ApiDependencies['persistence'] = 'in-memory';
  let close: () => Promise<void> = async () => {};

  if (overrides.database) {
    const { PgAuditLog, PgDecisionLedger, PgMemoryStore, PgReportStore, PgRunStore, ensureSchema } = await import('../persistence/postgres.ts');
    await ensureSchema(overrides.database);
    auditLog = new PgAuditLog(overrides.database);
    memoryStore = new PgMemoryStore(overrides.database);
    reportStore = new PgReportStore(overrides.database);
    ledger = new PgDecisionLedger(overrides.database);
    runStore = new PgRunStore(overrides.database);
    persistence = 'postgres';
    const db = overrides.database;
    close = () => db.close();
  } else {
    auditLog = new InMemoryAuditLog();
    memoryStore = new InMemoryMemoryStore();
    reportStore = new InMemoryReportStore();
    ledger = new InMemoryDecisionLedger();
    runStore = new InMemoryRunStore();
  }

  /*
   * Provider selection. Demo mode uses the synthetic provider for everything.
   * Production mode requires live adapters for every source and refuses to
   * start otherwise: a missing source never falls back to synthetic data.
   */
  let providers: DataProviders;
  let maximo: MaximoReadPort;
  let contract: ContractReadPort;
  let condition: ConditionReadPort;
  let scope: TowerScope;
  let seedReport: ReportPackage;
  if (config.mode === 'production') {
    const missing = productionGaps(config, overrides);
    if (missing.length > 0) throw new Error(`RAILMIND_MODE=production cannot start: ${missing.join('; ')}. Synthetic fallback is refused in production.`);
    maximo = overrides.maximo ?? new MaximoRestClient({ baseUrl: config.maximo.baseUrl as string, apiKey: config.maximo.apiKey, objectStructures: config.maximo.objectStructures });
    const contractPort = overrides.contract ?? createDocumentContractReadPort(overrides.contractDocument);
    if (!overrides.contract) {
      const unapproved = (contractPort as ReturnType<typeof createDocumentContractReadPort>).sets.filter((set) => set.approvalStatus !== 'approved');
      if (unapproved.length > 0) throw new Error(`RAILMIND_MODE=production cannot start: contract repository sets ${unapproved.map((set) => `${set.contractId}/${set.definitionVersion} (${set.approvalStatus})`).join(', ')} are not approved.`);
    }
    contract = contractPort;
    const conditionClient = overrides.condition ?? new ConditionMonitoringRestClient({ baseUrl: config.condition.baseUrl as string, apiKey: config.condition.apiKey });
    condition = conditionClient;
    const maintenance = createMaximoReadProvider(maximo, { now: overrides.now });
    providers = { mode: 'production', maintenance, finance: maintenance, contract: createContractRepositoryProvider(contract, { now: overrides.now }), condition: createConditionMonitoringProvider(conditionClient, { now: overrides.now }) };
    const configured = config.scope as NonNullable<AppConfig['scope']>;
    scope = { contractId: configured.contractId, periodStart: configured.periodStart, periodEnd: configured.periodEnd };
    /* The seed package is built through the same governed pipeline; the API refreshes its KPIs on every read. */
    seedReport = buildReportPackage({ reportId: `${scope.contractId}-MONTHLY-${scope.periodEnd.slice(0, 7)}`, cadence: 'monthly', contractId: scope.contractId, periodStart: scope.periodStart, periodEnd: scope.periodEnd, kpis: [] });
  } else {
    maximo = overrides.maximo ?? new MockMaximoReadPort({ assets: DEMO_ASSETS, workOrders: DEMO_WORK_ORDERS, preventiveMaintenance: DEMO_PM_RECORDS, invoices: DEMO_INVOICES });
    contract = new InMemoryContractReadPort([DEMO_CONTRACT_KPI_SET]);
    condition = new InMemoryConditionReadPort(DEMO_CONDITION_PROFILES);
    providers = createSyntheticProviders({ assets: DEMO_ASSETS, workOrders: DEMO_WORK_ORDERS, preventiveMaintenance: DEMO_PM_RECORDS, conditionProfiles: DEMO_CONDITION_PROFILES, kpiSets: [DEMO_CONTRACT_KPI_SET], invoices: DEMO_INVOICES });
    scope = config.scope ? { ...config.scope, priorBreachesByKpi: DEMO_SCOPE.priorBreachesByKpi } : DEMO_SCOPE;
    seedReport = DEMO_REPORT;
  }
  assertConsistentMode(providers);

  const modelGateway: ModelGateway | null = overrides.modelGateway !== undefined
    ? overrides.modelGateway
    : (config.llm.baseUrl ? new OpenAiCompatibleGateway({ baseUrl: config.llm.baseUrl, model: config.llm.model, apiKey: config.llm.apiKey }) : null);

  const runtime = new AgentRuntime({
    catalog: AGENT_CATALOG,
    tools: buildStandardTools({ maximo, contract, condition, memory: memoryStore }),
    handlers: createStandardHandlers(scope),
    auditLog,
    memoryStore,
    modelGateway,
    modelPolicy: { baseUrl: config.llm.baseUrl, remoteApprovedForInternal: config.llm.remoteApprovedForInternal, remoteApprovedForConfidential: config.llm.remoteApprovedForConfidential },
    ledger,
    runStore,
    now: overrides.now,
  });

  const controlTower = new ControlTowerService(providers, reportStore, seedReport, overrides.now);
  if (config.mode === 'production') seedReport = await controlTower.seedPackage(scope);
  /* Portfolio: synthetic provider in demo mode; a private provider would be injected here for internal builds and is refused in public builds by classification. */
  const portfolio = new PortfolioService(createSyntheticPortfolioProvider(), { now: overrides.now, publicBuild: config.mode === 'demo' });

  return {
    api: { reportStore, auditLog, memoryStore, seedReport, persistence, runtime, classification: config.classification, now: overrides.now, tokenDirectory: createTokenDirectory(config.usersJson), healthCheck: overrides.database ? async () => { await overrides.database?.query('SELECT 1'); } : undefined, controlTower, scope, mode: providers.mode, ledger, portfolio },
    runtime,
    providers,
    controlTower,
    close,
  };
}
