import type { MonthPatch, ProjectMonths } from '../../api/projects';

export type MonthImageDraft = MonthPatch['images'][number];
export interface MonthContentDraft { caption: string; images: MonthImageDraft[] }

export function countVisibleCharacters(value: string): number {
  const normalized = value.trim().normalize('NFC');
  return Array.from(new Intl.Segmenter('und', { granularity: 'grapheme' }).segment(normalized)).length;
}

export function monthContentDraft(month: ProjectMonths['months'][number]): MonthContentDraft {
  return { caption: month.caption ?? '', images: month.images.map(image => ({ ...image, crop: null })) };
}

export function sameMonthContent(left: MonthContentDraft, right: MonthContentDraft): boolean {
  return left.caption.trim().normalize('NFC') === right.caption.trim().normalize('NFC') &&
    left.images.length === right.images.length && left.images.every((image, index) => {
      const other = right.images[index];
      return image.assetId === other.assetId && image.altText === other.altText && image.crop === other.crop;
    });
}
