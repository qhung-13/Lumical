import { createHash } from 'node:crypto';
import { parentPort, workerData } from 'node:worker_threads';
import sharp from 'sharp';
import * as tf from '@tensorflow/tfjs';
// MindAR (MIT), TF.js (Apache-2.0), and Sharp (Apache-2.0) run locally.
// Preserve their distributed license notices. This adapter uses the CPU
// image-target compiler internals, so compiler upgrades require a fixture retest.
// @ts-expect-error MindAR does not publish types for its compiler internals.
import { CompilerBase } from 'mind-ar/src/image-target/compiler-base.js';
// @ts-expect-error MindAR does not publish types for its compiler internals.
import { buildTrackingImageList } from 'mind-ar/src/image-target/image-list.js';
// @ts-expect-error MindAR does not publish types for its compiler internals.
import { extractTrackingFeatures } from 'mind-ar/src/image-target/tracker/extract-utils.js';
import 'mind-ar/src/image-target/detector/kernels/cpu/index.js';

type Image = { width: number; height: number; data: Uint8Array };

const BaseCompiler = CompilerBase as new () => {
  compileImageTargets(images: Image[], progress: () => void): Promise<void>;
  exportData(): Uint8Array;
  importData(bytes: Uint8Array): unknown;
};

class NodeCompiler extends BaseCompiler {
  createProcessCanvas(image: Image) {
    return {
      getContext: () => ({
        drawImage() {},
        getImageData: () => ({ data: image.data }),
      }),
    };
  }

  async compileTrack({ targetImages }: { targetImages: Image[] }) {
    await Promise.resolve();
    return targetImages.map((image) =>
      extractTrackingFeatures(buildTrackingImageList(image), () => {}),
    );
  }
}

async function compile(source: Uint8Array) {
  const decoded = await sharp(source, { limitInputPixels: 40_000_000 })
    .autoOrient()
    .resize(1024, 1024, { fit: 'inside', withoutEnlargement: true })
    .flatten({ background: '#ffffff' })
    .toColourspace('srgb')
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })
    .catch(() => null);
  if (!decoded) return null;
  const { width, height } = decoded.info;
  if (width < 64 || height < 64) return null;

  await tf.setBackend('cpu');
  await tf.ready();
  const compiler = new NodeCompiler();
  await compiler.compileImageTargets(
    [{ width, height, data: decoded.data }],
    () => {},
  );
  const bytes = new Uint8Array(compiler.exportData());
  const targets = new NodeCompiler().importData(bytes);
  if (!Array.isArray(targets) || targets.length !== 1) return null;
  const [target] = targets as Array<{
    targetImage: { width: number; height: number };
    matchingData: Array<{ maximaPoints: unknown[]; minimaPoints: unknown[] }>;
    trackingData: Array<{ points: unknown[] }>;
  }>;
  if (
    target.targetImage.width !== width ||
    target.targetImage.height !== height ||
    !target.matchingData.some(
      (level) => level.maximaPoints.length + level.minimaPoints.length > 0,
    ) ||
    !target.trackingData.some((level) => level.points.length > 0)
  )
    return null;
  const pixelDigest = createHash('sha256')
    .update(`${width}x${height}:`)
    .update(decoded.data)
    .digest('hex');
  return { bytes, pixelDigest };
}

parentPort?.postMessage(await compile(workerData as Uint8Array));
