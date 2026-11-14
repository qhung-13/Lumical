import { parseMediaRange, resolveMediaRange } from './media-range';

describe('private media byte ranges', () => {
  it.each([
    ['bytes=0-3', { start: 0, end: 3 }],
    ['Bytes=0-3', { start: 0, end: 3 }],
    ['bytes=4-', { start: 4, end: 9 }],
    ['bytes=-4', { start: 6, end: 9 }],
    ['bytes=8-100', { start: 8, end: 9 }],
    ['bytes=-100', { start: 0, end: 9 }],
    ['bytes=2-9007199254740992', { start: 2, end: 9 }],
    ['bytes=-9007199254740992', { start: 0, end: 9 }],
    ['bytes=0002-0000000000000000000000003', { start: 2, end: 3 }],
    ['bytes=0-0', { start: 0, end: 0 }],
  ])('resolves %s against verified total bytes', (header, expected) => {
    expect(resolveMediaRange(parseMediaRange(header as string)!, 10)).toEqual(
      expected,
    );
  });
  it.each([
    '',
    'bytes=-',
    'bytes=-0',
    'bytes=5-1',
    'bytes=1.5-2',
    'bytes=0-1,3-4',
    'bytes=9007199254740992-',
    'bytes=1e3-',
    'bytes=0-Infinity',
    'bytes=+1-2',
    `bytes=0-${'9'.repeat(256)}`,
  ])('rejects malformed range %s', (header) => {
    expect(() => parseMediaRange(header)).toThrow(RangeError);
  });
  it('ignores an unsupported range unit', () => {
    expect(parseMediaRange('items=0-1')).toBeUndefined();
  });
  it('rejects starts outside the object and unsafe port-level inputs', () => {
    expect(() => resolveMediaRange({ kind: 'OPEN', start: 10 }, 10)).toThrow(
      RangeError,
    );
    expect(() =>
      resolveMediaRange({ kind: 'CLOSED', start: -1, end: 2 }, 10),
    ).toThrow(RangeError);
    expect(() =>
      resolveMediaRange({ kind: 'SUFFIX', length: Infinity }, 10),
    ).toThrow(RangeError);
    expect(parseMediaRange(undefined)).toBeUndefined();
  });
});
