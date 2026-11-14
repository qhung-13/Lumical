import {
  arWrite,
  assertAttachable,
  assertEventYear,
  eventWrite,
  monthNumber,
  monthPatch,
} from './personalization';

const assetId = 'b4801d89-b4e0-46da-bd20-bb82c49af072';
const image = { assetId, altText: 'A photo', crop: null };
const glyph = '👩🏽‍💻';

describe('Month replacement policy', () => {
  it.each([1, 12])('allows Month %i', (number) =>
    expect(monthNumber(number)).toBe(number),
  );
  it.each([0, 13, 1.5, '1'])('rejects Month %p', (number) =>
    expect(() => monthNumber(number)).toThrow('VALIDATION_FAILED'),
  );
  it.each([0, 1, 4])('accepts %i images', (count) => {
    const images = Array.from({ length: count }, () => image);
    expect(monthPatch({ images })).toEqual({ images, caption: null });
  });
  it('rejects a fifth image', () => {
    expect(() => monthPatch({ images: Array(5).fill(image) })).toThrow(
      'VALIDATION_FAILED',
    );
  });
  it('allows an empty caption and counts 300 multi-code-point graphemes', () => {
    expect(monthPatch({ caption: '  ', images: [] }).caption).toBeNull();
    expect(monthPatch({ caption: glyph.repeat(300), images: [] }).caption).toBe(
      glyph.repeat(300),
    );
    expect(() =>
      monthPatch({ caption: glyph.repeat(301), images: [] }),
    ).toThrow('VALIDATION_FAILED');
  });
  it('validates alt text and rejects undeclared transformations', () => {
    expect(
      monthPatch({ images: [{ assetId, altText: '  ' }] }).images[0].altText,
    ).toBe('');
    expect(() => monthPatch({ images: [{ ...image, altText: 4 }] })).toThrow(
      'VALIDATION_FAILED',
    );
    expect(() =>
      monthPatch({ images: [{ ...image, crop: { angle: 90 } }] }),
    ).toThrow('VALIDATION_FAILED');
  });
  it('rejects unready, unknown and wrong-category media', () => {
    expect(() => assertAttachable(undefined, ['IMAGE'])).toThrow('NOT_FOUND');
    expect(() =>
      assertAttachable({ category: 'IMAGE', status: 'PENDING' }, ['IMAGE']),
    ).toThrow('MEDIA_UNAVAILABLE');
    expect(() =>
      assertAttachable({ category: 'IMAGE', status: 'UNAVAILABLE' }, ['IMAGE']),
    ).toThrow('MEDIA_UNAVAILABLE');
    expect(() =>
      assertAttachable({ category: 'VIDEO', status: 'READY' }, ['IMAGE']),
    ).toThrow('CONFLICT');
  });
});

describe('Special Date policy', () => {
  it.each(['2000-02-29', '2028-02-29', '2028-12-31', '0001-01-01'])(
    'keeps civil date %s',
    (date) => {
      expect(
        eventWrite({ date, title: ' Test ' }),
      ).toEqual({ date, title: 'Test', note: null });
    },
  );
  it.each([
    '1900-02-29',
    '2027-02-29',
    '2028-04-31',
    '2028-01-00',
    '2028-13-01',
    '2028-1-01',
    '2028-01-01T00:00:00Z',
    '2028-01-01\n',
  ])('rejects %p', (date) => {
    expect(() =>
      eventWrite({ date, title: 'Test' }),
    ).toThrow('VALIDATION_FAILED');
  });
  it('accepts distinct events on one Project date and rejects dates outside that year', () => {
    const date = '2028-02-29';
    expect(
      ['First', 'Second'].map((title) => eventWrite({ date, title })),
    ).toEqual([
      { date, title: 'First', note: null },
      { date, title: 'Second', note: null },
    ]);
    expect(() => assertEventYear(eventWrite({ date, title: 'Test' }), 2027)).toThrow(
      'VALIDATION_FAILED',
    );
  });
  it('trims and normalizes title/note and accepts their grapheme boundaries', () => {
    const date = '2028-02-29';
    expect(
      eventWrite({ date, title: ' e\u0301 ', note: ' test ' }),
    ).toEqual({ date, title: 'é', note: 'test' });
    expect(
      eventWrite({ date, title: glyph.repeat(80), note: glyph.repeat(300) }).note,
    ).toBe(glyph.repeat(300));
    for (const title of ['', ' \u200b ', '\u0000', '\ud800', glyph.repeat(81)])
      expect(() => eventWrite({ date, title })).toThrow(
        'VALIDATION_FAILED',
      );
    expect(() =>
      eventWrite({ date, title: 'Test', note: glyph.repeat(301) }),
    ).toThrow('VALIDATION_FAILED');
  });
});

describe('AR write policy', () => {
  it.each(['IMAGE', 'VIDEO', 'AUDIO'] as const)(
    'allows one Ready %s reveal',
    (category) => {
      expect(() =>
        assertAttachable({ category, status: 'READY' }, [
          'IMAGE',
          'VIDEO',
          'AUDIO',
        ]),
      ).not.toThrow();
      expect(
        arWrite({
          monthNumber: 12,
          revealAssetId: assetId,
          readableText: ' A message ',
        }),
      ).toEqual({
        monthNumber: 12,
        revealAssetId: assetId,
        readableText: 'A message',
      });
    },
  );
  it.each([undefined, '', '\u200b', '\ud800', 3])(
    'rejects invalid readable text %p',
    (readableText) => {
      expect(() =>
        arWrite({ monthNumber: 1, revealAssetId: assetId, readableText }),
      ).toThrow('VALIDATION_FAILED');
    },
  );
});
