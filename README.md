<p align="center"><img src="docs/assets/banner.svg" alt="RailMind Agent OS: evidence-first, governed decisions for rail maintenance, asset, contract and finance intelligence" width="100%"></p>

# RailMind Agent OS (Project 44)

An evidence-first, governed decision layer for rail maintenance, asset, contract and finance intelligence.

<p align="center"><img src="docs/assets/hero.jpg" alt="Concept illustration. Not a product screenshot and not a real operations room." width="100%"><br><sub><em>Concept illustration. Not a product screenshot and not a real operations room.</em></sub></p>

![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178C6?logo=typescript&logoColor=white)
![Node.js](https://img.shields.io/badge/Node.js-22-339933?logo=node.js&logoColor=white)
![Web](https://img.shields.io/badge/Web-plain%20ES%20modules-F7DF1E?logo=javascript&logoColor=black)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-optional-4169E1?logo=postgresql&logoColor=white)
![Tests](https://img.shields.io/badge/tests-node%3Atest-5FA04E)
![License](https://img.shields.io/badge/license-Apache--2.0-blue)

> Replace document-driven periodic reporting with a governed, continuously updated decision environment while keeping Maximo, finance and approved contract repositories authoritative.

> **Stage: P0 synthetic demo.** Nothing here is connected to live operational, Maximo or finance data. Every number in the preview comes from synthetic records. Demo KPI formulas and thresholds are examples, not contractual definitions.

## Overview

RailMind Agent OS answers one question for the asset owner and the maintenance contractor: what is happening across asset, maintenance, contract and financial performance, what needs attention, why, and what decision is required now.

Project 44 is the **Agent Operating System and decision layer**. It connects asset, maintenance, finance and approved contractual context; calculates deterministic KPIs; detects exceptions; coordinates bounded agents; drafts grounded reports; and enforces human approval.

This repository is the canonical platform. The older [`RailMind`](https://github.com/ahmadzayan-hub/RailMind) repository is a legacy asset-intelligence prototype and migration source only (see `docs/MIGRATION_FROM_RAILMIND.md`).

## Non-negotiable rules

1. Maximo and finance remain systems of record.
2. Contractual KPIs are deterministic, versioned and testable. LLMs do not calculate contractual KPI truth.
3. Every decision-grade output carries source provenance.
4. High-impact contractual, financial and safety-adjacent outputs require named human review.
5. No autonomous safety-critical rail control.
6. P0 enterprise integrations are read-only.
7. Model and agent-framework independence through internal ports.
8. Open-source-first, zero-cost-capable local development.

## Key features (P0 implemented)

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
- asset intelligence migrated from the legacy RailMind product: health index, failure-risk score with named drivers, recommendation, engineer-review gate and Maximo work-order proposals that RailMind never submits itself
- condition-monitoring port (in-memory demo profiles) feeding the asset-intelligence agent alongside Maximo
- local decision API: governed agent runs, report transitions, audited agent planning, audit trail and chain verification over HTTP; the browser approval gate, asset intelligence and agent workspace are interactive
- PostgreSQL adapters for the audit log, memory store and report state behind the same interfaces, with a database-level append-only guard on audit rows
- local verification, packaged build smoke test, static preview smoke test and an active GitHub Actions workflow (`.github/workflows/ci.yml`)

> **Important:** KPI formulas and thresholds included in the demo are synthetic examples only. They are not RTA contractual definitions and must be replaced by formally approved rules before production. The portfolio forecast is exploratory decision support, not a committed budget, cash forecast or contractual entitlement.

## Screenshots

Captured from the local server (`npm run serve`) with the synthetic demo data. The interface is Arabic first with an English toggle.

| Desktop (1440 x 900) | Mobile (390 x 844) |
|---|---|
| <img src="docs/assets/screenshots/desktop.png" alt="Control Tower on desktop, Arabic layout" width="100%"> | <img src="docs/assets/screenshots/mobile.png" alt="Control Tower on mobile, Arabic layout" width="260"> |

Exception centre drill-down: every exception row opens its evidence drawer, with keyboard focus kept inside the drawer and returned on close.

<img src="docs/assets/screenshots/desktop-exceptions-drawer.png" alt="Decision pack drawer opened from the exception centre" width="100%">

## Quick start

Requirements: Node.js 22.18 or later (the server runs TypeScript through Node type stripping).

```bash
npm ci
npm run verify   # typecheck, web checks, data drift, portfolio check, tests, build and package smoke
npm run serve    # http://localhost:4173
```

The browser preview is **illustrative only**. It is built from synthetic data and never sends an external write, creates a work order or changes a source system. To try the approval gate and agent runs, sign in from the preview with one of the public demo identities (see Authentication and roles).

## Scripts

| Script | Purpose |
|---|---|
| `npm run verify` | Full gate: typecheck, web syntax, web data drift, portfolio check, tests, build and package smoke |
| `npm test` | `node:test` suites (109 tests; the live PostgreSQL test is skipped unless `DATABASE_URL` is set) |
| `npm run typecheck` | Strict TypeScript check |
| `npm run build` | Emit `dist/` (ESM and declarations) |
| `npm run build:web-data` | Regenerate `web/data/demo-pack.js` from the engine |
| `npm run check:web-data` | Fail when the committed data pack drifts from the engine |
| `npm run check:portfolio` | Fail when restricted identifiers appear in the portfolio workspace |
| `npm run serve` / `npm start` | Start the static preview and local decision API |

## Project structure

```text
src/
  agent-os/          contracts, policy, catalog, kernel, orchestrator, tools, memory
  agents/            capability handlers (data quality, KPI, exceptions, reporting, asset intelligence)
  asset-intelligence/ engine migrated from the legacy RailMind prototype
  kpi/ exceptions/ readiness/ reporting/ forecast/   deterministic decision logic
  providers/ connectors/   provenance-carrying providers; read-only Maximo, contract, condition ports
  api/ auth/ audit/ ledger/ persistence/ http/       API, roles, hash-chained audit, ledger, PostgreSQL, static host rules
  web/demo-pack.ts   projects engine outputs into web/data/demo-pack.js
web/                 bilingual Control Tower (plain ES modules, no bundler, no runtime dependency)
index.html           application shell
server.mjs           static host and API, structured logs, graceful shutdown
infra/               docker-compose (PostgreSQL + pgvector) and SQL schema
tests/               node:test suites
docs/                product authority, architecture, data contract, pilot plan, status, deployment
```

## Using the server

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
| GET | `/api/report` | current report package, readiness (next transitions, blockers, approval validity), evidence version, audit trail and ledger entries; supersedes a stale approval automatically |
| GET | `/api/control-tower` | Control Tower DTO (KPIs with readiness, exceptions, assets, evidence, freshness, report status, replay timeline); `?asOf=` replays period-to-date through the pipeline |
| POST | `/api/report/transition` | `{ type, note?, at? }` with `type` one of `submit_for_review`, `approve`, `reject`, `lock`, `supersede`, `revise`; actor comes from the token; refused transitions return 409 with blockers and are audited |
| GET | `/api/ledger` | decision ledger records (`?subjectType=&subjectId=` to filter) |
| GET | `/api/ledger/{id}/trace` | lineage, successors, supersededBy and source evidence of a ledger record |
| POST | `/api/report/reset` | `{ actorId }` restores the demo package; audited |
| POST | `/api/agent/task` | `{ capability, actorId, goal, riskClass, actionMode }` routes through the kernel without executing; audited |
| POST | `/api/agent/run` | same body plus optional `context` scope; executes the capability through the orchestrator and returns the run record with grounded output, tool calls, model use, approval requirement and audit sequences |
| GET | `/api/runs` | run records of this process |
| GET | `/api/audit` | all audit events with hash-chain verification |
| GET | `/api/agents` | the registered agent catalog |

### Authentication and roles

Every route except `/api/health` and `/api/auth/demo-identities` requires `Authorization: Bearer <token>`. Tokens are resolved by a directory that stores SHA-256 hashes only. The audit trail records the authenticated principal id and role; actor fields in request bodies are ignored.

| Role | Permissions |
|---|---|
| viewer | read report, control tower, audit, ledger, runs, agents |
| maintenance_engineer | read, plan, run maintenance and asset capabilities, submit and revise a report |
| reliability_engineer | read, plan, run asset and maintenance capabilities |
| contract_manager | read, plan, run contract and maintenance capabilities, submit and revise a report |
| finance_reviewer | read, plan, run finance capabilities |
| approver | read, approve, reject, supersede and lock a report |
| administrator | everything, plus reset of the demo package |

Every principal carries scopes (`system`, `line`, `asset_group`, `contract`, `portfolio`, `business_area`). Report, control tower, transition, plan and run routes check both the permission and the scope of the target contract; denials are audited.

Without `RAILMIND_USERS` the server runs in **demo mode** with public demo tokens (`demo-viewer`, `demo-engineer`, `demo-reliability`, `demo-contract`, `demo-finance`, `demo-approver`, `demo-admin`, and `demo-other-contract` for cross-scope tests). Setting `RAILMIND_USERS` (JSON array of `principalId`, `displayName`, `role`, `scopes`, `tokenSha256`) disables demo tokens; generate a hash with `node --experimental-strip-types scripts/hash-token.mjs <token>`. Enterprise SSO (OIDC or Keycloak) can replace the directory behind the same `TokenDirectory` interface. The OpenAPI description is in `docs/openapi.yaml`.

### Data modes and readiness

`RAILMIND_MODE=demo` (default) serves synthetic records with provenance through the same pipeline production will use. `RAILMIND_MODE=production` requires live adapters for Maximo, the contract repository and condition monitoring and refuses to start otherwise; there is no fallback to synthetic data. Every KPI carries a readiness state from the deterministic gate: READY, PROVISIONAL (usable with visible caveats) or BLOCKED (never decision-grade, excluded from contractual exceptions and narrative facts). Demo KPI definitions are `demo_only` and can never be admitted in production.

### Configuration

All configuration is read from environment variables by `src/config.ts` (see `.env.example`). Without any variable the server runs the synthetic in-memory demo. `DATABASE_URL` enables PostgreSQL. `LLM_BASE_URL` and `LLM_MODEL` enable an OpenAI-compatible model gateway; `DATA_CLASSIFICATION` and the `LLM_REMOTE_APPROVED_*` flags control whether a model may be used for the data at hand. `MAXIMO_BASE_URL` switches the Maximo port from the mock to the read-only REST client.

### Containers

`Dockerfile` runs the server with Node 22 and no build step. `infra/docker-compose.yml` starts PostgreSQL and the app together:

```bash
docker compose -f infra/docker-compose.yml up --build
```

### Persistence

Without `DATABASE_URL` all state is in memory and resets on restart. With `DATABASE_URL` set, the server uses the PostgreSQL adapters in `src/persistence/postgres.ts` through the optional `pg` driver and creates the schema from `infra/sql/001_railmind_core.sql` on start. Audit and ledger rows are protected by database triggers that reject `UPDATE` and `DELETE`; report state, memory, approvals and ledger entries survive restarts.

```bash
docker compose -f infra/docker-compose.yml up -d
DATABASE_URL=postgres://railmind:local_only_change_me@localhost:5432/railmind npm run serve
DATABASE_URL=... npm test   # also runs the live PostgreSQL integration test
```

## Architecture

```mermaid
flowchart TD
  S[Maximo / Finance / Contracts / Condition feeds] --> E[Evidence and provenance]
  E --> R[Readiness gate: READY / PROVISIONAL / BLOCKED]
  R --> K[Deterministic KPI engine]
  K --> X[Exception and decision layer]
  X --> O[RailMind Agent OS kernel]
  O --> A1[Asset agent]
  O --> A2[Reporting agents]
  O --> A3[Contract / finance agents]
  A1 --> H[Human approval gates]
  A2 --> H
  A3 --> H
  H --> UI[Control Tower / Exception centre / Reports]
  O -. audit .-> L[(Append-only ledger and hash-chained audit)]
```

The browser never computes a KPI, exception or risk score. It renders the Control Tower DTO from the API, or the static pack generated by the same application service when the API is not available.

## Deploy

### Replit (configured)

The repository includes `.replit` and `replit.nix` for a Node.js 22 Replit environment. Import `ahmadzayan-hub/RailMind-Agent-OS` from GitHub, then select **Run**. Replit installs dependencies with `npm ci` and starts the application with `PORT=5000 npm run serve`, which matches the Replit web preview port. The deployment configuration runs `npm ci && npm run verify` before starting the server with `PORT=5000 npm start`.

### Docker

See Containers above.

### Vercel (unverified)

`vercel.json` declares `server.mjs` as a function with `index.html` and `web/**` included. This path has not been verified end to end: the server imports `src/**` and needs Node 22.18 or later for type stripping (see `docs/RECONCILIATION_2026-09-09.md`). If you try it, use these settings:

| Setting | Value |
|---|---|
| Framework preset | Other |
| Root directory | `./` (repository root) |
| Build command | none (no build step is required to serve) |
| Node.js version | 22.x |
| Environment variables | none required; all variables in `.env.example` are optional and the server falls back to the synthetic in-memory demo |

Do not deploy the repository root as a plain static site. That would expose `src/`, `docs/` and package files, which the server allowlist in `src/http/public-paths.ts` deliberately blocks.

## Status and known limitations

- P0 synthetic demo. Not connected to live operational, Maximo or finance systems, and must not be presented as operational.
- Authentication is a hashed-token directory, not enterprise SSO. `DATA_CLASSIFICATION` is a deployment setting, not per-record classification.
- Production mode cannot start yet: contract-repository and condition-monitoring adapters do not exist (fail closed by design).
- Two catalog capabilities have no handler yet: contract-context and finance-context.
- Asset-intelligence weights and thresholds are legacy demo values and uncalibrated.
- Run records live in process memory (`/api/runs`); only audit events and decision memory are persisted.
- The runtime is single-step: one handler per run, no model planning, no retries, no scheduling.
- KPI values in the preview come from the generated pack; report status, readiness and audit are live from the API.
- GIS positions, station names and routing defaults in `web/app.js` are presentation placeholders, labelled as such in the code.

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
- `docs/REPLIT_DEPLOYMENT.md`

## Arabic summary

<div dir="rtl" lang="ar">

**RailMind Agent OS** هو المستودع المعتمد لطبقة قرار محكومة تقوم على الأدلة، وتخدم ذكاء صيانة السكك الحديدية والأصول والعقود والشؤون المالية.

- يحسب مؤشرات الأداء بمحرك حتمي ذي إصدارات مختبرة، ولا تحسب النماذج اللغوية أي قيمة تعاقدية.
- يرفق كل مخرج قراري بمراجع أدلة توضح نظام المصدر ونوع الكيان ومعرّفه ووقت الرصد.
- تتطلب المخرجات التعاقدية والمالية والمتعلقة بالسلامة اعتمادًا بشريًا باسم صريح.
- تبقى أنظمة Maximo والأنظمة المالية هي المرجع المعتمد، والتكاملات في المرحلة الحالية للقراءة فقط.
- واجهة برج التحكم عربية أولًا مع خيار الإنجليزية.

المرحلة الحالية عرض تجريبي ببيانات اصطناعية فقط، وهو غير متصل بأي نظام تشغيلي حي، ولا يجوز تقديمه على أنه نظام تشغيلي.

</div>

## License and ownership

Licensed under the Apache License 2.0 (see `LICENSE`). Owned and maintained by Ahmed Zaian. Security reporting: see `SECURITY.md`.
