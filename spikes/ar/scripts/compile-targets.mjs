// Prepare MindAR target artifacts (.mind) from the synthetic source images in plain Node, then register them
// in fixtures/manifest.json. Avoids mind-ar's offline compiler because that needs the native `canvas` package.
//
//   node scripts/compile-targets.mjs             compile A, B and the TEST-ONLY combined A+B artifact if missing
//   node scripts/compile-targets.mjs --verify    also recompile everything and record a reproducibility check (Q4)
//   node scripts/compile-targets.mjs --force     replace registered artifacts even if bytes are unchanged
//   node scripts/compile-targets.mjs --stats     print feature-point counts of the registered artifacts
//
// The MindAR browser compile tool remains a valid cross-check; register its output with scripts/register-artifact.mjs.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PNG } from 'pngjs';
import * as tf from '@tensorflow/tfjs';
import { CompilerBase } from 'mind-ar/src/image-target/compiler-base.js';
import { buildTrackingImageList } from 'mind-ar/src/image-target/image-list.js';
import { extractTrackingFeatures } from 'mind-ar/src/image-target/tracker/extract-utils.js';
import 'mind-ar/src/image-target/detector/kernels/cpu/index.js';
import { loadManifest, saveManifest, registerArtifact, registerCombined, checkReproducible, sha256 } from '../src/manifest.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = new Set(process.argv.slice(2));
const readJson = (p) => JSON.parse(fs.readFileSync(path.join(ROOT, p), 'utf8'));
const mindarVersion = readJson('node_modules/mind-ar/package.json').version;
const tfVersion = readJson('node_modules/@tensorflow/tfjs/package.json').version;
const TOOL = 'mind-ar Node compile (scripts/compile-targets.mjs)';
const TOOL_VERSION = `mind-ar@${mindarVersion}, @tensorflow/tfjs@${tfVersion} (cpu backend)`;

class NodeCompiler extends CompilerBase {
  createProcessCanvas(img) {
    return { getContext: () => ({ drawImage() {}, getImageData: () => ({ data: img.data }) }) };
  }
  compileTrack({ targetImages }) {
    return Promise.resolve(targetImages.map((t) => extractTrackingFeatures(buildTrackingImageList(t), () => {})));
  }
}

const decode = (file) => {
  const png = PNG.sync.read(fs.readFileSync(path.join(ROOT, file))); // RGBA
  return { width: png.width, height: png.height, data: png.data };
};

async function compile(files) {
  const compiler = new NodeCompiler();
  await compiler.compileImageTargets(files.map(decode), () => {});
  return Buffer.from(compiler.exportData());
}

function stats(buffer) {
  const c = new NodeCompiler();
  const list = c.importData(buffer);
  return list.map((d, i) => ({
    target: i,
    size: `${d.targetImage.width}x${d.targetImage.height}`,
    trackingScales: d.trackingData?.length ?? 0,
    matchingKeyframes: d.matchingData?.length ?? 0,
    matchingPoints: (d.matchingData ?? []).reduce((n, k) => n + (k.maximaPoints?.length ?? 0) + (k.minimaPoints?.length ?? 0), 0),
  }));
}

await tf.setBackend('cpu');
await tf.ready();
const manifest = loadManifest(ROOT);
const keys = Object.keys(manifest.versions);
const sourceOf = (k) => manifest.versions[k].sourceImage;

// Refuse to bind an artifact to a source image that no longer matches the manifest hash.
for (const k of keys) {
  const actual = sha256(fs.readFileSync(path.join(ROOT, sourceOf(k))));
  if (actual !== manifest.versions[k].sourceImageSha256) {
    console.error(`Source image for ${k} does not match the manifest hash. Run npm run gen:fixtures first.`);
    process.exit(1);
  }
}

for (const k of keys) {
  const buffer = await compile([sourceOf(k)]);
  const current = manifest.versions[k].artifact;
  if (current && !args.has('--force')) {
    const r = checkReproducible(manifest, { versionKey: k, buffer });
    console.log(`${k}: registered ${current.artifactId}; recompile ${r.match ? 'MATCH (byte-identical)' : 'DIFFERS (not byte-identical)'}`);
    if (args.has('--verify')) {
      const again = checkReproducible(manifest, { versionKey: k, buffer: await compile([sourceOf(k)]) });
      console.log(`${k}: second recompile ${again.match ? 'MATCH' : 'DIFFERS'}`);
    }
  } else {
    const art = registerArtifact(ROOT, manifest, { versionKey: k, buffer, tool: TOOL, toolVersion: TOOL_VERSION });
    console.log(`${k}: registered ${art.artifactId} (${art.sizeBytes} bytes)`);
    if (args.has('--verify')) {
      const r = checkReproducible(manifest, { versionKey: k, buffer: await compile([sourceOf(k)]) });
      console.log(`${k}: recompile ${r.match ? 'MATCH (byte-identical)' : 'DIFFERS (not byte-identical)'}`);
    }
  }
}

// TEST-ONLY multi-target artifact (A then B): lets a phone recognize B inside session A so the server refusal is exercised.
if (!manifest.combined || args.has('--force')) {
  const buffer = await compile(keys.map(sourceOf));
  const c = registerCombined(ROOT, manifest, { buffer, order: keys, tool: TOOL, toolVersion: TOOL_VERSION });
  console.log(`combined (TEST-ONLY): registered ${c.artifactId} targets=${JSON.stringify(c.targets)}`);
}

if (args.has('--stats')) {
  for (const k of keys) console.log(`stats ${k}:`, JSON.stringify(stats(fs.readFileSync(path.join(ROOT, manifest.versions[k].artifact.file)))));
}
saveManifest(ROOT, manifest);
console.log('manifest updated: fixtures/manifest.json');
