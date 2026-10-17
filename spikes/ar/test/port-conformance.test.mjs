// I03-P04: does the harness behave the way the proposed port (port/ar-provider-port.ts) requires?
// Source version binding and immutable-artifact semantics are checked against the REAL manifest and artifacts.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadManifest, registerArtifact, sha256, artifactIdFor } from '../src/manifest.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const manifest = loadManifest(ROOT);

// Adapter-side mapping: manifest entry -> PreparedARArtifact (port/ar-provider-port.ts).
const toPrepared = (version) => {
  const a = version.artifact;
  return {
    artifactId: a.artifactId, sourceRevisionId: a.sourceRevisionId, sourceImageSha256: a.sourceImageSha256,
    artifactSha256: a.sha256, sizeBytes: a.sizeBytes, targetCount: 1,
    providerId: 'mindar', providerVersion: a.toolVersion, preparedAt: a.registeredAt,
    providerMetadata: { tool: a.tool, toolVersion: a.toolVersion },
  };
};

test('every registered artifact maps onto PreparedARArtifact with all required fields', () => {
  for (const [k, v] of Object.entries(manifest.versions)) {
    const p = toPrepared(v);
    for (const field of ['artifactId', 'sourceRevisionId', 'sourceImageSha256', 'artifactSha256', 'providerVersion', 'preparedAt']) {
      assert.ok(p[field], `${k}.${field}`);
    }
    assert.equal(p.sourceRevisionId, v.projectRevisionId, 'bound to the source revision');
    assert.equal(p.sourceImageSha256, v.sourceImageSha256, 'bound to the exact source image');
    assert.equal(p.sizeBytes, fs.statSync(path.join(ROOT, v.artifact.file)).size);
  }
});

test('artifact id is content-addressed: same bytes same id, one changed byte a different id', () => {
  const bytes = fs.readFileSync(path.join(ROOT, manifest.versions.A.artifact.file));
  assert.equal(artifactIdFor(sha256(bytes)), manifest.versions.A.artifact.artifactId);
  const tampered = Buffer.from(bytes); tampered[10] ^= 1;
  assert.notEqual(artifactIdFor(sha256(tampered)), manifest.versions.A.artifact.artifactId);
});

test('a new artifact for the same source never overwrites the old bytes (old id keeps resolving)', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'p04-'));
  try {
    const m = structuredClone(manifest);
    const first = Buffer.from('prepared-v1'), second = Buffer.from('prepared-v2');
    const a1 = { ...registerArtifact(tmp, m, { versionKey: 'A', buffer: first, tool: 't', toolVersion: '1' }) };
    const a2 = { ...registerArtifact(tmp, m, { versionKey: 'A', buffer: second, tool: 't', toolVersion: '2' }) };
    assert.notEqual(a1.artifactId, a2.artifactId);
    assert.deepEqual(fs.readFileSync(path.join(tmp, a1.file)), first, 'old artifact bytes untouched');
    assert.deepEqual(fs.readFileSync(path.join(tmp, a2.file)), second);
    // Registering identical bytes again is idempotent.
    const a3 = registerArtifact(tmp, m, { versionKey: 'A', buffer: second, tool: 't', toolVersion: '2' });
    assert.equal(a3.artifactId, a2.artifactId);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test('the combined test artifact is explicitly test-only and never a production shape (targetCount is 1)', () => {
  assert.equal(manifest.combined.testOnly, true);
  assert.ok(Object.keys(manifest.combined.targets).length > 1);
  for (const v of Object.values(manifest.versions)) assert.equal(toPrepared(v).targetCount, 1);
});
