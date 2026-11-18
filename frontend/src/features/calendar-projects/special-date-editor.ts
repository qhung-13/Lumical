import type { SpecialDateWrite } from '../../api/projects';
import { countVisibleCharacters } from './month-editor';

export interface SpecialDateDraft {
  date: string;
  title: string;
  note: string;
}

export interface SpecialDateFieldErrors {
  date?: 'INVALID_DATE' | 'WRONG_YEAR';
  title?: 'REQUIRED' | 'TOO_LONG';
  note?: 'TOO_LONG';
}

export const emptySpecialDateDraft = (): SpecialDateDraft => ({ date: '', title: '', note: '' });

export function isGregorianCivilDate(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (year < 1 || month < 1 || month > 12 || day < 1) return false;
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return day <= days[month - 1];
}

export function validateSpecialDate(draft: SpecialDateDraft, projectYear: number): SpecialDateFieldErrors {
  const errors: SpecialDateFieldErrors = {};
  if (!isGregorianCivilDate(draft.date)) errors.date = 'INVALID_DATE';
  else if (Number(draft.date.slice(0, 4)) !== projectYear) errors.date = 'WRONG_YEAR';

  const titleLength = countVisibleCharacters(draft.title);
  if (titleLength === 0) errors.title = 'REQUIRED';
  else if (titleLength > 80) errors.title = 'TOO_LONG';
  if (countVisibleCharacters(draft.note) > 300) errors.note = 'TOO_LONG';
  return errors;
}

export function specialDateWrite(draft: SpecialDateDraft): SpecialDateWrite {
  const title = draft.title.trim().normalize('NFC');
  const note = draft.note.trim().normalize('NFC');
  return { date: draft.date, title, note: note || null };
}

export function specialDateForMonth(date: string, year: number, monthNumber: number): boolean {
  return date.startsWith(`${String(year).padStart(4, '0')}-${String(monthNumber).padStart(2, '0')}-`);
}

export function formatCivilDate(date: string, locale: 'vi' | 'en'): string {
  const [year, month, day] = date.split('-').map(Number);
  const value = new Date(0);
  value.setUTCHours(0, 0, 0, 0);
  value.setUTCFullYear(year, month - 1, day);
  return new Intl.DateTimeFormat(locale === 'vi' ? 'vi-VN' : 'en-US', {
    year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC',
  }).format(value);
}
