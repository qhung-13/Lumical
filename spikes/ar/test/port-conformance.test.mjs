// I03-P04: does the harness behave the way the proposed port (port/ar-provider-port.ts) requires?
// Byte identity and source-revision binding are checked against the REAL manifest and artifacts, plus a few structural
// assertions on the sketch itself so the review changes cannot silently regress.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadManifest, registerArtifact, sha256, artifactIdFor } from '../src/manifest.mjs';

const PROV = { status: 'manual-unverified', detail: 'synthetic test bytes, not a real .mind file' };
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const manifest = loadManifest(ROOT);
const sketch = fs.readFileSync(path.join(ROOT, 'port/ar-provider-port.ts'), 'utf8');
const body = (re) => re.exec(sketch)?.[1] ?? '';

// Adapter-side mappings from the manifest record to the two separate port records.
const toArtifact = (a) => ({
  artifactId: a.artifactId, artifactSha256: a.sha256, sizeBytes: a.sizeBytes,
  providerId: 'mindar', providerVersion: a.toolVersion, createdAt: a.registeredAt, providerMetadata: { tool: a.tool },
});
const toBinding = (v) => ({
  sourceRevisionId: v.projectRevisionId, sourceImageSha256: v.sourceImageSha256, artifactId: v.artifact.artifactId,
  provenance: v.artifact.provenance, boundAt: v.artifact.registeredAt,
});

test('artifact byte identity and source-revision binding are separate records', () => {
  for (const [k, v] of Object.entries(manifest.versions)) {
    const artifact = toArtifact(v.artifact);
    const binding = toBinding(v);
    assert.equal(artifact.artifactId, `ar-${artifact.artifactSha256}`, `${k}: id is the full SHA-256`);
    assert.equal(artifact.sizeBytes, fs.statSync(path.join(ROOT, v.artifact.file)).size);
    assert.equal('sourceRevisionId' in artifact, false, 'the artifact record knows nothing about revisions');
    assert.equal(binding.artifactId, artifact.artifactId);
    assert.equal(binding.sourceRevisionId, v.projectRevisionId);
    assert.equal(binding.sourceImageSha256, v.sourceImageSha256);
    assert.ok(['built-from-verified-source', 'verified-recompile', 'manual-unverified'].includes(binding.provenance.status));
  }
});

test('artifact id is content-addressed: same bytes same id, one changed byte a different id', () => {
  const bytes = fs.readFileSync(path.join(ROOT, manifest.versions.A.artifact.file));
  assert.equal(artifactIdFor(sha256(bytes)), manifest.versions.A.artifact.artifactId);
  const tampered = Buffer.from(bytes); tampered[10] ^= 1;
  assert.notEqual(artifactIdFor(sha256(tampered)), manifest.versions.A.artifact.artifactId);
});

test('identical bytes bound to two revisions give one artifact and two bindings', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'p04-'));
  const m = { versions: { A: { projectRevisionId: 'rev-A', sourceImageSha256: 'a'.repeat(64), artifact: null }, B: { projectRevisionId: 'rev-B', sourceImageSha256: 'a'.repeat(64), artifact: null } } };
  const buf = Buffer.from('same-image-same-artifact');
  const a = registerArtifact(dir, m, { versionKey: 'A', buffer: buf, tool: 't', toolVersion: '1', provenance: PROV });
  const b = registerArtifact(dir, m, { versionKey: 'B', buffer: buf, tool: 't', toolVersion: '1', provenance: PROV });
  assert.equal(a.artifactId, b.artifactId);
  assert.equal(fs.readdirSync(path.join(dir, 'artifacts')).length, 1, 'one stored artifact');
  assert.notEqual(a.sourceRevisionId, b.sourceRevisionId, 'two distinct bindings');
});

test('a new artifact for the same source never overwrites the old bytes (old id keeps resolving)', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'p04-'));
  try {
    const m = structuredClone(manifest);
    const first = Buffer.from('prepared-v1'), second = Buffer.from('prepared-v2');
    const a1 = { ...registerArtifact(tmp, m, { versionKey: 'A', buffer: first, tool: 't', toolVersion: '1', provenance: PROV }) };
    const a2 = { ...registerArtifact(tmp, m, { versionKey: 'A', buffer: second, tool: 't', toolVersion: '2', provenance: PROV }) };
    assert.notEqual(a1.artifactId, a2.artifactId);
    assert.deepEqual(fs.readFileSync(path.join(tmp, a1.file)), first, 'old artifact bytes untouched');
    assert.deepEqual(fs.readFileSync(path.join(tmp, a2.file)), second);
    assert.equal(registerArtifact(tmp, m, { versionKey: 'A', buffer: second, tool: 't', toolVersion: '2', provenance: PROV }).artifactId, a2.artifactId);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test('the combined artifact is a harness-only test extension; production artifacts have one target', () => {
  assert.equal(manifest.combined.testOnly, true);
  assert.ok(Object.keys(manifest.combined.targets).length > 1);
  assert.match(sketch, /exactly ONE designated target/);
  assert.match(sketch, /not-single-target/);
});

test('the port sketch keeps provider target indexes out of the shared boundary', () => {
  const recognitionEvent = body(/export interface RecognitionEvent \{([^}]*)\}/);
  assert.match(recognitionEvent, /artifactId/);
  assert.doesNotMatch(recognitionEvent, /targetIndex|anchor|index/i);
  const code = sketch.split('\n').filter((l) => !l.trim().startsWith('//') && !l.trim().startsWith('*') && !l.trim().startsWith('/*')).join('\n');
  assert.doesNotMatch(code, /targetIndex/, 'no executable declaration mentions targetIndex');
});

test('the port sketch verifies hashes in prepare and the store, and content() cannot fail on AR', () => {
  assert.match(sketch, /sha256\(imageBytes\) === source\.sourceImageSha256/);
  assert.match(sketch, /`put` MUST recompute the SHA-256/);
  assert.match(sketch, /`get` MUST re-verify/);
  assert.match(sketch, /id-collision/);
  const contentResult = body(/export type ContentResult = ([^\n]*)\n/);
  assert.match(contentResult, /not_found/);
  assert.match(contentResult, /reason: 'media-unavailable'/, 'missing media remains an honest unavailable outcome');
  assert.doesNotMatch(contentResult, /artifact-unavailable/, 'AR artifact failure cannot disable fallback');
  assert.match(sketch, /content\(scope: AuthorizedShareScope \| undefined\): Promise<ContentResult>/);
});

test('harness: camera-free content works while the AR artifact is unavailable (see server.test.mjs and real-artifacts.test.mjs)', () => {
  for (const f of ['test/server.test.mjs', 'test/real-artifacts.test.mjs']) {
    assert.match(fs.readFileSync(path.join(ROOT, f), 'utf8'), /UNAVAILABLE/);
  }
});
