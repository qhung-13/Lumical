// Generates deterministic synthetic target images + the fixture manifest. Preserves registered artifacts.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderPng } from '../src/synth-image.mjs';
import { sha256, loadManifest, saveManifest, manifestPath } from '../src/manifest.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SPECS = [
  { key: 'A', file: 'fixtures/targets/version-a.png', seed: 1001, revision: 'synthetic-revision-A' },
  { key: 'B', file: 'fixtures/targets/version-b.png', seed: 2002, revision: 'synthetic-revision-B' },
];
const UNKNOWN = { file: 'fixtures/targets/unknown.png', seed: 9009 };

fs.mkdirSync(path.join(ROOT, 'fixtures/targets'), { recursive: true });
const previous = fs.existsSync(manifestPath(ROOT)) ? loadManifest(ROOT) : { versions: {} };
const manifest = { note: 'Synthetic fixtures only. Source image hashes bind each prepared artifact to its version.', versions: {}, combined: previous.combined ?? null, reproducibilityChecks: previous.reproducibilityChecks ?? [] };

for (const s of SPECS) {
  const { png, pixelSha256 } = renderPng({ seed: s.seed });
  fs.writeFileSync(path.join(ROOT, s.file), png);
  manifest.versions[s.key] = {
    projectRevisionId: s.revision,
    sourceImage: s.file,
    seed: s.seed,
    sourceImageSha256: sha256(png),
    pixelSha256,
    artifact: previous.versions[s.key]?.artifact ?? null,
  };
  console.log(`${s.file}  sha256=${sha256(png).slice(0, 16)}…`);
}
const unknown = renderPng({ seed: UNKNOWN.seed });
fs.writeFileSync(path.join(ROOT, UNKNOWN.file), unknown.png);
console.log(`${UNKNOWN.file}  (wrong-target control, never registered)`);
saveManifest(ROOT, manifest);
