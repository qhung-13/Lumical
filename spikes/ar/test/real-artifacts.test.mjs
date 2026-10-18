// End-to-end server flow over the REAL compiled artifacts (copied to a temp dir so faults never touch the repo).
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from '../src/server.mjs';
import { createRegistry } from '../src/registry.mjs';
import { loadManifest, sha256 } from '../src/manifest.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TA = 'realTokenAAAAAAAAAAAAAAAAAAAA';
const TB = 'realTokenBBBBBBBBBBBBBBBBBBBB';
let tmp, manifest, server, base;

const call = (p, { token, method = 'GET', body } = {}) =>
  fetch(base + p, {
    method,
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
const reveal = (token, artifactId, targetIndex) => call('/api/spike/reveal', { token, method: 'POST', body: { artifactId, targetIndex } });

before(async () => {
  manifest = loadManifest(ROOT);
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ar-real-'));
  fs.mkdirSync(path.join(tmp, 'artifacts'));
  for (const a of [manifest.versions.A.artifact, manifest.versions.B.artifact, manifest.combined]) fs.copyFileSync(path.join(ROOT, a.file), path.join(tmp, a.file));
  const registry = createRegistry({ manifest, rootDir: tmp, sessions: [{ token: TA, versionKey: 'A' }, { token: TB, versionKey: 'B' }], enableCombined: true });
  server = createServer({ registry, rootDir: ROOT });
  await new Promise((ok) => server.listen(0, '127.0.0.1', ok));
  base = `http://127.0.0.1:${server.address().port}`;
});
after(() => { server.close(); fs.rmSync(tmp, { recursive: true, force: true }); });

test('sessions are READY and serve exactly their own artifact bytes', async () => {
  for (const [token, k] of [[TA, 'A'], [TB, 'B']]) {
    const s = await (await call('/api/spike/session', { token })).json();
    assert.equal(s.scopeLabel, k);
    assert.equal(s.version.status, 'READY');
    const bytes = Buffer.from(await (await call(`/api/spike/artifacts/${s.version.artifactId}`, { token })).arrayBuffer());
    assert.equal(sha256(bytes), manifest.versions[k].artifact.sha256);
  }
});

test('reveal returns image + message for the own version only', async () => {
  const a = await (await reveal(TA, manifest.versions.A.artifact.artifactId, 0)).json();
  assert.equal(a.versionLabel, 'A');
  assert.ok(a.image.dataUri.startsWith('data:image/svg+xml'));
  assert.ok(!JSON.stringify(a).includes('version B'));
});

test('other version artifact, wrong index, no token: identical NOT_FOUND', async () => {
  const idB = manifest.versions.B.artifact.artifactId;
  const idA = manifest.versions.A.artifact.artifactId;
  const results = await Promise.all([
    reveal(TA, idB, 0), reveal(TB, idA, 0), reveal(TA, idA, 1), reveal(undefined, idA, 0), reveal('x'.repeat(30), idA, 0),
    call(`/api/spike/artifacts/${idB}`, { token: TA }),
  ]);
  for (const r of results) { assert.equal(r.status, 404); assert.deepEqual(await r.json(), { code: 'NOT_FOUND' }); }
});

test('a short id prefix never resolves to an artifact (only the full SHA-256 id does)', async () => {
  const id = manifest.versions.A.artifact.artifactId;
  for (const short of [id.slice(0, 19), id.slice(0, 15), id.slice(0, -1), id.toUpperCase()]) {
    assert.equal((await call(`/api/spike/artifacts/${short}`, { token: TA })).status, 404, short);
    assert.equal((await reveal(TA, short, 0)).status, 404, short);
  }
  assert.equal((await call(`/api/spike/artifacts/${id}`, { token: TA })).status, 200);
});

test('combined test artifact: recognizing B inside session A is refused (recognition is not authorization)', async () => {
  const c = manifest.combined.artifactId;
  assert.equal((await reveal(TA, c, 0)).status, 200); // A's own target in the combined artifact
  assert.equal((await reveal(TA, c, 1)).status, 404); // B's target recognized, still no reveal in session A
  assert.equal((await reveal(TB, c, 0)).status, 404);
  assert.equal((await reveal(TB, c, 1)).status, 200);
});

test('preparation failure: corrupt or missing artifact => UNAVAILABLE, camera-free content still works', async () => {
  const f = path.join(tmp, manifest.versions.A.artifact.file);
  const good = fs.readFileSync(f);
  const bad = Buffer.from(good); bad[bad.length >> 1] ^= 0xff;
  fs.writeFileSync(f, bad);
  assert.equal((await (await call('/api/spike/session', { token: TA })).json()).version.status, 'UNAVAILABLE');
  assert.equal((await reveal(TA, manifest.versions.A.artifact.artifactId, 0)).status, 503);
  assert.equal((await call(`/api/spike/artifacts/${manifest.versions.A.artifact.artifactId}`, { token: TA })).status, 503);
  fs.rmSync(f);
  assert.equal((await reveal(TA, manifest.versions.A.artifact.artifactId, 0)).status, 503);
  const fb = await call('/api/spike/content', { token: TA });
  assert.equal(fb.status, 200);
  assert.equal((await fb.json()).versionLabel, 'A');
  fs.writeFileSync(f, good);
});

test('pages carry a strict CSP with connect-src limited to self and blob', async () => {
  const res = await fetch(base + '/');
  const csp = res.headers.get('content-security-policy');
  assert.match(csp, /connect-src 'self' blob:/);
  assert.match(csp, /default-src 'none'/);
  assert.match(res.headers.get('permissions-policy'), /camera=\(self\)/);
});
