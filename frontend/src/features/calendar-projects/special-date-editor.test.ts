import { describe, expect, it } from 'vitest';
import { emptySpecialDateDraft, formatCivilDate, isGregorianCivilDate, specialDateForMonth, specialDateWrite, validateSpecialDate } from './special-date-editor';

describe('Special Date civil-date policy', () => {
  it.each([
    ['2024-02-29', true], ['2000-02-29', true], ['1900-02-29', false], ['2023-02-29', false],
    ['2024-02-30', false], ['2024-04-31', false], ['0000-01-01', false], ['2024-2-01', false],
  ])('validates %s without timezone conversion', (date, valid) => {
    expect(isGregorianCivilDate(date)).toBe(valid);
  });

  it('requires the Project year and validates visible title/note grapheme limits', () => {
    const draft = { ...emptySpecialDateDraft(), date: '2024-02-29', title: 'Birthday', note: '' };
    expect(validateSpecialDate(draft, 2024)).toEqual({});
    expect(validateSpecialDate(draft, 2025)).toEqual({ date: 'WRONG_YEAR' });
    expect(validateSpecialDate({ ...draft, date: '2024-02-30' }, 2024)).toEqual({ date: 'INVALID_DATE' });
    expect(validateSpecialDate({ ...draft, title: ' 👩🏽‍💻 '.repeat(81) }, 2024).title).toBe('TOO_LONG');
    expect(validateSpecialDate({ ...draft, title: '   ' }, 2024).title).toBe('REQUIRED');
    expect(validateSpecialDate({ ...draft, note: '👨‍👩‍👧‍👦'.repeat(301) }, 2024).note).toBe('TOO_LONG');
  });

  it('normalizes text but preserves the civil date string and groups month by string', () => {
    const draft = { ...emptySpecialDateDraft(), date: '2024-02-29', title: ' Cafe\u0301 ', note: '  Family  ' };
    expect(specialDateWrite(draft)).toEqual({ date: '2024-02-29', title: 'Café', note: 'Family' });
    expect(specialDateForMonth('2024-02-29', 2024, 2)).toBe(true);
    expect(specialDateForMonth('2024-02-29', 2024, 3)).toBe(false);
    expect(formatCivilDate('2024-02-29', 'en')).toContain('February 29, 2024');
  });
});
