# CLAUDE.md

Working notes for AI-assisted development on this repository. Read this before changing anything.

## What this repository is

Project 44 is the canonical repository for **RailMind Agent OS**: an evidence-first, governed decision layer for rail maintenance, asset, contract and finance intelligence. It is owned by Ahmed Zaian (Chief Engineer, Rail Maintenance Department context, Dubai). The older `ahmadzayan-hub/RailMind` repository is a legacy asset-intelligence prototype and migration source only; this repository is the platform authority.

The product answers one question for the asset owner and maintenance contractor: what is happening across asset, maintenance, contract and financial performance, what needs attention, why, and what decision is required now.

Current stage: **P0 synthetic demo**. Nothing here is connected to live RTA, Maximo or finance data, and nothing here may be presented as operational.

## Non-negotiable rules (enforced in code and tests)

1. Maximo and finance systems stay authoritative. RailMind never becomes a second asset register or ledger.
2. Contractual KPIs are deterministic, versioned and tested in `src/kpi/`. LLMs never calculate KPI truth; they only explain and draft.
3. Every decision-grade output carries evidence references (`EvidenceRef`: source system, entity type, entity id, observed timestamp).
4. Contractual, financial and safety-critical outputs require named human approval (`HumanApproval`).
5. No autonomous safety-critical rail control. `actionMode: 'control'` is always blocked. `execute_write` is always blocked in P0.
6. P0 integrations are read-only. The Maximo client exposes GET only. Do not add POST/PATCH/DELETE paths to `MaximoReadPort`; a future write needs a separate proposal/approval port.
7. Model and agent-framework independence. Domain code talks to `ModelGateway` only. No vendor SDK imports in `src/`.
8. Open-source first, zero-cost local development. Do not add runtime dependencies without a clear reason. The web preview must stay dependency-free and must never fetch external data or write to a source system.
9. Demo KPI formulas and thresholds in `src/kpi/demo-definitions.ts` are synthetic. Never describe them as RTA contractual definitions.
10. Never commit credentials, live operational data, contract documents or identifiable RTA records. `scripts/check-portfolio.mjs` fails the build if restricted identifiers appear in the portfolio workspace.

## Repository map

```
src/
  agent-os/        contracts, policy (execution rules + release readiness), catalog (7 agents with capability minimum risk), kernel (routing + risk escalation), orchestrator (runtime: guarded model, bounded retries, runSequence), run-store, model-guard, tools (registry + plan-scoped invoker with retries), standard-tools (ports -> tool ids incl. knowledge.read), handlers (capability contract), memory
  agents/          executable capability handlers: data-quality, maintenance-kpi + exception-analysis, reporting (monthly/quarterly/annual, cites knowledge passages) + executive-briefing, asset-intelligence (asset-health, failure-risk, maintenance-priority), contract-context (definition set + twin + clause references), finance-context, scope resolution
  asset-intelligence/ migrated legacy RailMind engine: risk (health band, score, drivers, confidence, recommendation), proposal (engineer-review gate), sample network, types
  auth/            principals, seven roles, capability-group permissions, scopes; hashed bearer-token directory (demo identities only without RAILMIND_USERS)
  app/compose.ts   composition root: providers by mode (production refuses synthetic), ports, adapters, runtime, ledger, API dependencies
  app/control-tower-service.ts  application service: providers -> readiness gate -> KPI engine -> exception engine -> DTO (+ period-to-date replay)
  providers/       provider contracts with provenance; synthetic demo provider; fail-closed production providers
  readiness/       deterministic readiness gate (READY / PROVISIONAL / BLOCKED per KPI)
  http/            public path allowlist and security headers for the static host
  ledger/          append-only decision ledger contracts, in-memory adapter, trace
  config.ts        typed environment configuration (.env.example documents every variable)
  api/router.ts    local decision API (report transitions, reset, audited agent planning, audit trail); runtime-neutral, hosted by server.mjs
  audit/           append-only, SHA-256 hash-chained audit log (in-memory adapter)
  persistence/     SQL ports, PostgreSQL adapters (audit, memory, report store, ledger, runs, review, knowledge), lazy `pg` loader
  connectors/maximo/ port (anti-corruption interfaces), client (read-only REST adapter), mock (in-memory port)
  connectors/contract/ contract port (approved KPI definition sets + digital twin); in-memory adapter; repository.ts parses the JSON export (sets and twins, validated)
  connectors/condition/ condition-monitoring port (health index, trend, signals); in-memory demo profiles; client.ts read-only REST adapter
  contract-twin/   twin contract (obligations, reporting duties, evidence rules) + evaluation against Control Tower facts
  review/          comment sheet and disagreement state machine (pure transitions with audit events), review store
  knowledge/       private knowledge documents with classification, deterministic lexical retrieval, in-memory store, demo corpus
  gis/             bounded GIS domain: schematic contracts + read port, demo schematic, service joining nodes with Control Tower facts
  data/canonical.ts  canonical decision projections (asset, work order, invoice, contract, snapshot)
  kpi/             engine, governed path (gate + engine), authority registry (versioned governed definitions), demo definitions (demo_only)
  exceptions/      exception severity from KPI observations (breach + prior breaches -> critical)
  reporting/       contracts, generator, approval (six-state machine, evidence-bound), evidence-version, store, registry (registered packages per contract)
  llm/             OpenAI-compatible gateway (fetch only), grounded report-narrative prompt, model invocation policy (classification x endpoint locality)
  forecast/        pace-quantile-v2: calibration with exclusions, confidence labels, funding gap, backtest, drift monitor
  portfolio/       portfolio domain: classification, seeded synthetic provider, service (cells, forecast, gap exceptions)
  control-tower/   view model counts for the Control Tower
  web/demo-pack.ts projects engine outputs into the browser data pack (generated file: web/data/demo-pack.js); gis-pack.ts and contract-twin-pack.ts generate web/data/gis-pack.js and web/data/contract-twin-pack.js the same way
  demo.ts          synthetic August 2026 work orders, KPI observations, report packages (monthly, quarterly, second contract), demo twin, dataset and registrations
  index.ts         public export surface (all modules)
web/
  app.js           bilingual (Arabic RTL first, English toggle) Control Tower UI; reads every number from web/data/demo-pack.js
  data/demo-pack.js, gis-pack.js, contract-twin-pack.js GENERATED by `npm run build:web-data`; never edit by hand; `check:web-data` blocks drift
  styles.css       single-file design system
  portfolio.html + portfolio.js   portfolio workspace (module), renders /api/portfolio or web/data/portfolio-pack.js (GENERATED, synthetic)
index.html         application shell
server.mjs         host: loads config, composes the application, serves static files + API with structured logs and graceful shutdown
Dockerfile, infra/docker-compose.yml, .env.example, .github/workflows/ci.yml   runtime and CI infrastructure
infra/sql/         schema for RailMind-owned tables (audit rows append-only by trigger)
tests/             node:test suites (158 tests; the live PostgreSQL test is skipped unless DATABASE_URL is set)
scripts/           build-web-data.mjs, check-web-data.mjs, check-portfolio.mjs, package-smoke.mjs
docs/              product authority, architecture, data contract, pilot plan, status, reviews, deployment
infra/             optional PostgreSQL + pgvector compose file
```

## Commands

```bash
npm ci
npm run verify          # typecheck + web syntax + web data drift + portfolio check + tests + build/package smoke
npm test                # node --experimental-strip-types --test tests/*.test.ts
npm run build:web-data  # regenerate web/data/demo-pack.js after changing src/demo.ts or the engine
npm run build           # emit dist/ (ESM + declarations)
npm run serve           # http://localhost:4173  (Replit uses PORT=5000); DATABASE_URL=... enables PostgreSQL
```

Run `npm run verify` before every commit. All tests must pass. If you change `src/demo.ts`, the KPI engine, exceptions, reporting, approval logic, the GIS schematic or the twin evaluation, run `npm run build:web-data` and commit the regenerated packs.

## Coding conventions

- TypeScript strict mode with `noUncheckedIndexedAccess`, `noUnusedLocals`, `noUnusedParameters`.
- Imports inside `src/` and `tests/` use explicit `.ts` extensions (Node strip-types runtime). The build rewrites them to `.js` in `dist/`.
- Tests use `node:test` and `node:assert/strict`. No test framework dependency.
- Keep modules small and pure. Deterministic functions take inputs and return values; no hidden state.
- `src/` must not import Node-only modules or types (`node:*`, `Buffer`). The API uses structural request/response types so the domain layer stays runtime-neutral and typechecks without `@types/node`.
- Web code is plain ES modules, no bundler. Keep Arabic as the default language and preserve RTL layout. Every user-facing string needs both Arabic and English.
- Prose in docs: no em dashes. Short sentences. Facts, assumptions, risks and recommendations kept separate.
- Do not put a model name or AI identifier in commits, code comments or docs.

## Adding an agent capability

1. Register the capability, allowed action modes, allowed tool ids and minimum risk class in `src/agent-os/catalog.ts`.
2. Implement a `CapabilityHandler` in `src/agents/` that reaches data only through `context.tools` and returns evidence for every conclusion.
3. Register it in `createStandardHandlers`. A catalog capability without a handler fails closed at run time and is absent from `/api/health`.
4. Add an orchestrator test that asserts the tool trail, evidence count and release readiness.

## Governance rules added on 2026-09-09 (keep them)

- The browser never computes a KPI, exception or risk score. It renders the Control Tower DTO or the static pack generated by the same service.
- Every provider record carries provenance. Production mode never falls back to synthetic data; a missing adapter stops the server.
- A BLOCKED KPI is never decision-grade: no contractual exception, no narrative fact, no submission.
- Approvals are bound to an evidence version. Changed evidence supersedes the approval automatically.
- Every completed run and every report transition writes to the append-only ledger. Never mutate ledger or audit rows.
- The static host serves only the allowlist in `src/http/public-paths.ts`. Adding a public file means adding it there and covering it in `tests/http-security.test.ts`.
- The public repository carries synthetic portfolio values only. Never reintroduce organisational totals; `scripts/check-portfolio.mjs` blocks the retired fingerprints.

## Governance rules added on 2026-09-20 (keep them)

- Every report route addresses a registered package (`src/reporting/registry.ts`) and is scope-checked against that package's contract. An unregistered report id is refused.
- GIS owns positions and lines only. Node statuses come from the GIS service joining Control Tower facts; positions are canvas percentages and are labelled as never being coordinates. Production has no schematic adapter and `/api/gis` fails closed.
- The contract twin is read from the repository and evaluated, never authored. KPI obligations are judged on decision-grade data only; other obligation kinds are listed as not evaluated. A `demo_only` twin is never contractual and production refuses unapproved twins.
- Review transitions are pure functions returning their audit event. An open disagreement holds approval and locking of its package; the refusal is audited. Raising and resolving write linked ledger records.
- Knowledge retrieval is deterministic and classification-gated at read time; a document above the deployment classification is invisible. Passages are context for wording and are cited as evidence; no number, threshold or date may come from them.
- A model failure never fails a run: handlers fall back to deterministic output and the failure is audited. Transient source errors are retried within a small bound and every retry is audited. Chains are declared by the caller (`runSequence`), never planned by a model.

## Known gaps (as of 2026-09-20, after Phases 0 to 15)

- Authentication is a hashed-token directory, not enterprise SSO. `DATA_CLASSIFICATION` is a deployment setting; per-record classification exists for knowledge documents only.
- Production mode needs owner-environment inputs that do not exist in this repository: an approved contract repository export (definition sets and twins), Maximo object-structure mappings confirmed against a live tenant, a condition-monitoring endpoint, a GIS schematic adapter (none exists; `/api/gis` answers 503) and a loaded knowledge corpus.
- The portfolio and forecast are synthetic; a private portfolio provider does not exist yet and public builds refuse non-synthetic classifications.
- Asset-intelligence weights and thresholds are the legacy demo values, uncalibrated; the condition port serves synthetic profiles in demo mode.
- The runtime executes one handler per run and caller-declared sequences; there is no model planning or scheduling, by design.
- Review comments and disagreements are mutable projections (in memory or PostgreSQL); the audit log and ledger remain the record. There is no notification or deadline tracking for open disagreements.
- Twin evaluation covers KPI obligations and reporting duties only; evidence, response and payment obligations are recorded, not judged.
- Train markers in the GIS view are a presentation simulation and are flagged `simulated`.

## Resolved on 2026-09-20

- Contract-context and finance-context handlers exist and are tested; the catalog has no handler-less capability.
- PM compliance KPI is computed by the engine, gated by readiness (`missing_completion`) and shown in the Control Tower.
- Production composition has adapters for the contract repository and condition monitoring and names every missing input.
- Run records persist (`railmind_runs`, immutable by trigger). Retries, model fallback and `runSequence` are tested, including the model-unavailable case.
- Multiple packages and contracts are served and scoped; the preview follows the selected package from the live API (KPIs, exceptions, assets, timeline, GIS, twin, review sheet).
- GIS positions, station names and marker statuses no longer live in `web/app.js` or `index.html`; they come from `web/data/gis-pack.js` or `/api/gis`.
- Phases 11 to 15 are implemented on synthetic data as described above.

## Resolved on 2026-09-09

- Build emits `dist/` (`rewriteRelativeImportExtensions`), and `scripts/package-smoke.mjs` runs in `verify`.
- `hasApprovedHumanReview` and `isOutputReleaseReady` exist with tests.
- Orphaned `vitest.config.ts` removed.
- `src/index.ts` exports every module.
- `web/app.js` no longer hard-codes any number. The previous UI showed MTBF 183.5 h while the engine computes 183.25 h, and showed three exceptions while the engine produces two. Both drifts are gone.
- Telemetry no longer perturbs KPI values with synthetic noise. It replays the period event by event with the engine recomputing each KPI.
- Approval gate is interactive through the local API with a named actor; every transition, refusal, reset and agent plan is audited and the chain is verified on read.
- PostgreSQL adapters exist for audit, memory and report state, verified live against PostgreSQL 16 including the append-only trigger.
- API requires bearer tokens; the audit actor is the authenticated principal; role checks on every mutating route with denials audited.
- Legacy RailMind asset health and failure risk migrated with their fidelity tests and exposed as three governed capabilities.

## Intended direction (see docs/P0_PILOT_PLAN.md)

Phase 0: approved KPI definitions and Maximo field mapping. Phase 1: deterministic data and KPI layer with provenance and data-quality checks. Phase 2: Control Tower and exception centre with drill-down to evidence. Phase 3: local model gateway, grounded reporting and executive briefing agents, human approval workflow. Phase 4: parallel reporting cycle and value case.

When extending the platform, add capability behind existing ports and contracts, keep every number reproducible from source fields, and keep every high-impact output behind a named approval.
