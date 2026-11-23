import { Injectable } from '@nestjs/common';
import { join } from 'node:path';
import { Worker } from 'node:worker_threads';
import {
  InvalidTarget,
  MAX_TARGET_BYTES,
  TargetCompiler,
} from '../application/target-compiler';

export const MINDAR_COMPILER = 'mind-ar@1.2.5/tfjs@4.22.0/cpu/sharp@0.35.5';
export const SOURCE_TRANSFORM =
  'primary-month-image/auto-orient/fit-1024/white-srgb/v1';

@Injectable()
export class MindARTargetCompiler extends TargetCompiler {
  async compile(source: Uint8Array, signal: AbortSignal) {
    signal.throwIfAborted();
    const worker = new Worker(join(__dirname, 'mindar-thread.mjs'), {
      workerData: source,
      resourceLimits: { maxOldGenerationSizeMb: 256 },
    });
    const result = await new Promise<{
      bytes: Uint8Array;
      pixelDigest: string;
    }>((resolve, reject) => {
      const abort = () => reject(new Error('Target preparation interrupted.'));
      signal.addEventListener('abort', abort, { once: true });
      worker.once('error', reject);
      worker.once('exit', () => reject(new Error('Target compiler exited.')));
      worker.once(
        'message',
        (message: { bytes: Uint8Array; pixelDigest: string } | null) => {
          if (
            !message ||
            !(message.bytes instanceof Uint8Array) ||
            !message.bytes.length ||
            message.bytes.length > MAX_TARGET_BYTES ||
            !/^[a-f0-9]{64}$/.test(message.pixelDigest)
          )
            reject(new InvalidTarget());
          else resolve(message);
        },
      );
      worker.once('exit', () => signal.removeEventListener('abort', abort));
      if (signal.aborted) abort();
    }).finally(() => worker.terminate());
    signal.throwIfAborted();
    return result;
  }
}
