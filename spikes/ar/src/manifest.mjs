// Fixture manifest: binds each synthetic source image to its prepared AR artifact (BR-AR-002 evidence).
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';

export const sha256 = (buf) => createHash('sha256').update(buf).digest('hex');
export const artifactIdFor = (sha) => `ar-${sha.slice(0, 16)}`;

export function manifestPath(rootDir) {
  return path.join(rootDir, 'fixtures', 'manifest.json');
}
export function loadManifest(rootDir) {
  return JSON.parse(fs.readFileSync(manifestPath(rootDir), 'utf8'));
}
export function saveManifest(rootDir, manifest) {
  fs.writeFileSync(manifestPath(rootDir), JSON.stringify(manifest, null, 2) + '\n');
}

function storeArtifactFile(rootDir, buffer) {
  const hash = sha256(buffer);
  const artifactId = artifactIdFor(hash);
  const file = `artifacts/${artifactId}.mind`;
  fs.mkdirSync(path.join(rootDir, 'artifacts'), { recursive: true });
  fs.writeFileSync(path.join(rootDir, file), buffer);
  return { hash, artifactId, file };
}

/** Store an externally compiled artifact (e.g. from the MindAR compile tool) for one source version. */
export function registerArtifact(rootDir, manifest, { versionKey, buffer, tool, toolVersion }) {
  const version = manifest.versions[versionKey];
  if (!version) throw new Error(`unknown version ${versionKey}`);
  const { hash, artifactId, file } = storeArtifactFile(rootDir, buffer);
  version.artifact = {
    artifactId,
    file,
    sha256: hash,
    sizeBytes: buffer.length,
    sourceRevisionId: version.projectRevisionId,
    sourceImageSha256: version.sourceImageSha256,
    tool,
    toolVersion,
    registeredAt: new Date().toISOString(),
  };
  return version.artifact;
}

/** Compare a freshly compiled artifact with the registered one without replacing it (P02 Q4). */
export function checkReproducible(manifest, { versionKey, buffer }) {
  const current = manifest.versions[versionKey]?.artifact;
  if (!current) throw new Error(`version ${versionKey} has no registered artifact`);
  const newSha = sha256(buffer);
  const result = {
    versionKey,
    previousSha256: current.sha256,
    newSha256: newSha,
    match: current.sha256 === newSha,
    checkedAt: new Date().toISOString(),
  };
  (manifest.reproducibilityChecks ||= []).push(result);
  return result;
}

/** Test-only multi-target artifact (targets compiled in the order of `order`). */
export function registerCombined(rootDir, manifest, { buffer, order, tool, toolVersion }) {
  const { hash, artifactId, file } = storeArtifactFile(rootDir, buffer);
  manifest.combined = {
    artifactId,
    file,
    sha256: hash,
    sizeBytes: buffer.length,
    targets: Object.fromEntries(order.map((k, i) => [k, i])),
    sourceImageSha256: Object.fromEntries(order.map((k) => [k, manifest.versions[k].sourceImageSha256])),
    tool,
    toolVersion,
    registeredAt: new Date().toISOString(),
    testOnly: true,
  };
  return manifest.combined;
}
