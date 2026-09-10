import { createReadStream, readFileSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { createApiHandler } from './src/api/router.ts';
import { composeApplication } from './src/app/compose.ts';
import { describeConfig, loadConfig } from './src/config.ts';
import { STATIC_METHODS, resolvePublicPath } from './src/http/public-paths.ts';
import { cspScriptHash, inlineScripts, securityHeaders } from './src/http/security-headers.ts';

const config = loadConfig(process.env);
const root = dirname(fileURLToPath(import.meta.url));

/** The `pg` driver is loaded here, in the host, so the domain layer never depends on it. */
const overrides = {};
if (config.databaseUrl) {
  const { createPgDatabase } = await import('./src/persistence/pg-database.ts');
  overrides.database = await createPgDatabase(config.databaseUrl);
}
const app = await composeApplication(config, overrides);
const api = createApiHandler(app.api);

const log = (level, message, fields = {}) => console.log(JSON.stringify({ ts: new Date().toISOString(), level, message, ...fields }));

/** CSP hashes for pages that embed an inline script, computed once at start from the served file. */
const inlineScriptHashes = new Map();
async function hashesFor(relativePath) {
  if (inlineScriptHashes.has(relativePath)) return inlineScriptHashes.get(relativePath);
  const html = readFileSync(join(root, relativePath), 'utf8');
  const hashes = await Promise.all(inlineScripts(html).map(cspScriptHash));
  inlineScriptHashes.set(relativePath, hashes);
  return hashes;
}

function deny(res, status, extraHeaders = {}) {
  res.writeHead(status, { 'Content-Type': 'text/plain; charset=utf-8', ...securityHeaders(), ...extraHeaders });
  res.end(status === 404 ? 'Not found' : status === 405 ? 'Method not allowed' : 'Bad request');
}

const server = createServer(async (req, res) => {
  const started = Date.now();
  const path = (req.url ?? '/').split('?')[0];
  res.on('finish', () => { if (path.startsWith('/api/') || res.statusCode >= 400) log('info', 'request', { method: req.method, path: path.slice(0, 120), status: res.statusCode, ms: Date.now() - started }); });

  if (path.startsWith('/api/')) {
    if (await api(req, res)) return;
    return deny(res, 404);
  }
  if (!STATIC_METHODS.includes(req.method ?? '')) return deny(res, 405, { Allow: STATIC_METHODS.join(', ') });

  const resolved = resolvePublicPath(req.url);
  if (resolved.kind === 'reject') return deny(res, resolved.status);
  const file = join(root, resolved.relativePath);
  let stats;
  try { stats = statSync(file); } catch { return deny(res, 404); }
  if (!stats.isFile()) return deny(res, 404);

  const headers = { 'Content-Type': resolved.contentType, 'Content-Length': String(stats.size), ...securityHeaders(resolved.inlineScript ? { inlineScriptHashes: await hashesFor(resolved.relativePath) } : {}) };
  res.writeHead(200, headers);
  if (req.method === 'HEAD') return res.end();
  createReadStream(file).pipe(res);
});

// On Vercel the platform binds the default-exported server; listening here as well would collide with it.
if (!process.env.VERCEL) {
  server.listen(config.port, '0.0.0.0', () => log('info', 'RailMind Agent OS started', { ...describeConfig(config), url: `http://localhost:${server.address().port}`, port: server.address().port }));
}

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    log('info', 'shutting down', { signal });
    server.close(() => { app.close().finally(() => process.exit(0)); });
    setTimeout(() => process.exit(0), 3000).unref();
  });
}

export default server;
