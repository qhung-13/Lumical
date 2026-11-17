import { describe, expect, it } from 'vitest';
import { countVisibleCharacters, monthContentDraft, sameMonthContent } from './month-editor';

describe('Month content draft helpers', () => {
  it('counts normalized visible grapheme clusters rather than UTF-16 units', () => {
    expect(countVisibleCharacters('e\u0301')).toBe(1);
    expect(countVisibleCharacters('👨‍👩‍👧‍👦'.repeat(300))).toBe(300);
  });

  it('copies persisted Month content into a draft with the approved default crop', () => {
    expect(monthContentDraft({ monthNumber: 1, caption: null,
      images: [{ assetId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', altText: 'Family', crop: null }] }))
      .toEqual({ caption: '', images: [{ assetId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', altText: 'Family', crop: null }] });
  });

  it('compares captions after contract normalization and respects image order', () => {
    const first = { caption: ' memory ', images: [{ assetId: 'a', altText: 'Photo', crop: null }] };
    expect(sameMonthContent(first, { caption: 'memory', images: first.images })).toBe(true);
    expect(sameMonthContent(first, { caption: 'memory', images: [] })).toBe(false);
  });
});
