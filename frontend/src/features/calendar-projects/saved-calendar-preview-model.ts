import type { ProjectPreview } from '../../api/projects';

export interface SavedPreviewImage {
  assetId: string;
  altText: string;
  contentPath?: string;
}

export interface SavedPreviewEvent {
  id: string;
  date: string;
  title: string;
  note?: string | null;
}

export interface SavedPreviewMonth {
  monthNumber: number;
  caption: string | null;
  images: SavedPreviewImage[];
}

export interface SavedCalendarPreview {
  projectVersion: number;
  year: number;
  title: string;
  recipientName: string;
  status: 'WORKING' | 'ARCHIVED';
  stylePresetId: string;
  layout: 'PHOTO_FOCUS' | 'COLLAGE';
  months: SavedPreviewMonth[];
  events: SavedPreviewEvent[];
  readiness: ProjectPreview['readiness'];
}

export class PreviewSnapshotError extends Error {
  constructor() { super('Saved preview data does not belong to one Project revision.'); }
}

/** Build a presentation projection only from persisted, versioned API responses. */
export function createSavedCalendarPreview(
  project: { id: string; version: number; year: number; title: string; recipientName: string; status: 'WORKING' | 'ARCHIVED'; stylePresetId: string; baseline: { layout: { type: string } } },
  months: { projectVersion: number; months: SavedPreviewMonth[] },
  specialDates: { projectVersion: number; events: SavedPreviewEvent[] },
  readiness: ProjectPreview['readiness'],
): SavedCalendarPreview {
  if (project.version !== months.projectVersion || project.version !== specialDates.projectVersion ||
      !Number.isSafeInteger(project.version) || project.version < 1 || months.months.length !== 12 ||
      months.months.some((month, index) => month.monthNumber !== index + 1 || month.images.length > 4) ||
      specialDates.events.some(event => !isCivilDateInYear(event.date, project.year)) ||
      (project.baseline.layout.type !== 'PHOTO_FOCUS' && project.baseline.layout.type !== 'COLLAGE')) {
    throw new PreviewSnapshotError();
  }
  return {
    projectVersion: project.version, year: project.year, title: project.title, recipientName: project.recipientName, status: project.status,
    stylePresetId: project.stylePresetId, layout: project.baseline.layout.type,
    months: months.months.map(month => ({ ...month, images: month.images.map(image => ({ ...image })) })),
    events: specialDates.events.map(event => ({ ...event })),
    readiness,
  };
}

export function savedCalendarPreviewFromDto(value: ProjectPreview): SavedCalendarPreview {
  return createSavedCalendarPreview(
    value.project,
    { projectVersion: value.projectVersion, months: value.months },
    { projectVersion: value.projectVersion, events: value.specialDates },
    value.readiness,
  );
}

export function isCivilDateInYear(value: string, year: number): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match || Number(match[1]) !== year) return false;
  const month = Number(match[2]); const day = Number(match[3]);
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  return month >= 1 && month <= 12 && day >= 1 && day <= [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1];
}

