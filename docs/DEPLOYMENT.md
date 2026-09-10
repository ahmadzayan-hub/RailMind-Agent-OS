# Zero-cost-capable deployment

## Local preview

```bash
npm run serve
```

Then open `http://localhost:4173`. Health check: `http://localhost:4173/api/health`.

The browser preview has no external runtime dependency and uses synthetic data.

## Static hosting

`index.html` and `web/` can be served from any static host. GitHub Pages or similar free tiers can host the P0 demo. Do not place live Maximo credentials or RTA operational data in a public static deployment.

## Vercel

The repository is linked to a Vercel project. Vercel's Node.js preset uses `server.mjs` as the root entrypoint and invokes its default export as a `(req, res)` handler; `server.mjs` exports such a handler that dispatches into the same `http.Server` used locally, evaluates without top-level `await`, and skips its own `listen()` when the `VERCEL` environment variable is set. `vercel.json` sets the build command to `npm run typecheck` on purpose: the Node.js preset runs the package `build` script otherwise, then treats any `dist/index.js` it finds as the server, and that file is the compiled library barrel, not the server. With no emitted `dist/`, the builder bundles `server.mjs` and its TypeScript imports itself. `includeFiles` ships `index.html` and `web/**` next to the bundle for the static routes. Pushes to `main` deploy production; pull-request branches get preview deployments. Preview deployments are protected by Vercel authentication by default. Set the same variables as `.env.example` in the Vercel project when needed; without them the deployment runs the synthetic demo with in-memory adapters, which is the only mode suitable for a public URL.

## Local open-source brain

Run an OpenAI-compatible local inference endpoint using an open-source runtime such as llama.cpp or vLLM. Set `LLM_BASE_URL` and `LLM_MODEL`. The RailMind domain layer does not import a proprietary model SDK.

## Modes

`RAILMIND_MODE=demo` (default) runs the synthetic provider and the public demo identities. `RAILMIND_MODE=production` requires `RAILMIND_USERS`, `DATABASE_URL` and live adapters for every source; the server refuses to start when any is missing and never substitutes synthetic data. Only the Maximo read adapter exists today; contract-repository and condition-monitoring adapters are pending, so production mode cannot start yet by design.

## Containers

`Dockerfile` builds a Node 22 image with production dependencies only (the optional `pg` driver included) and runs `server.mjs` directly; there is no build step because Node strips types at runtime. `infra/docker-compose.yml` starts PostgreSQL and the app with `DATABASE_URL` preset. Configure a model endpoint with `LLM_BASE_URL` (use `host.docker.internal` for a llama.cpp server on the host).

## Database

`infra/docker-compose.yml` starts PostgreSQL 16 with pgvector. It is optional for the static preview. When `DATABASE_URL` is set, `server.mjs` switches the audit log, memory store and report state to the PostgreSQL adapters and applies `infra/sql/001_railmind_core.sql` on start. The optional `pg` driver is installed by `npm ci`; without it the server reports a clear error instead of falling back silently.

Audit rows are append-only at database level (trigger on `railmind_audit_events`). Appends are serialised with a transaction-scoped advisory lock so the hash chain stays linear under concurrent writers.

The static preview works without the API (GitHub Pages or any static host): the approval gate then renders read-only from the generated data pack and says so.
