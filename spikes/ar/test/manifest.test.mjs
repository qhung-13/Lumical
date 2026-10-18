import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { registerArtifact, checkReproducible, registerCombined, artifactIdFor, sha256 } from '../src/manifest.mjs';

const PROV = { status: 'manual-unverified', detail: 'synthetic test bytes, not a real .mind file' };

const makeManifest = () => ({
  versions: {
    A: { projectRevisionId: 'rev-A', sourceImageSha256: 'a'.repeat(64), artifact: null },
    B: { projectRevisionId: 'rev-B', sourceImageSha256: 'b'.repeat(64), artifact: null },
  },
});

test('registered artifact is identified by hash and bound to its source revision', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ar-'));
  const m = makeManifest();
  const buf = Buffer.from('compiled-A');
  const art = registerArtifact(dir, m, { versionKey: 'A', buffer: buf, tool: 't', toolVersion: '1', provenance: PROV });
  assert.equal(art.artifactId, artifactIdFor(sha256(buf)));
  assert.equal(art.sourceRevisionId, 'rev-A');
  assert.equal(art.sourceImageSha256, 'a'.repeat(64));
  assert.ok(fs.existsSync(path.join(dir, art.file)));
  assert.equal(m.versions.B.artifact, null);
});

test('reproducibility check reports MATCH/DIFFER and keeps the registered artifact', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ar-'));
  const m = makeManifest();
  registerArtifact(dir, m, { versionKey: 'A', buffer: Buffer.from('x'), tool: 't', toolVersion: '1', provenance: PROV });
  const same = checkReproducible(m, { versionKey: 'A', buffer: Buffer.from('x') });
  const diff = checkReproducible(m, { versionKey: 'A', buffer: Buffer.from('y') });
  assert.equal(same.match, true);
  assert.equal(diff.match, false);
  assert.equal(m.versions.A.artifact.sha256, sha256(Buffer.from('x')));
  assert.equal(m.reproducibilityChecks.length, 2);
});

test('combined artifact is marked test-only with per-version target indexes', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ar-'));
  const m = makeManifest();
  const c = registerCombined(dir, m, { buffer: Buffer.from('both'), order: ['A', 'B'], tool: 't', toolVersion: '1', provenance: PROV });
  assert.equal(c.testOnly, true);
  assert.deepEqual(c.targets, { A: 0, B: 1 });
});
