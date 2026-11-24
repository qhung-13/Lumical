export const MAX_TARGET_BYTES = 8 * 1024 * 1024;

export class InvalidTarget extends Error {}

export abstract class TargetCompiler {
  abstract compile(
    source: Uint8Array,
    signal: AbortSignal,
  ): Promise<{
    bytes: Uint8Array;
    pixelDigest: string;
  }>;
}
