// Binds an artifact to a source revision only after the evidence is checked, and records how strong that evidence is.
//
//   1. the source image file must still match the hash recorded in the manifest (else the revision binding is meaningless)
//   2. the .mind file must parse, have the expected number of targets, and the target sizes must equal the source sizes
//   3. provenance status:
//        built-from-verified-source  produced by this tool in this process from the verified source (no second compile)
//        verified-recompile          an external file whose bytes equal a fresh Node recompile of the verified source
//        manual-unverified           structure fits, but the bytes do not match a recompile (e.g. browser compile tool,
//                                    another tool version): NOT proven to come from this image
//
// A .mind file does not contain the source pixels, so a pixel comparison with the source image is impossible; a byte
// comparison with a recompile is only meaningful in the recorded spike toolchain (see environment on each record).
import fs from 'node:fs';
import path from 'node:path';
import { sha256, registerArtifact, registerCombined } from './manifest.mjs';
import { readPng, compileImages, inspectMind, toolchain, toolVersionString } from './prepare.mjs';

export class ProvenanceError extends Error {}

function sourcesFor(rootDir, manifest, keys) {
  return keys.map((k) => {
    const version = manifest.versions[k];
    if (!version) throw new ProvenanceError(`unknown version ${k}`);
    const file = path.join(rootDir, version.sourceImage);
    if (!fs.existsSync(file)) throw new ProvenanceError(`source image for ${k} is missing: ${version.sourceImage}`);
    if (sha256(fs.readFileSync(file)) !== version.sourceImageSha256) {
      throw new ProvenanceError(`source image for ${k} does not match the manifest hash; refusing to bind an artifact to it`);
    }
    return { key: k, image: readPng(file) };
  });
}

export async function verifyAndBind(rootDir, manifest, { kind = 'version', versionKey, order, buffer, tool, toolVersion, producedByThisTool = false, requireVerified = false }) {
  const keys = kind === 'combined' ? order : [versionKey];
  const sources = sourcesFor(rootDir, manifest, keys);

  const info = inspectMind(buffer);
  if (!info.valid) throw new ProvenanceError('not a valid MindAR .mind file');
  if (info.targets.length !== keys.length) {
    throw new ProvenanceError(`expected ${keys.length} target(s) for ${keys.join('+')}, the file has ${info.targets.length}`);
  }
  sources.forEach((s, i) => {
    const t = info.targets[i];
    if (t.width !== s.image.width || t.height !== s.image.height) {
      throw new ProvenanceError(`target ${i} is ${t.width}x${t.height} but source ${s.key} is ${s.image.width}x${s.image.height}`);
    }
  });

  let status;
  let detail;
  if (producedByThisTool) {
    status = 'built-from-verified-source';
    detail = 'compiled by this tool from the source image whose hash matched the manifest';
  } else {
    const again = await compileImages(sources.map((s) => s.image));
    if (sha256(again) === sha256(buffer)) {
      status = 'verified-recompile';
      detail = 'bytes equal a fresh Node recompile of the verified source image';
    } else {
      status = 'manual-unverified';
      detail = 'structure and target sizes fit the source, but the bytes differ from a Node recompile (different tool, version or settings); content is not proven to come from this image';
    }
  }
  if (requireVerified && status === 'manual-unverified') throw new ProvenanceError(`artifact is ${status} and --require-verified was given`);

  const provenance = { status, detail, checkedAt: new Date().toISOString(), environment: toolchain() };
  const meta = { buffer, tool, toolVersion: toolVersion ?? toolVersionString(), provenance };
  return kind === 'combined' ? registerCombined(rootDir, manifest, { ...meta, order }) : registerArtifact(rootDir, manifest, { ...meta, versionKey });
}
