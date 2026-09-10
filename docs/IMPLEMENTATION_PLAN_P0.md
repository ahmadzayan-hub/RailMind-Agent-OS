# Implementation plan: P0 hardening (Phases 0 to 8)

Date: 2026-09-09. Scope agreed: execute Phases 0 to 8 of the transformation brief, then pause for independent review before the contract digital twin and RMD modules (Phases 12 to 15).

## Audit of the current state against the brief

| Phase | Requirement | State after reconciliation | Gap |
|---|---|---|---|
| 0 | One canonical repository | Reconciled on this branch; see `RECONCILIATION_2026-09-09.md` | Merge to `main` via PR; branch protection |
| 1 | Secure HTTP runtime | Static server serves the repository root; only traversal stripped | Public allowlist, method restriction, CSP and headers, security tests |
| 2 | API-driven UI | KPIs, exceptions, assets come from a generated pack; report status, audit, agent runs and asset health come from the API; telemetry replay is precomputed in the pack | Control Tower DTO from an application service; replay through the backend pipeline |
| 3 | Provider architecture | Ports exist (Maximo, contract, condition) with mocks; no unified provider contract, no provenance on every fact, no fail-closed guard | Provider interfaces, `SyntheticDemoProvider`, production providers fail closed, `SourceFact` provenance |
| 4 | Readiness gate | Data-quality agent produces findings; nothing blocks a KPI | Deterministic readiness service with READY / PROVISIONAL / BLOCKED per KPI, wired into KPI observations and narrative |
| 5 | Authentication and RBAC | Hashed bearer tokens, five roles, permission checks, denials audited | Rename roles to the requested set, add scopes, enforce scope on report and agent scope |
| 6 | Approval state machine | draft, under_review, approved, locked; evidence gate; named approval; note for critical exceptions | Add rejected and superseded states, record evidence version and formula version, invalidate approval on material evidence change |
| 7 | Persistent decision ledger | Audit log, memory and report state persist in PostgreSQL; runs and decisions in memory | Ledger tables: decision, recommendation, evidence snapshot, review, outcome, superseded_by; traceability query |
| 8 | KPI authority registry | `KpiDefinition` has id, name, unit, formula version, threshold, direction, clause ref | Full governed definition with validity, owner, reviewer, inclusion and exclusion rules, evidence rules, approval status; production rejects unapproved |
| 9 | Forecast governance | Calibration includes completed initiatives (defect); P25/P50/P75 not described as confidence intervals | Deferred by agreement; defect recorded |
| 16 | CI and branch governance | Workflow active on push and PR | Branch protection documented; PR-only to `main` |
| 17 | Documentation | Largely aligned; licence file to be checked | Update after each phase |

## Execution order and deliverables

1. **Phase 1: secure HTTP runtime.** `src/http/static.ts` with an explicit public allowlist (`/`, `/index.html`, `/web/**` excluding nothing else), path normalisation rejecting encoded traversal, absolute paths, null bytes; GET and HEAD only for static; 405 for other methods; headers: CSP compatible with the inline module and Google Fonts, `X-Content-Type-Options`, `Referrer-Policy`, `X-Frame-Options`, `Permissions-Policy`. Tests: `/package.json`, `/.env`, `/src/demo.ts`, `/docs/…`, `/.git/HEAD`, `/%2e%2e/`, `/..%2f`, `//etc/passwd`, `/web/../package.json`, `/index.html%00.js` all 404 or 403; PUT to static 405.
2. **Phase 2: API-driven Control Tower.** `src/app/control-tower-service.ts` builds a typed DTO (KPIs with readiness, exceptions, assets, evidence metadata, report status, decision requirements, data freshness) from providers through the readiness gate, KPI engine and exception engine. `GET /api/control-tower` and `GET /api/control-tower/replay?asOf=` (synthetic period-to-date events through the same pipeline). The browser renders the DTO; the generated pack becomes the static-hosting fallback and is labelled as such.
3. **Phase 3: provider architecture.** `src/providers/` with `DataProvider` contracts, `SyntheticDemoProvider`, and production providers that throw on unavailability and never fall back. Every fact carries `SourceFact` provenance with `ingestedAt` and `qualityState`.
4. **Phase 4: readiness gate.** `src/readiness/` deterministic service returning READY / PROVISIONAL / BLOCKED with reasons; KPI observations carry readiness; BLOCKED KPIs are excluded from decision-grade output and from narrative facts; the narrative prompt receives the readiness list.
5. **Phase 5: RBAC extension.** Roles `viewer`, `maintenance_engineer`, `reliability_engineer`, `contract_manager`, `finance_reviewer`, `approver`, `administrator`; scopes `system`, `line`, `asset_group`, `contract`, `portfolio`, `business_area`; principal carries scopes; report and agent routes check scope; cross-scope tests.
6. **Phase 6: approval state machine.** States `draft`, `under_review`, `approved`, `rejected`, `superseded`, `locked`; approval record with evidence version (hash of evidence set) and KPI formula versions; `supersede` when evidence changes; tests for invalidation.
7. **Phase 7: decision ledger.** PostgreSQL tables and in-memory twin for decisions, recommendations, evidence snapshots, reviews, outcomes with `superseded_by`; runtime writes decisions to the ledger; `GET /api/ledger/decisions/:id/trace` reconstructs decision to source record.
8. **Phase 8: KPI authority registry.** `GovernedKpiDefinition` with all required fields; registry with validity windows and approval status; `RAILMIND_MODE=production` rejects unapproved definitions; demo definitions marked `approvalStatus: 'demo_only'`.

After each phase: typecheck, targeted tests, full `npm run verify`. At the end: complete verification, browser run, documentation update, version bump, PR to `main`.

## Status (end of 2026-09-09)

| Phase | Status | Evidence |
|---|---|---|
| 0 | Done | `RECONCILIATION_2026-09-09.md`; merge commit `662a9f3` |
| 1 | Done | `src/http/*`, `tests/http-security.test.ts` |
| 2 | Done | `src/app/control-tower-service.ts`, `GET /api/control-tower`, pack generated by the service |
| 3 | Done | `src/providers/*`, `tests/providers-readiness.test.ts` |
| 4 | Done | `src/readiness/gate.ts`, `src/kpi/governed.ts` |
| 5 | Done | `src/auth/principal.ts` (seven roles, scopes), route enforcement, cross-scope tests |
| 6 | Done | `src/reporting/approval.ts`, `evidence-version.ts`, automatic supersession in the API |
| 7 | Done | `src/ledger/contracts.ts`, `PgDecisionLedger`, `/api/ledger` |
| 8 | Done | `src/kpi/registry.ts`, governed demo definitions, readiness per definition |
| 9 | Done | `src/forecast/budget-forecast.ts` v2, `tests/budget-forecast.test.ts` (completed-record exclusion regression, confidence, funding gap, backtest, drift) |
| 10 | Done | `src/portfolio/*`, `/api/portfolio`, `web/portfolio.js` + synthetic pack, classification guard, retired fingerprints blocked |
| 11 to 15 | Not started | Paused for independent review, as agreed |
| 16 | Partly | CI active; branch protection documented in `BRANCH_GOVERNANCE.md`, to be configured on GitHub |
| 17 | Done for 0 to 8 | README, SECURITY, DEPLOYMENT, status, OpenAPI, CLAUDE.md updated; full Apache-2.0 licence text |
| 18 | Partly | Security bypass, RBAC denial, cross-scope, missing and stale evidence, duplicates, conflicts, formula version changes, approval invalidation, Maximo 401/403/500, source unavailable, database unavailable (live test skipped without DATABASE_URL) covered; LLM unavailable and forecast tests pending |
