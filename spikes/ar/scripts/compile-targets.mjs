// Prepare MindAR target artifacts (.mind) from the synthetic source images in plain Node, then register them in
// fixtures/manifest.json. Each artifact is bound to its source revision only after the source image hash is verified.
//
//   node scripts/compile-targets.mjs             compile A, B and the TEST-ONLY combined A+B artifact if missing
//   node scripts/compile-targets.mjs --verify    also recompile and record a reproducibility check (Q4)
//   node scripts/compile-targets.mjs --force     replace registered artifacts (new ids if bytes changed; resets recorded checks)
//   node scripts/compile-targets.mjs --stats     print feature-point counts of the registered artifacts
//
// Reproducibility is recorded per environment (Node, OS, tfjs backend). A match is not claimed for other toolchains.
// The MindAR browser compile tool remains a cross-check; register its output with scripts/register-artifact.mjs.
import fs from 'node:fs';
import path from 'node:path';
import { loadManifest, saveManifest, checkReproducible } from '../src/manifest.mjs';
import { ROOT, readPng, compileImages, inspectMind, toolVersionString } from '../src/prepare.mjs';
import { verifyAndBind, ProvenanceError } from '../src/provenance.mjs';

const args = new Set(process.argv.slice(2));
const TOOL = 'mind-ar Node compile (scripts/compile-targets.mjs)';
const manifest = loadManifest(ROOT);
const keys = Object.keys(manifest.versions);
const images = (ks) => ks.map((k) => readPng(path.join(ROOT, manifest.versions[k].sourceImage)));

if (args.has('--force')) manifest.reproducibilityChecks = [];

try {
  for (const k of keys) {
    const buffer = await compileImages(images([k]));
    const current = manifest.versions[k].artifact;
    if (current && !args.has('--force')) {
      const r = checkReproducible(manifest, { versionKey: k, buffer });
      console.log(`${k}: registered ${current.artifactId.slice(0, 15)}; recompile ${r.match ? 'MATCH (byte-identical in this environment)' : 'DIFFERS (not byte-identical)'}`);
    } else {
      const art = await verifyAndBind(ROOT, manifest, { versionKey: k, buffer, tool: TOOL, toolVersion: toolVersionString(), producedByThisTool: true });
      console.log(`${k}: registered ${art.artifactId.slice(0, 15)}… (${art.sizeBytes} bytes, provenance ${art.provenance.status})`);
      if (args.has('--verify')) {
        const r = checkReproducible(manifest, { versionKey: k, buffer: await compileImages(images([k])) });
        console.log(`${k}: recompile ${r.match ? 'MATCH (byte-identical in this environment)' : 'DIFFERS (not byte-identical)'}`);
      }
    }
  }

  // TEST-ONLY multi-target artifact (A then B): lets a phone recognize B inside session A so the server refusal is exercised.
  if (!manifest.combined || args.has('--force')) {
    const buffer = await compileImages(images(keys));
    const c = await verifyAndBind(ROOT, manifest, { kind: 'combined', order: keys, buffer, tool: TOOL, toolVersion: toolVersionString(), producedByThisTool: true });
    console.log(`combined (TEST-ONLY): registered ${c.artifactId.slice(0, 15)}… targets=${JSON.stringify(c.targets)} provenance ${c.provenance.status}`);
  }
} catch (err) {
  if (err instanceof ProvenanceError) {
    console.error(`Refused: ${err.message}`);
    process.exit(1);
  }
  throw err;
}

if (args.has('--stats')) {
  for (const k of keys) console.log(`stats ${k}:`, JSON.stringify(inspectMind(fs.readFileSync(path.join(ROOT, manifest.versions[k].artifact.file))).targets));
}
saveManifest(ROOT, manifest);
console.log('manifest updated: fixtures/manifest.json');
