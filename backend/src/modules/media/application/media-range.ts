import type { ByteRange } from './media-storage';

/** One byte range only. Reject unsafe integers before they can reach provider headers. */
export function parseMediaRange(
  header: string | undefined,
): ByteRange | undefined {
  if (header === undefined) return undefined;
  const match = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
  if (!match || (!match[1] && !match[2])) throw new RangeError();
  const number = (value: string) => {
    const result = Number(value);
    if (!Number.isSafeInteger(result) || result < 0) throw new RangeError();
    return result;
  };
  if (!match[1]) {
    const length = number(match[2]);
    if (length === 0) throw new RangeError();
    return { kind: 'SUFFIX', length };
  }
  const start = number(match[1]);
  if (!match[2]) return { kind: 'OPEN', start };
  const end = number(match[2]);
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
