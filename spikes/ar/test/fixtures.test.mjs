// Checks on the committed fixtures and prepared artifacts. These are integrity checks, not recognition proof.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadManifest, sha256, artifactIdFor } from '../src/manifest.mjs';
import { buildContent } from '../src/content.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const manifest = loadManifest(ROOT);
const read = (f) => fs.readFileSync(path.join(ROOT, f));

test('source images match their recorded hashes and are distinct', () => {
  const hashes = Object.values(manifest.versions).map((v) => sha256(read(v.sourceImage)));
  for (const [k, v] of Object.entries(manifest.versions)) assert.equal(sha256(read(v.sourceImage)), v.sourceImageSha256, k);
  assert.equal(new Set([...hashes, sha256(read('fixtures/targets/unknown.png'))]).size, 3);
});

test('each version has a registered artifact bound to its own source revision and image hash', () => {
  for (const [k, v] of Object.entries(manifest.versions)) {
    const a = v.artifact;
    assert.ok(a, `${k} has an artifact (run npm run compile)`);
    assert.equal(sha256(read(a.file)), a.sha256, `${k} bytes match recorded hash`);
    assert.equal(a.artifactId, artifactIdFor(a.sha256));
    assert.equal(a.sourceRevisionId, v.projectRevisionId);
    assert.equal(a.sourceImageSha256, v.sourceImageSha256);
  }
  const [a, b] = Object.values(manifest.versions).map((v) => v.artifact.sha256);
  assert.notEqual(a, b);
});

test('combined artifact is test-only, ordered A then B and bound to the same source hashes', () => {
  const c = manifest.combined;
  assert.ok(c, 'combined artifact registered');
  assert.equal(c.testOnly, true);
  assert.deepEqual(c.targets, { A: 0, B: 1 });
  assert.equal(sha256(read(c.file)), c.sha256);
  for (const k of ['A', 'B']) assert.equal(c.sourceImageSha256[k], manifest.versions[k].sourceImageSha256);
});

test('recorded reproducibility checks all report byte-identical recompiles, each with its environment', () => {
  const checks = manifest.reproducibilityChecks ?? [];
  assert.ok(checks.length > 0, 'at least one check recorded (npm run compile:verify)');
  assert.ok(checks.every((c) => c.match === true));
  // A match is only meaningful together with the environment it was observed in.
  assert.ok(checks.every((c) => c.environment?.node && c.environment?.platform && c.environment?.arch), 'every check records Node, OS and architecture');
});

test('prepared artifacts and private content are not reachable as public static files', async () => {
  const { createServer } = await import('../src/server.mjs');
  const { createRegistry } = await import('../src/registry.mjs');
  const server = createServer({ registry: createRegistry({ manifest, rootDir: ROOT, sessions: [] }), rootDir: ROOT });
  await new Promise((ok) => server.listen(0, '127.0.0.1', ok));
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    for (const p of [`/${manifest.versions.A.artifact.file}`, '/artifacts/', '/fixtures/manifest.json', '/api/spike/content', '/api/spike/session']) {
      const res = await fetch(base + p);
      assert.ok([403, 404].includes(res.status), `${p} -> ${res.status}`);
    }
    const body = await (await fetch(base + '/api/spike/content')).text();
    assert.ok(!body.includes(buildContent('A').message));
  } finally {
    server.close();
  }
});
