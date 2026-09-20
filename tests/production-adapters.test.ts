import test from 'node:test';
import assert from 'node:assert/strict';

import { composeApplication } from '../src/app/compose.ts';
import { loadConfig } from '../src/config.ts';
import { ConditionMonitoringRestClient } from '../src/connectors/condition/client.ts';
import { InMemoryConditionReadPort } from '../src/connectors/condition/port.ts';
import { CONTRACT_REPOSITORY_SCHEMA, ContractRepositoryDocumentError, createDocumentContractReadPort, parseContractRepositoryDocument } from '../src/connectors/contract/repository.ts';
import { MockMaximoReadPort } from '../src/connectors/maximo/mock.ts';
import { DEMO_ASSETS, DEMO_CONDITION_PROFILES, DEMO_PM_RECORDS, DEMO_WORK_ORDERS } from '../src/demo.ts';
import { DEMO_KPI_DEFINITIONS } from '../src/kpi/demo-definitions.ts';
import type { SqlClient, SqlDatabase, SqlRow } from '../src/persistence/sql.ts';

const CONTRACT = 'C-17';

function approvedDocument(over: Record<string, unknown> = {}) {
  return {
    schema: CONTRACT_REPOSITORY_SCHEMA,
    sets: [{
      contractId: CONTRACT,
      definitionVersion: 'c17-v2',
      approvalStatus: 'approved',
      plannedServiceMinutesPerDay: 1440,
      assetIds: DEMO_ASSETS.map((a) => a.assetId),
      definitions: DEMO_KPI_DEFINITIONS.map((d) => ({ ...d, formulaVersion: 'c17-v2', authority: { contractId: CONTRACT, clauseRef: `Schedule 4 §${d.id}` }, owner: 'contract.manager', reviewer: 'reliability.lead', approvalStatus: 'approved', approvedAt: '2025-12-15T00:00:00Z', approvedBy: 'steering.committee' })),
      source: { uri: 'repo://contracts/C-17/kpi-sets/v2.json', observedAt: '2026-07-01T00:00:00Z' },
      ...over,
    }],
  };
}

/** Minimal SQL fake: production composition applies the schema and probes the connection; nothing else is exercised here. */
class SchemaOnlyDatabase implements SqlDatabase {
  readonly statements: string[] = [];
  async query(text: string): Promise<{ rows: SqlRow[] }> { this.statements.push(text.trim().slice(0, 30)); return { rows: [] }; }
  async transaction<T>(fn: (tx: SqlClient) => Promise<T>): Promise<T> { return fn(this); }
  async close(): Promise<void> {}
}

const users = JSON.stringify([{ principalId: 'a.zaian', displayName: 'A Zaian', role: 'administrator', scopes: [{ type: 'system' }], tokenSha256: 'a'.repeat(64) }]);
const productionEnv = { RAILMIND_MODE: 'production', RAILMIND_USERS: users, DATABASE_URL: 'postgres://x', MAXIMO_BASE_URL: 'https://maximo.example.test/maximo', CONDITION_BASE_URL: 'https://cm.example.test/api', CONTRACT_REPOSITORY_PATH: '/etc/railmind/contracts.json', RAILMIND_CONTRACT_ID: CONTRACT, RAILMIND_PERIOD_START: '2026-08-01T00:00:00Z', RAILMIND_PERIOD_END: '2026-08-31T23:59:59Z' };

test('contract repository document parses into port-ready approved sets with evidence and a period service rule', () => {
  const sets = parseContractRepositoryDocument(approvedDocument());
  assert.equal(sets.length, 1);
  const set = sets[0]!;
  assert.equal(set.approvalStatus, 'approved');
  assert.equal(set.definitions.length, DEMO_KPI_DEFINITIONS.length);
  assert.equal(set.plannedServiceMinutesPerPeriod('2026-08-01T00:00:00Z', '2026-09-01T00:00:00Z'), 31 * 1440);
  assert.deepEqual(set.evidence, { sourceSystem: 'contract_repository', entityType: 'kpi-definition-set', entityId: 'C-17/c17-v2', observedAt: '2026-07-01T00:00:00Z', sourceUri: 'repo://contracts/C-17/kpi-sets/v2.json', snapshotHash: undefined });
});

test('contract repository document rejects the wrong schema, demo formulas in approved sets, mismatched authority and duplicates', () => {
  assert.throws(() => parseContractRepositoryDocument({ schema: 'other', sets: [] }), ContractRepositoryDocumentError);
  assert.throws(() => parseContractRepositoryDocument(approvedDocument({ definitions: DEMO_KPI_DEFINITIONS })), /demo formula version cannot be approved|authority.contractId/);
  const draftInside = approvedDocument();
  (draftInside.sets[0]!.definitions[0] as { approvalStatus: string }).approvalStatus = 'draft';
  assert.throws(() => parseContractRepositoryDocument(draftInside), /approved set may contain approved definitions only/);
  const mismatched = approvedDocument();
  (mismatched.sets[0]!.definitions[1] as { authority: { contractId: string } }).authority.contractId = 'C-99';
  assert.throws(() => parseContractRepositoryDocument(mismatched), /authority.contractId must equal/);
  const duplicated = { ...approvedDocument(), sets: [approvedDocument().sets[0], approvedDocument().sets[0]] };
  assert.throws(() => parseContractRepositoryDocument(duplicated), /Duplicate set/);
  assert.throws(() => parseContractRepositoryDocument(approvedDocument({ plannedServiceMinutesPerDay: 0 })), /plannedServiceMinutesPerDay/);
  assert.throws(() => parseContractRepositoryDocument(approvedDocument({ source: { observedAt: 'never' } })), /source.observedAt/);
});

test('condition-monitoring REST client uses GET only, maps profiles, returns null on 404 and surfaces other errors', async () => {
  const calls: { url: string; method: string }[] = [];
  const fetchImpl: typeof fetch = async (input, init) => {
    const url = String(input);
    calls.push({ url, method: init?.method ?? 'GET' });
    if (url.endsWith('/assets')) return new Response(JSON.stringify({ assets: [{ assetId: 'A-1' }, { asset_id: 'A-2' }, 'A-3'] }), { status: 200 });
    if (url.endsWith('/assets/A-1/profile')) return new Response(JSON.stringify({ asset_id: 'A-1', health_index: 63.5, health_index_90d_ago: 71, service_critical: 'yes', line: 'Red Line', observed_at: '2026-08-31T00:00:00Z', profile_id: 'CM-A-1', signals: [{ parameter: 'Temperature', change_pct: 12, weight: 0.8 }, { parameter: 'Noise', change_pct: 3 }, { parameter: 'missing' }] }), { status: 200 });
    if (url.endsWith('/assets/A-2/profile')) return new Response('missing', { status: 404 });
    return new Response('boom', { status: 500 });
  };
  const client = new ConditionMonitoringRestClient({ baseUrl: 'https://cm.example.test/api/', apiKey: 'k', fetchImpl });
  assert.deepEqual(await client.listAssetIds(), ['A-1', 'A-2', 'A-3']);
  const profile = await client.getProfile('A-1');
  assert.equal(profile?.healthIndex, 63.5);
  assert.equal(profile?.healthIndex90dAgo, 71);
  assert.equal(profile?.serviceCritical, true);
  assert.equal(profile?.section, 'Red Line');
  assert.deepEqual(profile?.signals, [{ name: 'Temperature', changePct: 12, weight: 0.8 }, { name: 'Noise', changePct: 3, weight: 0.5 }]);
  assert.equal(profile?.evidence.entityId, 'CM-A-1');
  assert.equal(await client.getProfile('A-2'), null);
  await assert.rejects(() => client.getProfile('A-3'), /HTTP 500/);
  assert.ok(calls.every((c) => c.method === 'GET'));
  assert.equal(calls[0]?.url, 'https://cm.example.test/api/assets');
  assert.equal((await client.listProfiles(['A-1', 'A-2'])).length, 1);
});

test('production mode names every missing adapter and refuses to start until all exist', async () => {
  await assert.rejects(() => composeApplication(loadConfig({ RAILMIND_MODE: 'production' })), (error: unknown) => {
    const message = (error as Error).message;
    for (const item of ['RAILMIND_USERS', 'DATABASE_URL', 'MAXIMO_BASE_URL', 'CONTRACT_REPOSITORY_PATH', 'CONDITION_BASE_URL', 'RAILMIND_CONTRACT_ID']) assert.match(message, new RegExp(item));
    return /Synthetic fallback is refused in production/.test(message);
  });
  const partial = { ...productionEnv }; delete (partial as Record<string, string | undefined>).CONDITION_BASE_URL;
  await assert.rejects(() => composeApplication(loadConfig(partial), { database: new SchemaOnlyDatabase(), contractDocument: approvedDocument() }), /cannot start: CONDITION_BASE_URL \(condition-monitoring read adapter\)\. Synthetic/);
  await assert.rejects(() => composeApplication(loadConfig(productionEnv), { database: new SchemaOnlyDatabase(), contractDocument: approvedDocument({ approvalStatus: 'draft' }) }), /C-17\/c17-v2 \(draft\) are not approved/);
  await assert.rejects(() => composeApplication(loadConfig(productionEnv), { database: new SchemaOnlyDatabase(), contractDocument: { schema: 'x' } }), ContractRepositoryDocumentError);
  const { DEMO_CONTRACT_TWIN } = await import('../src/demo.ts');
  const { evidence: _evidence, ...twinBody } = DEMO_CONTRACT_TWIN;
  const draftTwin = { ...twinBody, contractId: CONTRACT, approvalStatus: 'draft', source: { observedAt: '2026-07-01T00:00:00Z' } };
  await assert.rejects(() => composeApplication(loadConfig(productionEnv), { database: new SchemaOnlyDatabase(), contractDocument: { ...approvedDocument(), twins: [draftTwin] } }), /contract twins C-17\/demo-twin-v1 \(draft\) are not approved/);
  assert.throws(() => loadConfig({ RAILMIND_CONTRACT_ID: 'C-17' }), /must be set together/);
});

test('production mode composes live adapters only, serves the configured scope and computes through the governed pipeline', async () => {
  const database = new SchemaOnlyDatabase();
  const maximo = new MockMaximoReadPort({ assets: DEMO_ASSETS, workOrders: DEMO_WORK_ORDERS, preventiveMaintenance: DEMO_PM_RECORDS });
  const conditionPort = new InMemoryConditionReadPort(DEMO_CONDITION_PROFILES);
  const condition = Object.assign(conditionPort, { listProfiles: async (ids: readonly string[]) => (await Promise.all(ids.map((id) => conditionPort.getProfile(id)))).flatMap((p) => (p ? [p] : [])) });
  const app = await composeApplication(loadConfig(productionEnv), { database, maximo, condition, contractDocument: approvedDocument(), now: () => '2026-09-01T00:00:00Z' });
  try {
    assert.equal(app.providers.mode, 'production');
    assert.deepEqual([app.providers.maintenance.id, app.providers.contract.id, app.providers.condition.id, app.providers.finance.id], ['maximo-rest', 'contract-repository', 'condition-monitoring', 'maximo-rest']);
    assert.equal(app.api.persistence, 'postgres');
    assert.equal(app.api.tokenDirectory.mode, 'token');
    assert.equal(app.api.mode, 'production');
    assert.equal(app.api.scope?.contractId, CONTRACT);
    assert.equal(app.api.seedReport.reportId, 'C-17-MONTHLY-2026-08');
    assert.equal(app.api.seedReport.kpis.length, DEMO_KPI_DEFINITIONS.length, 'seed package is built through the pipeline, not copied from the demo');
    assert.ok(database.statements.some((s) => s.startsWith('CREATE TABLE')));
    const dto = await app.controlTower.build(app.api.scope!);
    assert.equal(dto.provenance.synthetic, false);
    assert.equal(dto.provenance.formulaVersion, 'c17-v2');
    assert.equal(dto.readiness.state, 'PROVISIONAL', 'approved definitions with an open failure order are provisional, not blocked');
    assert.ok(!dto.readiness.issues.some((i) => i.code === 'demo_kpi_definition'));
    assert.equal(dto.kpis.find((k) => k.id === 'mttr')?.value, 2.75);
    assert.ok(dto.kpis.every((k) => k.evidence.every((e) => e.sourceSystem === 'maximo' || e.sourceSystem === 'contract_repository')));
    const profiles = await app.providers.condition.listProfiles(['ATC-ZC-02']);
    assert.equal(profiles[0]?.provenance.sourceSystem, 'condition_monitoring');
    assert.match(profiles[0]?.provenance.snapshotHash ?? '', /^[0-9a-f]{64}$/);
  } finally {
    await app.close();
  }
});

test('document contract port serves sets by contract id and nothing for unknown contracts', async () => {
  const port = createDocumentContractReadPort(approvedDocument());
  assert.equal((await port.getKpiSet(CONTRACT))?.definitionVersion, 'c17-v2');
  assert.equal(await port.getKpiSet('OTHER'), null);
});
