# Project 44 — RailMind Agent OS

Canonical implementation repository for an open-source, evidence-first rail asset and contract intelligence platform.

> Replace document-driven periodic reporting with a governed, continuously updated decision environment while keeping Maximo, finance and approved contract repositories authoritative.

## What Project 44 owns

Project 44 is the **Agent Operating System and decision layer**. It connects asset, maintenance, finance and approved contractual context; calculates deterministic KPIs; detects exceptions; coordinates bounded agents; drafts grounded reports; and enforces human approval.

The existing `RailMind` repository is treated as the asset-intelligence reference/legacy prototype until its reusable components are migrated.

## Non-negotiable rules

1. Maximo and finance remain systems of record.
2. Contractual KPIs are deterministic, versioned and testable. LLMs do not calculate contractual KPI truth.
3. Every decision-grade output carries source provenance.
4. High-impact contractual, financial and safety-adjacent outputs require named human review.
5. No autonomous safety-critical rail control.
6. P0 enterprise integrations are read-only.
7. Model and agent-framework independence through internal ports.
8. Open-source-first, zero-cost-capable local development.

## P0 implemented

- canonical decision data model
- configurable Maximo REST read adapter and mock port
- deterministic Availability / Failure / MTBF / MTTR / Backlog demo engine
- versioned KPI observations with evidence
- exception-based management engine
- monthly / quarterly / annual report package model
- deterministic executive summary
- optional OpenAI-compatible local model gateway
- grounded report-narrative service
- governed multi-agent kernel and memory abstraction
- Control Tower view model
- Arabic-first bilingual Control Tower preview with English toggle, responsive navigation, evidence drawers and human-review safeguards
- deterministic schedule-adjusted expenditure-pace distribution model with P25 / P50 / P75 portfolio planning scenarios
- report approval state machine (draft, under review, approved, locked) with evidence gates and named accountability
- hash-chained, append-only audit log for report transitions, approvals and agent runs
- release-readiness policy: no high-impact output is release-ready without decision-grade evidence and a named approved review
- engine-generated browser data pack: every number in the preview is produced by the deterministic engine and verified against it
- Agent OS runtime (orchestrator): deterministic routing, risk escalation to the capability minimum, plan-scoped read-only tools, model access by data-classification policy, evidence verification, approval gate, hash-chained audit and structured decision memory (ADR-003)
- executable capability handlers: data quality, maintenance KPI, exception analysis, monthly/quarterly/annual reporting (deterministic narrative, model narrative when policy allows) and executive briefing that consumes governed decision memory
- contract context port serving approved KPI definition sets (demo set in P0)
- hardened HTTP runtime: explicit public allowlist, traversal and null-byte rejection, GET and HEAD only for static files, CSP and security headers, live security tests
- data providers with provenance on every record; synthetic demo provider; fail-closed production providers; synthetic and production data can never mix
- deterministic readiness gate (READY, PROVISIONAL, BLOCKED per KPI); BLOCKED KPIs are never decision-grade
- Control Tower DTO built by an application service through providers, gate, KPI engine and exception engine; the browser renders it and calculates nothing
- bearer-token authentication with hashed tokens, seven roles with capability-group permissions and scopes (system, line, asset group, contract, portfolio, business area) enforced on the server; the audit actor is always the authenticated principal; demo identities only when no users are configured
- evidence-bound approval state machine (draft, under review, approved, rejected, superseded, locked) with automatic invalidation when evidence changes
- append-only decision ledger (recommendation, decision, review, approval, rejection, supersession, outcome, corrective action, report release) with lineage and trace to source records, persisted in PostgreSQL
- KPI authority registry: governed, versioned definitions with validity windows, owners, reviewers, inclusion and exclusion rules, evidence rules and approval status; production admits approved definitions only
- governed forecasting (`pace-quantile-v2`): completed initiatives excluded from calibration, confidence labels by sample size, funding gaps exposed as exceptions instead of capping to budget, backtesting, drift monitoring and recalibration metadata
- portfolio API over a seeded synthetic provider with data classification; public builds refuse anything but PUBLIC_SYNTHETIC; the workspace renders the API or a pack generated by the same service
- asset intelligence migrated from the legacy RailMind product: health index, failure-risk score with named drivers, recommendation, engineer-review gate and Maximo work-order proposals that RailMind never submits itself
- condition-monitoring port (in-memory demo profiles) feeding the asset-intelligence agent alongside Maximo
- local decision API: governed agent runs, report transitions, audited agent planning, audit trail and chain verification over HTTP; the browser approval gate, asset intelligence and agent workspace are interactive
- PostgreSQL adapters for the audit log, memory store and report state behind the same interfaces, with a database-level append-only guard on audit rows
- local verification, packaged build smoke test, static preview smoke test and an active GitHub Actions workflow (`.github/workflows/ci.yml`)
- contract-context and finance-context handlers: the approved definition set and the contract digital twin copied without change; invoices read through the finance port with dispute and contradiction flags and no financial action
- PM compliance KPI (`pm_compliance`, demo threshold) through the readiness gate, the engine, the Control Tower and the generated pack
- production adapters for the contract repository (JSON export, approved sets and twins only) and condition monitoring (read-only REST); production names every missing input and refuses to start
- persisted governed run records (`railmind_runs`, immutable by trigger), bounded retries for transient source errors (audited), a guarded model gateway with deterministic fallback when the endpoint fails, and caller-declared run sequences linked in the ledger
- multi-report and multi-contract scoping through a report registry: every package is addressed by id and scope-checked against its own contract; the demo serves a monthly and a quarterly package and a second synthetic contract
- GIS as a bounded domain (Phase 11): a synthetic schematic behind a read port, joined with Control Tower facts by fixed status rules; positions are canvas percentages, never coordinates; the preview renders every marker from the generated pack or the API
- contract digital twin (Phase 12): obligations with clause references, bound KPIs, reporting duties with due rules, evidence rules and consequences, read from the repository and evaluated on decision-grade facts only; demo twin is `demo_only`
- review comment sheet and owner/contractor disagreement layer (Phases 13 and 14): both positions with evidence, a named resolution or escalation, audited transitions, ledger lineage, and approval held while a disagreement is open
- private knowledge runtime (Phase 15): classification-gated deterministic retrieval of reference passages, cited by the reporting and contract-context agents for wording only, in memory or PostgreSQL
- report selector in the preview: KPIs, exceptions, assets, timeline, GIS, twin and review sheet follow the selected package from the live API when signed in

> **Important:** KPI formulas and thresholds included in the demo are synthetic examples only. They are not RTA contractual definitions and must be replaced by formally approved rules before production. The portfolio is a seeded synthetic dataset and its forecast is exploratory decision support, not a committed budget, cash forecast or contractual entitlement. GIS and Portfolio Intelligence are bounded optional modules, not a mandate for RailMind to become an uncontrolled super-app.

## Run

```bash
npm run verify
npm run serve
```

Open `http://localhost:4173`.

The browser preview remains **illustrative only**. It is built from synthetic data and never sends an external write, creates a work order or changes a source system.

### How the preview gets its numbers

The preview has no bundler and no runtime dependency, so it cannot execute the TypeScript engine directly. Instead `src/web/demo-pack.ts` projects the engine's outputs (KPI observations, exceptions, report status, approval gate, asset roll-ups and a period-to-date replay timeline) into `web/data/demo-pack.js`.

```bash
npm run build:web-data   # regenerate web/data/demo-pack.js from the engine
npm run check:web-data   # fails when the committed file drifts from the engine (part of verify)
```

The browser layer owns bilingual labels and layout only. If a number on screen is wrong, fix the engine or the synthetic data in `src/demo.ts`, regenerate, and commit the result.

### Local decision API

`server.mjs` hosts the static preview and a small JSON API implemented in `src/api/router.ts`. It mutates RailMind-owned state only (report status, audit trail, agent memory) and never writes to Maximo, finance or contract systems.

| Method | Route | Purpose |
|---|---|---|
| GET | `/api/health` | service status and active persistence mode |
| GET | `/api/reports` | registered packages within the principal's scope, with status and readiness |
| GET | `/api/report` | a report package (`?reportId=`, default package when omitted), readiness (next transitions, blockers including open disagreements, approval validity), evidence version, audit trail and ledger entries; supersedes a stale approval automatically |
| GET | `/api/control-tower` | Control Tower DTO (KPIs with readiness, exceptions, assets, evidence, freshness, report status, replay timeline); `?asOf=` replays period-to-date through the pipeline |
| POST | `/api/report/transition` | `{ type, note?, at? }` with `type` one of `submit_for_review`, `approve`, `reject`, `lock`, `supersede`, `revise`; actor comes from the token; refused transitions return 409 with blockers and are audited |
| GET | `/api/portfolio` | synthetic portfolio DTO: cells, forecast metadata with confidence, totals, funding-gap exceptions (`?asOf=&horizon=`) |
| GET | `/api/ledger` | decision ledger records (`?subjectType=&subjectId=` to filter) |
| GET | `/api/ledger/{id}/trace` | lineage, successors, supersededBy and source evidence of a ledger record |
| POST | `/api/report/reset` | `{ actorId }` restores the demo package; audited |
| POST | `/api/agent/task` | `{ capability, actorId, goal, riskClass, actionMode }` routes through the kernel without executing; audited |
| POST | `/api/agent/run` | same body plus optional `context` scope; executes the capability through the orchestrator and returns the run record with grounded output, tool calls, model use, approval requirement and audit sequences |
| GET | `/api/runs` | run records of this process |
| GET | `/api/audit` | all audit events with hash-chain verification |
| GET | `/api/agents` | the registered agent catalog |
| POST | `/api/agent/sequence` | `{ tasks: [...] }` (1 to 8) executes a caller-declared chain of governed runs; every task is permission-checked first; runs are linked in the ledger; stops at the first run that does not complete |
| GET | `/api/gis` | GIS view for a package (`?reportId=&lineId=`): schematic nodes with a status and evidence joined from Control Tower facts; 503 without a schematic adapter |
| GET | `/api/contract-twin` | the contract digital twin evaluated against the package (`?reportId=`); 404 when the repository publishes none |
| GET | `/api/review` | comment sheet, disagreements and the approval blockers they raise (`?reportId=`) |
| POST | `/api/review/comment`, `/api/review/comment/transition` | add a comment as the principal's party; respond or close |
| POST | `/api/review/disagreement`, `/api/review/disagreement/transition` | raise a disagreement with position and evidence; record the other position; resolve with a named outcome or escalate (`review.resolve`) |
| GET | `/api/knowledge` | documents (no query) or deterministic passage retrieval (`?query=&contractId=&limit=`) within the deployment classification |

### Authentication and roles

Every route except `/api/health` and `/api/auth/demo-identities` requires `Authorization: Bearer <token>`. Tokens are resolved by a directory that stores SHA-256 hashes only. The audit trail records the authenticated principal id and role; actor fields in request bodies are ignored.

| Role | Permissions |
|---|---|
| viewer | read report, control tower, audit, ledger, runs, agents, GIS, twin, review sheet, knowledge |
| maintenance_engineer | read, plan, run maintenance and asset capabilities, submit and revise a report, comment and record positions |
| reliability_engineer | read, plan, run asset and maintenance capabilities, comment and record positions |
| contract_manager | read, plan, run contract and maintenance capabilities, submit and revise a report, comment and record positions |
| finance_reviewer | read, plan, run finance capabilities, comment and record positions |
| approver | read, approve, reject, supersede and lock a report, comment, resolve and escalate disagreements |
| administrator | everything, plus reset of a package |

Principals may carry a `party` (`owner` or `contractor`) that names the side they speak for on the review sheet; a principal without one (administrators) declares it per action. Demo identities: the maintenance engineers are contractor-side; reliability, contract, finance and approver identities are owner-side.

Every principal carries scopes (`system`, `line`, `asset_group`, `contract`, `portfolio`, `business_area`). Report, control tower, transition, plan and run routes check both the permission and the scope of the target contract; denials are audited.

Without `RAILMIND_USERS` the server runs in **demo mode** with public demo tokens (`demo-viewer`, `demo-engineer`, `demo-reliability`, `demo-contract`, `demo-finance`, `demo-approver`, `demo-admin`, and `demo-other-contract` for cross-scope tests). Setting `RAILMIND_USERS` (JSON array of `principalId`, `displayName`, `role`, `scopes`, `tokenSha256`) disables demo tokens; generate a hash with `node --experimental-strip-types scripts/hash-token.mjs <token>`. Enterprise SSO (OIDC or Keycloak) can replace the directory behind the same `TokenDirectory` interface. The OpenAPI description is in `docs/openapi.yaml`.

### Data modes and readiness

`RAILMIND_MODE=demo` (default) serves synthetic records with provenance through the same pipeline production will use, for two synthetic contracts and two report cadences. `RAILMIND_MODE=production` requires live adapters for Maximo, the contract repository (JSON export with approved definition sets and, optionally, approved twins) and condition monitoring, plus the reporting scope, and refuses to start otherwise; there is no fallback to synthetic data. Production has no GIS schematic adapter yet, so `/api/gis` answers 503, and its knowledge corpus is whatever has been loaded into `railmind_knowledge_documents`. Every KPI carries a readiness state from the deterministic gate: READY, PROVISIONAL (usable with visible caveats) or BLOCKED (never decision-grade, excluded from contractual exceptions and narrative facts). Demo KPI definitions are `demo_only` and can never be admitted in production.

### Configuration

All configuration is read from environment variables by `src/config.ts` (see `.env.example`). Without any variable the server runs the synthetic in-memory demo. `DATABASE_URL` enables PostgreSQL. `LLM_BASE_URL` and `LLM_MODEL` enable an OpenAI-compatible model gateway; `DATA_CLASSIFICATION` and the `LLM_REMOTE_APPROVED_*` flags control whether a model may be used for the data at hand. `MAXIMO_BASE_URL` switches the Maximo port from the mock to the read-only REST client.

### Containers

`Dockerfile` runs the server with Node 22 and no build step. `infra/docker-compose.yml` starts PostgreSQL and the app together:

```bash
docker compose -f infra/docker-compose.yml up --build
```

### Persistence

Without `DATABASE_URL` all state is in memory and resets on restart. With `DATABASE_URL` set, the server uses the PostgreSQL adapters in `src/persistence/postgres.ts` (audit log, memory, report state, decision ledger, run records, review comments and disagreements, knowledge documents) through the optional `pg` driver and creates the schema from `infra/sql/001_railmind_core.sql` on start. Audit and ledger rows are protected by database triggers that reject `UPDATE` and `DELETE`; report state, memory, approvals and ledger entries survive restarts.

```bash
docker compose -f infra/docker-compose.yml up -d
DATABASE_URL=postgres://railmind:local_only_change_me@localhost:5432/railmind npm run serve
DATABASE_URL=... npm test   # also runs the live PostgreSQL integration test
```

## Replit

The repository includes `.replit` and `replit.nix` configuration files for a Node.js 22 Replit environment. Import `ahmadzayan-hub/44` from GitHub, then select **Run**. Replit installs dependencies with `npm ci` and starts the application using `PORT=5000 npm run serve`, which aligns with Replit's web preview port. The deployment configuration runs `npm ci && npm run verify` before starting the server with `PORT=5000 npm start`.

## Architecture

```text
Maximo / Finance / Contracts / Condition feeds
                  │
          Evidence & Provenance
                  │
       Deterministic KPI Engine
                  │
     Exception & Decision Layer
                  │
        RailMind Agent OS Kernel
       ┌──────────┼───────────┐
 Asset Agent   Reporting   Contract/Finance Agents
       └──────────┼───────────┘
                  │
          Human Approval Gates
                  │
 Control Tower / Exception Centre / Reports
```

## Documentation

- `docs/PRODUCT_AUTHORITY.md`
- `docs/ARCHITECTURE_AGENT_OS.md`
- `docs/DATA_REQUIREMENTS.md`
- `docs/P0_IMPLEMENTATION_STATUS.md`
- `docs/P0_PILOT_PLAN.md`
- `docs/OPEN_SOURCE_STACK.md`
- `docs/DEPLOYMENT.md`
- `docs/MIGRATION_FROM_RAILMIND.md`
- `docs/ADR-002_PLATFORM_SCOPE.md`
- `docs/ADR-003_AGENT_RUNTIME.md`
- `docs/RECONCILIATION_2026-09-09.md`
- `docs/IMPLEMENTATION_PLAN_P0.md`
- `docs/BRANCH_GOVERNANCE.md`
- `docs/openapi.yaml`
- `docs/UX_REVIEW_2026-09-09.md`
- `docs/CI_WORKFLOW_TEMPLATE.yml`
