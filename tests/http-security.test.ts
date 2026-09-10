import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';

import { resolvePublicPath } from '../src/http/public-paths.ts';
import { contentSecurityPolicy, cspScriptHash, inlineScripts, securityHeaders } from '../src/http/security-headers.ts';

const rejected = [
  '/package.json', '/package-lock.json', '/.env', '/.env.local', '/src/demo.ts', '/src/', '/tests/api.test.ts', '/docs/README.md',
  '/.git/HEAD', '/.git/config', '/tsconfig.json', '/infra/docker-compose.yml', '/server.mjs', '/CLAUDE.md', '/README.md',
  '/../package.json', '/web/../package.json', '/web/%2e%2e/package.json', '/%2e%2e/%2e%2e/etc/passwd', '/..%2fpackage.json', '/web/..%2f..%2fpackage.json',
  '//etc/passwd', '/web//app.js', '/web/./app.js', '/web/.hidden.js', '/web/app.js%00.txt', '/web/app.js\0', '/web/%252e%252e/package.json',
  '/web/app.ts', '/web/data/', '/web/README', '/index.html/../package.json', 'web/app.js', '/%zz',
];

test('public path resolver rejects repository, secret and traversal paths', () => {
  for (const path of rejected) {
    const result = resolvePublicPath(path);
    assert.equal(result.kind, 'reject', `${JSON.stringify(path)} must be rejected`);
    if (result.kind === 'reject') assert.ok([400, 404].includes(result.status));
  }
});

test('public path resolver serves only the interface files', () => {
  const ok = (path: string, relativePath: string) => { const r = resolvePublicPath(path); assert.equal(r.kind, 'file', path); if (r.kind === 'file') assert.equal(r.relativePath, relativePath); };
  ok('/', 'index.html');
  ok('/index.html', 'index.html');
  ok('/?lang=en', 'index.html');
  ok('/web/app.js', 'web/app.js');
  ok('/web/styles.css', 'web/styles.css');
  ok('/web/data/demo-pack.js', 'web/data/demo-pack.js');
  ok('/web/portfolio.html', 'web/portfolio.html');
  ok('/web/portfolio.js', 'web/portfolio.js');
  ok('/web/data/portfolio-pack.js', 'web/data/portfolio-pack.js');
});

test('security headers include CSP, nosniff, referrer, frame and permissions policies', async () => {
  const headers = securityHeaders();
  for (const name of ['Content-Security-Policy', 'X-Content-Type-Options', 'Referrer-Policy', 'X-Frame-Options', 'Permissions-Policy']) assert.ok(headers[name], name);
  assert.match(contentSecurityPolicy(), /script-src 'self';/);
  assert.match(contentSecurityPolicy(), /object-src 'none'/);
  assert.match(contentSecurityPolicy({ inlineScriptHashes: ['abc'] }), /script-src 'self' 'sha256-abc'/);
  assert.deepEqual(inlineScripts('<script src="a.js"></script><script>alert(1)</script><SCRIPT type="module">x</SCRIPT>'), ['alert(1)', 'x']);
  assert.match(await cspScriptHash('alert(1)'), /^[A-Za-z0-9+/]+=*$/);
});

async function startServer(): Promise<{ base: string; stop: () => void }> {
  const child = spawn(process.execPath, ['--experimental-strip-types', 'server.mjs'], { env: { ...process.env, PORT: '0', DATABASE_URL: '' }, stdio: ['ignore', 'pipe', 'pipe'] });
  let port = 0;
  let buffer = '';
  child.stdout.setEncoding('utf8');
  const started = new Promise<void>((resolve, reject) => {
    child.stdout.on('data', (chunk: string) => {
      buffer += chunk;
      for (const line of buffer.split('\n')) {
        if (line.includes('"RailMind Agent OS started"')) { port = (JSON.parse(line) as { port: number }).port; resolve(); }
      }
    });
    child.on('exit', (code) => reject(new Error(`server exited early with ${code}`)));
    setTimeout(() => reject(new Error('server start timeout')), 15000).unref();
  });
  await started;
  return { base: `http://127.0.0.1:${port}`, stop: () => { child.kill('SIGTERM'); } };
}

test('live server: repository files and traversal variants are unreachable; interface files carry security headers', async () => {
  const server = await startServer();
  try {
    for (const path of ['/package.json', '/.env', '/src/demo.ts', '/.git/HEAD', '/docs/openapi.yaml', '/web/../package.json', '/web/%2e%2e/package.json', '/..%2fpackage.json', '//etc/passwd', '/web/app.js%00.txt', '/server.mjs', '/tests/']) {
      const response = await fetch(`${server.base}${path}`);
      assert.ok([400, 404].includes(response.status), `${path} returned ${response.status}`);
      const body = await response.text();
      assert.doesNotMatch(body, /"name": "project-44|DATABASE_URL|export const|ref: refs/);
    }
    const index = await fetch(`${server.base}/`);
    assert.equal(index.status, 200);
    assert.match(index.headers.get('content-security-policy') ?? '', /script-src 'self'/);
    assert.equal(index.headers.get('x-content-type-options'), 'nosniff');
    assert.equal(index.headers.get('referrer-policy'), 'no-referrer');
    assert.equal(index.headers.get('x-frame-options'), 'SAMEORIGIN');
    assert.ok(index.headers.get('permissions-policy'));
    const portfolio = await fetch(`${server.base}/web/portfolio.html`);
    assert.equal(portfolio.status, 200);
    assert.match(portfolio.headers.get('content-security-policy') ?? '', /script-src 'self';/);
    assert.doesNotMatch(await portfolio.text(), /<script>(?!\s*<\/script>)/, 'portfolio page must not embed an inline script');
    const head = await fetch(`${server.base}/web/app.js`, { method: 'HEAD' });
    assert.equal(head.status, 200);
    assert.equal((await head.text()).length, 0);
    const put = await fetch(`${server.base}/index.html`, { method: 'PUT', body: 'x' });
    assert.equal(put.status, 405);
    assert.equal(put.headers.get('allow'), 'GET, HEAD');
    const unknownApi = await fetch(`${server.base}/api/nothing`);
    assert.equal(unknownApi.status, 401, 'unknown API routes are not revealed to unauthenticated callers');
    assert.match(unknownApi.headers.get('content-security-policy') ?? '', /default-src 'self'/);
    const health = await fetch(`${server.base}/api/health`);
    assert.equal(health.status, 200);
  } finally {
    server.stop();
  }
});
