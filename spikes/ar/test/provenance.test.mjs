// Review item: an artifact is bound to a source revision only after the source image hash and the file structure are
// verified; anything that cannot be proven is recorded as `manual-unverified`.
// Note: a .mind file stores target sizes and features, not the source pixels, so "verified" means: the bytes equal a fresh
// Node recompile of the hash-checked source, in the recorded toolchain. It is not a claim about other environments.
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadManifest, sha256 } from '../src/manifest.mjs';
import { verifyAndBind, ProvenanceError } from '../src/provenance.mjs';
import { compileImages, readPng } from '../src/prepare.mjs';
import { createRegistry } from '../src/registry.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const real = loadManifest(ROOT);
const artifactBytes = (k) => fs.readFileSync(path.join(ROOT, real.versions[k].artifact.file));
let recompiledA;

// A throw-away root with the fixture images and a manifest that has no artifacts registered yet.
function sandbox() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ar-prov-'));
  fs.mkdirSync(path.join(dir, 'fixtures/targets'), { recursive: true });
  for (const v of Object.values(real.versions)) fs.copyFileSync(path.join(ROOT, v.sourceImage), path.join(dir, v.sourceImage));
  const manifest = structuredClone(real);
  for (const v of Object.values(manifest.versions)) v.artifact = null;
  delete manifest.combined;
  return { dir, manifest };
}

before(async () => {
  recompiledA = await compileImages([readPng(path.join(ROOT, real.versions.A.sourceImage))]);
});

test('a source image that no longer matches the manifest hash is refused (no binding to a changed image)', async () => {
  const { dir, manifest } = sandbox();
  const img = path.join(dir, manifest.versions.A.sourceImage);
  const bytes = fs.readFileSync(img);
  bytes[bytes.length - 20] ^= 0x01;
  fs.writeFileSync(img, bytes);
  await assert.rejects(verifyAndBind(dir, manifest, { versionKey: 'A', buffer: artifactBytes('A'), tool: 't' }), (e) => e instanceof ProvenanceError && /does not match the manifest hash/.test(e.message));
  assert.equal(manifest.versions.A.artifact, null, 'nothing was bound');
});

test('bytes that are not a MindAR file are refused', async () => {
  const { dir, manifest } = sandbox();
  await assert.rejects(verifyAndBind(dir, manifest, { versionKey: 'A', buffer: Buffer.from('not a mind file'), tool: 't' }), /not a valid MindAR/);
  assert.equal(manifest.versions.A.artifact, null);
});

test('a file with the wrong number of targets is refused (combined A+B cannot be bound to version A alone)', async () => {
  const { dir, manifest } = sandbox();
  const combined = fs.readFileSync(path.join(ROOT, real.combined.file));
  await assert.rejects(verifyAndBind(dir, manifest, { versionKey: 'A', buffer: combined, tool: 't' }), /expected 1 target/);
});

test('a missing source image is refused', async () => {
  const { dir, manifest } = sandbox();
  fs.rmSync(path.join(dir, manifest.versions.A.sourceImage));
  await assert.rejects(verifyAndBind(dir, manifest, { versionKey: 'A', buffer: artifactBytes('A'), tool: 't' }), /source image for A is missing/);
});

test('an artifact compiled from the OTHER image (same size) is bound as manual-unverified, never as verified', async () => {
  const { dir, manifest } = sandbox();
  const art = await verifyAndBind(dir, manifest, { versionKey: 'A', buffer: artifactBytes('B'), tool: 'external', toolVersion: 'x' });
  assert.equal(art.provenance.status, 'manual-unverified');
  assert.match(art.provenance.detail, /not proven/);
  assert.equal(manifest.versions.A.artifact.provenance.status, 'manual-unverified');
});

test('--require-verified refuses an artifact that cannot be proven', async () => {
  const { dir, manifest } = sandbox();
  await assert.rejects(verifyAndBind(dir, manifest, { versionKey: 'A', buffer: artifactBytes('B'), tool: 'external', requireVerified: true }), /manual-unverified/);
  assert.equal(manifest.versions.A.artifact, null);
});

test('an external file equal to a fresh recompile of the verified source is verified-recompile', async (t) => {
  if (sha256(recompiledA) !== real.versions.A.artifact.sha256) {
    t.skip('this environment does not reproduce the recorded bytes (reproducibility is only claimed for the recorded toolchain)');
    return;
  }
  const { dir, manifest } = sandbox();
  const art = await verifyAndBind(dir, manifest, { versionKey: 'A', buffer: artifactBytes('A'), tool: 'external', toolVersion: 'x' });
  assert.equal(art.provenance.status, 'verified-recompile');
  assert.equal(art.provenance.environment.node, process.version);
});

test('the session reports provenance; an artifact with no recorded provenance counts as unverified', () => {
  const manifest = structuredClone(real);
  delete manifest.versions.A.artifact.provenance; // legacy record
  const registry = createRegistry({ manifest, rootDir: ROOT, sessions: [{ token: 'tokenAAAAAAAAAAAAAAAAAAAAAA', versionKey: 'A' }, { token: 'tokenBBBBBBBBBBBBBBBBBBBBBB', versionKey: 'B' }], enableCombined: true });
  const a = registry.describeSession('tokenAAAAAAAAAAAAAAAAAAAAAA').body;
  const b = registry.describeSession('tokenBBBBBBBBBBBBBBBBBBBBBB').body;
  assert.equal(a.version.provenance, 'manual-unverified');
  assert.equal(b.version.provenance, 'built-from-verified-source');
  assert.equal(b.combined.provenance, 'built-from-verified-source');
  assert.equal(b.version.shortId, b.version.artifactId.slice(0, 15));
});

test('register-artifact.mjs binds only through verifyAndBind (no direct registerArtifact call)', () => {
  const src = fs.readFileSync(path.join(ROOT, 'scripts/register-artifact.mjs'), 'utf8');
  assert.match(src, /verifyAndBind/);
  assert.doesNotMatch(src, /registerArtifact\(|registerCombined\(/);
  assert.match(src, /manual-unverified/);
});

test('client never labels a manual-unverified artifact as verified', () => {
  const js = fs.readFileSync(path.join(ROOT, 'public/client.js'), 'utf8');
  assert.match(js, /art\.provenance === 'manual-unverified' \? `\$\{base\}, manual-unverified`/);
});
