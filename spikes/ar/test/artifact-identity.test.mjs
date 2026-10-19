// Review item: artifact identity must be immutable. Canonical id = FULL SHA-256; a short form is display only; an
// existing artifact is never overwritten, even if a name collides.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadManifest, registerArtifact, registerCombined, artifactIdFor, shortArtifactId, sha256 } from '../src/manifest.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PROV = { status: 'manual-unverified', detail: 'synthetic test bytes' };
const makeManifest = () => ({ versions: { A: { projectRevisionId: 'rev-A', sourceImageSha256: 'a'.repeat(64), artifact: null }, B: { projectRevisionId: 'rev-B', sourceImageSha256: 'b'.repeat(64), artifact: null } } });
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'ar-id-'));

test('canonical id is "ar-" + the full 64-hex SHA-256; malformed hashes are rejected', () => {
  const sha = sha256(Buffer.from('x'));
  assert.equal(artifactIdFor(sha), `ar-${sha}`);
  assert.equal(artifactIdFor(sha).length, 3 + 64);
  for (const bad of ['', sha.slice(0, 16), sha.toUpperCase(), `${sha}0`, 'g'.repeat(64), undefined]) {
    assert.throws(() => artifactIdFor(bad), /full lowercase SHA-256/, String(bad));
  }
});

test('the short id is a display prefix of the canonical id and is never the file name', () => {
  const id = artifactIdFor(sha256(Buffer.from('y')));
  assert.equal(shortArtifactId(id), id.slice(0, 15));
  assert.ok(id.startsWith(shortArtifactId(id)));
  const dir = tmp();
  const art = registerArtifact(dir, makeManifest(), { versionKey: 'A', buffer: Buffer.from('y'), tool: 't', toolVersion: '1', provenance: PROV });
  assert.equal(art.file, `artifacts/${id}.mind`);
});

test('every committed artifact record uses the full SHA-256 as id and file name', () => {
  const m = loadManifest(ROOT);
  const entries = [...Object.values(m.versions).map((v) => v.artifact), m.combined];
  for (const a of entries) {
    assert.equal(a.artifactId, `ar-${a.sha256}`);
    assert.equal(a.file, `artifacts/${a.artifactId}.mind`);
    assert.equal(sha256(fs.readFileSync(path.join(ROOT, a.file))), a.sha256);
  }
  const files = fs.readdirSync(path.join(ROOT, 'artifacts')).filter((f) => f.endsWith('.mind'));
  assert.deepEqual(files.sort(), entries.map((a) => path.basename(a.file)).sort(), 'no stray artifact files');
});

test('an id collision or tampered file is refused and the existing file is left untouched', () => {
  const dir = tmp();
  const wanted = Buffer.from('prepared-bytes');
  const squatter = Buffer.from('some other bytes under the same name');
  const file = path.join(dir, 'artifacts', `${artifactIdFor(sha256(wanted))}.mind`);
  fs.mkdirSync(path.dirname(file));
  fs.writeFileSync(file, squatter);
  assert.throws(() => registerArtifact(dir, makeManifest(), { versionKey: 'A', buffer: wanted, tool: 't', toolVersion: '1', provenance: PROV }), /collision or tampering/);
  assert.throws(() => registerCombined(dir, makeManifest(), { buffer: wanted, order: ['A', 'B'], tool: 't', toolVersion: '1', provenance: PROV }), /collision or tampering/);
  assert.deepEqual(fs.readFileSync(file), squatter, 'existing artifact was not overwritten');
});

test('registering identical bytes again is idempotent and never rewrites the file', () => {
  const dir = tmp();
  const m = makeManifest();
  const a = registerArtifact(dir, m, { versionKey: 'A', buffer: Buffer.from('same'), tool: 't', toolVersion: '1', provenance: PROV });
  const before = fs.statSync(path.join(dir, a.file)).mtimeMs;
  const again = registerArtifact(dir, m, { versionKey: 'A', buffer: Buffer.from('same'), tool: 't', toolVersion: '1', provenance: PROV });
  assert.equal(again.artifactId, a.artifactId);
  assert.equal(fs.statSync(path.join(dir, a.file)).mtimeMs, before);
});

test('registering without an explicit provenance status is refused', () => {
  for (const provenance of [undefined, {}, { status: 'verified' }, { status: 'trusted-me' }]) {
    assert.throws(() => registerArtifact(tmp(), makeManifest(), { versionKey: 'A', buffer: Buffer.from('z'), tool: 't', toolVersion: '1', provenance }), /provenance\.status must be one of/);
  }
});
