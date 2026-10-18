// Fixture manifest: binds each synthetic source image to its prepared AR artifact (BR-AR-002 evidence).
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';

export const sha256 = (buf) => createHash('sha256').update(buf).digest('hex');

const HEX64 = /^[0-9a-f]{64}$/;

/** Canonical artifact identity: the FULL SHA-256 of the artifact bytes. One id can only ever mean one byte sequence. */
export function artifactIdFor(sha) {
  if (!HEX64.test(sha)) throw new Error('artifactIdFor needs a full lowercase SHA-256 (64 hex characters)');
  return `ar-${sha}`;
}
/** Display only (logs, status lines). Never used as an identity, a file name or a lookup key. */
export const shortArtifactId = (artifactId) => artifactId.slice(0, 'ar-'.length + 12);

/** How an artifact is known to belong to its source image. `manual-unverified` means it could NOT be proven. */
export const PROVENANCE_STATUSES = ['built-from-verified-source', 'verified-recompile', 'manual-unverified'];

export function manifestPath(rootDir) {
  return path.join(rootDir, 'fixtures', 'manifest.json');
}
export function loadManifest(rootDir) {
  return JSON.parse(fs.readFileSync(manifestPath(rootDir), 'utf8'));
}
export function saveManifest(rootDir, manifest) {
  fs.writeFileSync(manifestPath(rootDir), JSON.stringify(manifest, null, 2) + '\n');
}

/**
 * Content-addressed, write-once. An existing file with the same name must hold byte-identical content (idempotent);
 * anything else is an id collision or tampering and is refused. An existing artifact is never overwritten.
 */
function storeArtifactFile(rootDir, buffer) {
  const hash = sha256(buffer);
  const artifactId = artifactIdFor(hash);
  const file = `artifacts/${artifactId}.mind`;
  const full = path.join(rootDir, file);
  fs.mkdirSync(path.join(rootDir, 'artifacts'), { recursive: true });
  if (fs.existsSync(full)) {
    if (!fs.readFileSync(full).equals(buffer)) {
      throw new Error(`artifact id collision or tampering: ${file} exists with different bytes; refusing to overwrite`);
    }
  } else {
    fs.writeFileSync(full, buffer, { flag: 'wx' }); // 'wx' fails instead of replacing a file created in the meantime
  }
  return { hash, artifactId, file };
}

function assertProvenance(provenance) {
  if (!provenance || !PROVENANCE_STATUSES.includes(provenance.status)) {
    throw new Error(`provenance.status must be one of ${PROVENANCE_STATUSES.join(', ')}`);
  }
  return { status: provenance.status, detail: provenance.detail ?? '', checkedAt: provenance.checkedAt ?? new Date().toISOString(), environment: provenance.environment ?? null };
}

/**
 * Low level: records an artifact for one source version. The caller must state the provenance explicitly.
 * Use `verifyAndBind` (src/provenance.mjs) to compute it from the source image and the artifact bytes.
 */
export function registerArtifact(rootDir, manifest, { versionKey, buffer, tool, toolVersion, provenance }) {
  const version = manifest.versions[versionKey];
  if (!version) throw new Error(`unknown version ${versionKey}`);
  const checked = assertProvenance(provenance);
  const { hash, artifactId, file } = storeArtifactFile(rootDir, buffer);
  version.artifact = {
    artifactId,
    file,
    sha256: hash,
    sizeBytes: buffer.length,
    sourceRevisionId: version.projectRevisionId,
    sourceImageSha256: version.sourceImageSha256,
    provenance: checked,
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
    // A match only means: same bytes in THIS environment. It is not a claim about other Node/OS/tfjs versions.
    environment: { node: process.version, platform: process.platform, arch: process.arch },
  };
  (manifest.reproducibilityChecks ||= []).push(result);
  return result;
}

/** Test-only multi-target artifact (targets compiled in the order of `order`). */
export function registerCombined(rootDir, manifest, { buffer, order, tool, toolVersion, provenance }) {
  const checked = assertProvenance(provenance);
  const { hash, artifactId, file } = storeArtifactFile(rootDir, buffer);
  manifest.combined = {
    artifactId,
    file,
    sha256: hash,
    sizeBytes: buffer.length,
    targets: Object.fromEntries(order.map((k, i) => [k, i])),
    sourceImageSha256: Object.fromEntries(order.map((k) => [k, manifest.versions[k].sourceImageSha256])),
    provenance: checked,
    tool,
    toolVersion,
    registeredAt: new Date().toISOString(),
    testOnly: true,
  };
  return manifest.combined;
}
