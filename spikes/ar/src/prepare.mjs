// Node-only artifact preparation and inspection. Avoids mind-ar's offline compiler, which needs the native `canvas`
// package (present in node_modules but not compiled when installed with --ignore-scripts, and never loaded here).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PNG } from 'pngjs';
import * as tf from '@tensorflow/tfjs';
import { CompilerBase } from 'mind-ar/src/image-target/compiler-base.js';
import { buildTrackingImageList } from 'mind-ar/src/image-target/image-list.js';
import { extractTrackingFeatures } from 'mind-ar/src/image-target/tracker/extract-utils.js';
import 'mind-ar/src/image-target/detector/kernels/cpu/index.js';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const readJson = (p) => JSON.parse(fs.readFileSync(path.join(ROOT, p), 'utf8'));

export function toolchain() {
  return {
    mindAr: readJson('node_modules/mind-ar/package.json').version,
    tfjs: readJson('node_modules/@tensorflow/tfjs/package.json').version,
    backend: 'cpu',
    node: process.version,
    platform: process.platform,
    arch: process.arch,
  };
}
export const toolVersionString = () => {
  const t = toolchain();
  return `mind-ar@${t.mindAr}, @tensorflow/tfjs@${t.tfjs} (${t.backend} backend)`;
};

class NodeCompiler extends CompilerBase {
  createProcessCanvas(img) {
    return { getContext: () => ({ drawImage() {}, getImageData: () => ({ data: img.data }) }) };
  }
  compileTrack({ targetImages }) {
    return Promise.resolve(targetImages.map((t) => extractTrackingFeatures(buildTrackingImageList(t), () => {})));
  }
}

let ready = false;
async function ensureBackend() {
  if (ready) return;
  await tf.setBackend('cpu');
  await tf.ready();
  ready = true;
}

export function readPng(file) {
  const png = PNG.sync.read(fs.readFileSync(file)); // RGBA
  return { width: png.width, height: png.height, data: png.data };
}

/** Compile one or more decoded images, in order, into one .mind buffer. */
export async function compileImages(images) {
  await ensureBackend();
  const compiler = new NodeCompiler();
  await compiler.compileImageTargets(images, () => {});
  return Buffer.from(compiler.exportData());
}

/** Structural read of a .mind file. The file stores target sizes and features, NOT the source pixels. */
export function inspectMind(buffer) {
  try {
    const list = new NodeCompiler().importData(buffer);
    if (!Array.isArray(list) || list.length === 0) return { valid: false, targets: [] };
    const targets = list.map((d) => ({ width: d.targetImage?.width, height: d.targetImage?.height, points: (d.matchingData ?? []).reduce((n, k) => n + (k.maximaPoints?.length ?? 0) + (k.minimaPoints?.length ?? 0), 0) }));
    return { valid: targets.every((t) => Number.isInteger(t.width) && Number.isInteger(t.height)), targets };
  } catch {
    return { valid: false, targets: [] };
  }
}
