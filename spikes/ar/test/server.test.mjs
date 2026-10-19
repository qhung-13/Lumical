import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createServer } from '../src/server.mjs';
import { createRegistry } from '../src/registry.mjs';
import { registerArtifact, registerCombined } from '../src/manifest.mjs';

const PROV = { status: 'manual-unverified', detail: 'synthetic test bytes, not a real .mind file' };

const TOKEN_A = 'tokenAAAAAAAAAAAAAAAAAAAAAAAA';
const TOKEN_B = 'tokenBBBBBBBBBBBBBBBBBBBBBBBB';
let dir, manifest, server, base, idA, idB, idC;

function boot(enableCombined) {
  const registry = createRegistry({
    manifest,
    rootDir: dir,
    sessions: [
      { token: TOKEN_A, versionKey: 'A' },
      { token: TOKEN_B, versionKey: 'B' },
    ],
    enableCombined,
  });
  return new Promise((resolve) => {
    const s = createServer({ registry, rootDir: path.resolve('.') });
    s.listen(0, '127.0.0.1', () => resolve(s));
  });
}
const call = (p, { token, method = 'GET', body } = {}) =>
  fetch(base + p, {
    method,
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });

before(async () => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ar-srv-'));
  manifest = {
    versions: {
      A: { projectRevisionId: 'rev-A', sourceImageSha256: 'a'.repeat(64), artifact: null },
      B: { projectRevisionId: 'rev-B', sourceImageSha256: 'b'.repeat(64), artifact: null },
    },
  };
  idA = registerArtifact(dir, manifest, { versionKey: 'A', buffer: Buffer.from('mind-A-bytes'), tool: 't', toolVersion: '1', provenance: PROV }).artifactId;
  idB = registerArtifact(dir, manifest, { versionKey: 'B', buffer: Buffer.from('mind-B-bytes'), tool: 't', toolVersion: '1', provenance: PROV }).artifactId;
  idC = registerCombined(dir, manifest, { buffer: Buffer.from('mind-AB-bytes'), order: ['A', 'B'], tool: 't', toolVersion: '1', provenance: PROV }).artifactId;
  server = await boot(true);
  base = `http://127.0.0.1:${server.address().port}`;
});
after(() => server.close());

test('each session reveals only its own version (image + message)', async () => {
  const a = await (await call('/api/spike/reveal', { token: TOKEN_A, method: 'POST', body: { artifactId: idA, targetIndex: 0 } })).json();
  const b = await (await call('/api/spike/reveal', { token: TOKEN_B, method: 'POST', body: { artifactId: idB, targetIndex: 0 } })).json();
  assert.equal(a.versionLabel, 'A');
  assert.equal(b.versionLabel, 'B');
  assert.match(a.message, /version A/);
  assert.ok(a.image.dataUri.startsWith('data:image/svg+xml'));
  assert.ok(!JSON.stringify(a).includes('version B'));
});

test('wrong-version artifact, unknown token and no token all fail identically (fail closed)', async () => {
  const wrongVersion = await call('/api/spike/reveal', { token: TOKEN_A, method: 'POST', body: { artifactId: idB, targetIndex: 0 } });
  const unknownToken = await call('/api/spike/reveal', { token: 'x'.repeat(24), method: 'POST', body: { artifactId: idA, targetIndex: 0 } });
  const noToken = await call('/api/spike/reveal', { method: 'POST', body: { artifactId: idA, targetIndex: 0 } });
  const bodies = await Promise.all([wrongVersion, unknownToken, noToken].map(async (r) => [r.status, await r.json()]));
  for (const x of bodies) assert.deepEqual(x, [404, { code: 'NOT_FOUND' }]);
});

test('artifact download is authorized and version-scoped', async () => {
  assert.equal((await call(`/api/spike/artifacts/${idA}`, { token: TOKEN_A })).status, 200);
  assert.equal((await call(`/api/spike/artifacts/${idA}`)).status, 404);
  assert.equal((await call(`/api/spike/artifacts/${idB}`, { token: TOKEN_A })).status, 404);
  assert.equal((await call('/api/spike/artifacts/ar-doesnotexist', { token: TOKEN_A })).status, 404);
});

test('recognition is not authorization: a recognized B target inside an A session reveals nothing', async () => {
  const wrongIndex = await call('/api/spike/reveal', { token: TOKEN_A, method: 'POST', body: { artifactId: idC, targetIndex: 1 } });
  assert.equal(wrongIndex.status, 404);
  assert.deepEqual(await wrongIndex.json(), { code: 'NOT_FOUND' });
  const rightIndex = await call('/api/spike/reveal', { token: TOKEN_A, method: 'POST', body: { artifactId: idC, targetIndex: 0 } });
  assert.equal((await rightIndex.json()).versionLabel, 'A');
  const bSession = await call('/api/spike/reveal', { token: TOKEN_B, method: 'POST', body: { artifactId: idC, targetIndex: 1 } });
  assert.equal((await bSession.json()).versionLabel, 'B');
});

test('malformed recognition input never reveals', async () => {
  for (const body of [{ artifactId: idA, targetIndex: '0' }, { artifactId: idA, targetIndex: -1 }, { artifactId: idA, targetIndex: 0.5 }, { artifactId: 5, targetIndex: 0 }, { targetIndex: 0 }, null]) {
    const r = await call('/api/spike/reveal', { token: TOKEN_A, method: 'POST', body });
    assert.equal(r.status, 404);
  }
  const big = await fetch(base + '/api/spike/reveal', { method: 'POST', headers: { Authorization: `Bearer ${TOKEN_A}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ pad: 'x'.repeat(5000) }) }).catch(() => ({ status: 413 }));
  assert.ok([413, 404].includes(big.status));
});

test('camera-free fallback returns the same content as the reveal', async () => {
  const reveal = await (await call('/api/spike/reveal', { token: TOKEN_A, method: 'POST', body: { artifactId: idA, targetIndex: 0 } })).json();
  const fallback = await (await call('/api/spike/content', { token: TOKEN_A })).json();
  assert.deepEqual(fallback, reveal);
  assert.equal((await call('/api/spike/content')).status, 404);
});

test('preparation failure: tampered or missing artifact is UNAVAILABLE, fallback still works', async () => {
  const file = path.join(dir, manifest.versions.B.artifact.file);
  const original = fs.readFileSync(file);
  fs.writeFileSync(file, Buffer.from('tampered'));
  const dl = await call(`/api/spike/artifacts/${idB}`, { token: TOKEN_B });
  assert.equal(dl.status, 503);
  assert.deepEqual(await dl.json(), { code: 'UNAVAILABLE' });
  const reveal = await call('/api/spike/reveal', { token: TOKEN_B, method: 'POST', body: { artifactId: idB, targetIndex: 0 } });
  assert.equal(reveal.status, 503);
  const session = await (await call('/api/spike/session', { token: TOKEN_B })).json();
  assert.equal(session.version.status, 'UNAVAILABLE');
  assert.equal((await call('/api/spike/content', { token: TOKEN_B })).status, 200);
  fs.rmSync(file);
  assert.equal((await call(`/api/spike/artifacts/${idB}`, { token: TOKEN_B })).status, 503);
  fs.writeFileSync(file, original);
  assert.equal((await call(`/api/spike/artifacts/${idB}`, { token: TOKEN_B })).status, 200);
});

test('combined artifact is not exposed unless explicitly enabled', async () => {
  const off = await boot(false);
  const b = `http://127.0.0.1:${off.address().port}`;
  const r = await fetch(`${b}/api/spike/artifacts/${idC}`, { headers: { Authorization: `Bearer ${TOKEN_A}` } });
  assert.equal(r.status, 404);
  const s = await (await fetch(`${b}/api/spike/session`, { headers: { Authorization: `Bearer ${TOKEN_A}` } })).json();
  assert.equal(s.combined, null);
  off.close();
});

test('security headers: no-store, strict CSP, no CORS, camera only for self', async () => {
  const page = await fetch(base + '/');
  const csp = page.headers.get('content-security-policy');
  assert.match(csp, /connect-src 'self' blob:/);
  assert.match(csp, /default-src 'none'/);
  assert.match(csp, /script-src 'self' 'wasm-unsafe-eval' 'sha256-/);
  assert.equal(page.headers.get('cache-control'), 'no-store');
  assert.equal(page.headers.get('referrer-policy'), 'no-referrer');
  assert.match(page.headers.get('permissions-policy'), /camera=\(self\)/);
  const api = await call('/api/spike/content', { token: TOKEN_A });
  assert.equal(api.headers.get('access-control-allow-origin'), null);
  assert.equal(api.headers.get('cache-control'), 'no-store');
});

test('vendor path traversal is rejected', async () => {
  const r = await fetch(base + '/vendor/three-addons/..%2F..%2F..%2F..%2Fpackage.json');
  assert.equal(r.status, 404);
});

test('missing vendor bundle (npm install not run) yields a clean error, not a crash', async () => {
  const r = await fetch(base + '/vendor/mindar/mindar-image-three.prod.js');
  assert.ok([200, 404, 500].includes(r.status));
  assert.equal((await fetch(base + '/healthz')).status, 200);
});
