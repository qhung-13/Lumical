import { ProjectError, projectText } from './project';
import type { MediaCategory, MediaReadiness } from '../../media/domain/media';

const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;

export interface MonthImage {
  assetId: string;
  altText: string;
  crop: null;
}

export interface MonthPatch {
  caption: string | null;
  images: MonthImage[];
}

export interface EventWrite {
  date: string;
  title: string;
  note: string | null;
}

export interface ARWrite {
  monthNumber: number;
  revealAssetId: string;
  readableText: string;
}

function fields(
  input: unknown,
  allowed: readonly string[],
): Record<string, unknown> {
  if (
    !input ||
    typeof input !== 'object' ||
    Array.isArray(input) ||
    Object.keys(input).some((key) => !allowed.includes(key))
  )
    throw new ProjectError('VALIDATION_FAILED');
  return input as Record<string, unknown>;
}

function mediaId(value: unknown, field: 'images' | 'revealAssetId'): string {
  if (typeof value !== 'string' || !uuid.test(value))
    throw new ProjectError('VALIDATION_FAILED', field);
  return value.toLowerCase();
}

export function monthNumber(input: unknown): number {
  if (
    typeof input !== 'number' ||
    !Number.isInteger(input) ||
    input < 1 ||
    input > 12
  )
    throw new ProjectError('VALIDATION_FAILED', 'monthNumber');
  return input;
}

export function monthPatch(input: unknown): MonthPatch {
  const value = fields(input, ['caption', 'images']);
  if (!Array.isArray(value.images) || value.images.length > 4)
    throw new ProjectError('VALIDATION_FAILED', 'images');

  return {
    caption: optionalText(value.caption, 'caption'),
    images: value.images.map((input: unknown) => {
      const image = fields(input, ['assetId', 'altText', 'crop']);
      // The approved contract names crop, but defines no non-null schema.
      if (image.crop !== undefined && image.crop !== null)
        throw new ProjectError('VALIDATION_FAILED', 'images');
      return {
        assetId: mediaId(image.assetId, 'images'),
        altText: projectText(image.altText, 'images', { allowBlank: true }),
        crop: null,
      };
    }),
  };
}

function optionalText(
  value: unknown,
  field: 'caption' | 'note',
): string | null {
  if (value === undefined || value === null) return null;
  return (
    projectText(value, field, { allowBlank: true, maxLength: 300 }) || null
  );
}

export function eventWrite(input: unknown): EventWrite {
  const value = fields(input, ['date', 'title', 'note']);
  const { date } = value;
  const parts =
    typeof date === 'string' && date.length === 10
      ? /^(\d{4})-(\d{2})-(\d{2})$/.exec(date)
      : null;
  if (!parts || typeof date !== 'string')
    throw new ProjectError('VALIDATION_FAILED', 'date');
  const year = Number(parts[1]);
  const month = Number(parts[2]);
  const day = Number(parts[3]);
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  if (
    year < 1 ||
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > days[month - 1]
  )
    throw new ProjectError('VALIDATION_FAILED', 'date');

  return {
    date,
    title: projectText(value.title, 'title', { maxLength: 80 }),
    note: optionalText(value.note, 'note'),
  };
}

export function assertEventYear(event: EventWrite, projectYear: number): void {
  if (Number(event.date.slice(0, 4)) !== projectYear)
    throw new ProjectError('VALIDATION_FAILED', 'date');
}

export function arWrite(input: unknown): ARWrite {
  const value = fields(input, ['monthNumber', 'revealAssetId', 'readableText']);
  return {
    monthNumber: monthNumber(value.monthNumber),
    revealAssetId: mediaId(value.revealAssetId, 'revealAssetId'),
    readableText: projectText(value.readableText, 'readableText'),
  };
}

export function assertAttachable(
  media: { category: MediaCategory; status: MediaReadiness } | undefined,
  allowed: readonly MediaCategory[],
): void {
  if (!media) throw new ProjectError('NOT_FOUND');
  if (media.status !== 'READY') throw new ProjectError('MEDIA_UNAVAILABLE');
  if (!allowed.includes(media.category)) throw new ProjectError('CONFLICT');
}
