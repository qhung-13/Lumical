import type { ByteRange } from './media-storage';

const MAX_RANGE_HEADER_LENGTH = 256;
const MAX_BYTE_POSITION = BigInt(Number.MAX_SAFE_INTEGER);

/** Parse one byte range before resolving it against the verified object size. */
export function parseMediaRange(
  header: string | undefined,
): ByteRange | undefined {
  if (header === undefined) return undefined;
  const value = header.trim();
  const unit = /^([!#$%&'*+.^_`|~0-9A-Za-z-]+)=/.exec(value)?.[1];
  if (unit && unit.toLowerCase() !== 'bytes') return undefined;
  if (header.length > MAX_RANGE_HEADER_LENGTH) throw new RangeError();
  const match = /^bytes=(\d*)-(\d*)$/i.exec(value);
  if (!match || (!match[1] && !match[2])) throw new RangeError();
  // Verified lengths are safe integers. Larger ends and suffixes always clamp.
  const clamp = (value: bigint) =>
    Number(value > MAX_BYTE_POSITION ? MAX_BYTE_POSITION : value);
  if (!match[1]) {
    const length = clamp(BigInt(match[2]));
    if (length === 0) throw new RangeError();
    return { kind: 'SUFFIX', length };
  }
  const first = BigInt(match[1]);
  if (first > MAX_BYTE_POSITION) throw new RangeError();
  const start = Number(first);
  if (!match[2]) return { kind: 'OPEN', start };
  const end = clamp(BigInt(match[2]));
  if (end < start) throw new RangeError();
  return { kind: 'CLOSED', start, end };
}

export function resolveMediaRange(
  range: ByteRange,
  total: number,
): { start: number; end: number } {
  if (!Number.isSafeInteger(total) || total <= 0) throw new RangeError();
  const valid = (value: number) => Number.isSafeInteger(value) && value >= 0;
  if (range.kind === 'SUFFIX') {
    if (!valid(range.length) || range.length === 0) throw new RangeError();
    return { start: Math.max(0, total - range.length), end: total - 1 };
  }
  if (!valid(range.start) || range.start >= total) throw new RangeError();
  if (range.kind === 'OPEN') return { start: range.start, end: total - 1 };
  if (!valid(range.end) || range.end < range.start) throw new RangeError();
  return { start: range.start, end: Math.min(range.end, total - 1) };
}
