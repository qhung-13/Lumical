import {
  ApiProperty,
  ApiPropertyOptional,
  type ApiPropertyOptions,
} from '@nestjs/swagger';
import { MonthImageDto } from './personalization-dto';
import type { ProjectMonthRecord } from '../application/project-repository';
import { PROJECT_STATUSES, type ProjectView } from '../domain/project';
import type { ProjectDetailView, ProjectPreviewView } from '../application/project-owner';
import type { PublicPreviewIssue } from '../domain/public-preview-readiness';

const titleSchema: ApiPropertyOptions = {
  type: 'string',
  minLength: 1,
  maxLength: 80,
  description: 'Trimmed, NFC-normalised, counted in graphemes by the backend.',
};

const recipientSchema: ApiPropertyOptions = {
  ...titleSchema,
  description: 'Who the calendar is for.',
};

const presetSchema: ApiPropertyOptions = {
  type: 'string',
  minLength: 1,
  maxLength: 64,
  description: 'Must be a preset approved by the captured template revision.',
};

// The frozen layout P02 captured from the approved revision.
export class ProjectLayoutDto {
  @ApiProperty({ type: Number, enum: [1] }) version: 1;
  @ApiProperty({ type: String, enum: ['PHOTO_FOCUS', 'COLLAGE'] })
  type: 'PHOTO_FOCUS' | 'COLLAGE';
  @ApiProperty({ type: Number, enum: [12] }) monthCount: 12;
  @ApiProperty({ type: Number, enum: [4] }) maxImagesPerMonth: 4;
}

export class LocalisedDto {
  @ApiProperty({ type: String }) vi: string;
  @ApiProperty({ type: String }) en: string;
}

// Template baseline captured at creation; no edit ever rewrites it.
export class ProjectBaselineDto {
  @ApiProperty({ type: LocalisedDto, description: 'Template name at capture time.' })
  name: LocalisedDto;
  @ApiProperty({ type: ProjectLayoutDto }) layout: ProjectLayoutDto;
}

export class ProjectCreateDto {
  @ApiProperty({ type: String, format: 'uuid' })
  templateId: string;
  @ApiProperty(titleSchema)
  title: string;
  @ApiProperty({ type: Number, minimum: 1, maximum: 9999 })
  year: number;
  @ApiProperty(recipientSchema)
  recipientName: string;
  @ApiProperty(presetSchema)
  stylePresetId: string;
}

export class ProjectPatchDto {
  @ApiPropertyOptional(titleSchema)
  title?: string;
  @ApiPropertyOptional(recipientSchema)
  recipientName?: string;
  @ApiPropertyOptional(presetSchema)
  stylePresetId?: string;
}

// BR-PRJ-006: deletion is refused unless the request states the confirmation.
export class ProjectDeleteDto {
  @ApiProperty({ type: Boolean })
  confirmed: boolean;
}

export class ProjectDataDto {
  @ApiProperty({ type: String, format: 'uuid' }) id: string;
  @ApiProperty(titleSchema) title: string;
  @ApiProperty({ type: Number, minimum: 1, maximum: 9999 }) year: number;
  @ApiProperty(recipientSchema) recipientName: string;
  @ApiProperty({ enum: [...PROJECT_STATUSES] }) status: (typeof PROJECT_STATUSES)[number];
  @ApiProperty({ type: Number, minimum: 1, description: 'ETag value; advances on every change.' })
  version: number;
  @ApiProperty(presetSchema) stylePresetId: string;
  @ApiProperty({ type: ProjectBaselineDto }) baseline: ProjectBaselineDto;
  @ApiProperty({ type: String, format: 'date-time' }) createdAt: string;
  @ApiProperty({ type: String, format: 'date-time' }) updatedAt: string;

  static from(view: ProjectView): ProjectDataDto {
    return {
      id: view.id, title: view.title, year: view.year, recipientName: view.recipientName,
      status: view.status, version: view.version, stylePresetId: view.stylePresetId,
      baseline: view.baseline as unknown as ProjectBaselineDto,
      createdAt: view.createdAt, updatedAt: view.updatedAt,
    };
  }
}

export class ProjectResponseDto {
  @ApiProperty({ type: ProjectDataDto }) data: ProjectDataDto;
}

// One style preset the captured revision approved, served only on Project detail.
export class ProjectStylePresetDto {
  @ApiProperty({ ...presetSchema, description: 'Preset id approved by the captured revision.' })
  id: string;
  @ApiProperty({ type: LocalisedDto, description: 'Display name of the preset in both locales.' })
  name: LocalisedDto;
}

export class ProjectDetailDataDto extends ProjectDataDto {
  @ApiProperty({ type: [ProjectStylePresetDto], description: 'Every style preset the captured revision approved; a curated control may only offer these.' })
  stylePresets: ProjectStylePresetDto[];
  @ApiProperty({ type: Boolean, description: 'Whether the Project has never been ordered and is currently eligible for permanent deletion.' })
  deletionEligible: boolean;

  static from(view: ProjectDetailView): ProjectDetailDataDto {
    return { ...ProjectDataDto.from(view), stylePresets: [...view.stylePresets], deletionEligible: view.deletionEligible };
  }
}

export class ProjectDetailResponseDto {
  @ApiProperty({ type: ProjectDetailDataDto }) data: ProjectDetailDataDto;
}

// API contract §7: cursor page with an opaque cursor and an explicit hasMore
// flag — no total count.
export class ProjectMetaDto {
  @ApiProperty({ type: String, nullable: true, description: 'Cursor of the last row on this page; null on the final page.' })
  nextCursor: string | null;
  @ApiProperty({ description: 'True when more rows exist beyond this page.' })
  hasMore: boolean;
}

export class ProjectListResponseDto {
  @ApiProperty({ type: [ProjectDataDto] }) data: ProjectDataDto[];
  @ApiProperty({ type: ProjectMetaDto }) meta: ProjectMetaDto;
}

export class ProjectMonthDto {
  @ApiProperty({ type: Number, minimum: 1, maximum: 12 }) monthNumber: number;
  @ApiProperty({ type: String, nullable: true, description: 'At most 300 grapheme clusters.' }) caption: string | null;
  @ApiProperty({ type: [MonthImageDto], maxItems: 4 }) images: MonthImageDto[];
}

export class MonthRevisionDto extends ProjectMonthDto {
  @ApiProperty({ type: 'integer', minimum: 1 }) projectVersion: number;
}

export class MonthResponseDto {
  @ApiProperty({ type: MonthRevisionDto }) data: MonthRevisionDto;
}

// BR-MON-001: the twelve Months are returned together, ordered, with the
// Project version they were read at.
export class ProjectMonthsDataDto {
  @ApiProperty({ type: [ProjectMonthDto] }) months: ProjectMonthDto[];
  @ApiProperty({ type: Number, minimum: 1, description: 'Project version this page was read at.' })
  projectVersion: number;

  static from(projectVersion: number, months: ProjectMonthRecord[]): ProjectMonthsDataDto {
    return {
      projectVersion,
      months,
    };
  }
}

export class ProjectMonthsResponseDto {
  @ApiProperty({ type: ProjectMonthsDataDto }) data: ProjectMonthsDataDto;
}

const publicPreviewIssueCodes: PublicPreviewIssue[] = [
  'PROJECT_STRUCTURE_INVALID', 'PROJECT_MONTHS_INVALID', 'AR_SETUP_REQUIRED', 'AR_SETUP_INVALID',
  'AR_MEDIA_UNAVAILABLE', 'AR_PROCESSING', 'AR_PROCESSING_FAILED', 'AR_PREPARATION_REQUIRED',
  'AR_CONTENT_INVALID', 'AR_OWNER_CONFIRMATION_REQUIRED', 'PROJECT_CONTENT_INVALID', 'PROJECT_ARCHIVED',
  'CALENDAR_IMAGE_REQUIRED', 'AR_REQUIREMENTS_INCOMPLETE', 'PROJECT_REVIEW_REQUIRED',
];

export class ProjectPreviewReadinessIssuesDto {
  @ApiProperty({ type: [String], enum: publicPreviewIssueCodes, description: 'Public, localized-by-client issue codes for preview structure.' })
  preview: PublicPreviewIssue[];
  @ApiProperty({ type: [String], enum: publicPreviewIssueCodes, description: 'Public AR setup issue codes.' })
  ar: PublicPreviewIssue[];
  @ApiProperty({ type: [String], enum: publicPreviewIssueCodes, description: 'Public content-preparation issues. Does not authorize checkout.' })
  order: PublicPreviewIssue[];
}

export class ProjectPreviewReadinessDto {
  @ApiProperty({ description: 'Whether the saved calendar structure can be previewed.' }) previewReady: boolean;
  @ApiProperty({ description: 'Whether verified AR preparation is currently available.' }) arReady: boolean;
  @ApiProperty({ description: 'Compatibility alias for content/finalization preparation only; never checkout permission.' }) orderReady: boolean;
  @ApiProperty({ type: ProjectPreviewReadinessIssuesDto }) issues: ProjectPreviewReadinessIssuesDto;
}

export class ProjectPreviewImageDto {
  @ApiProperty({ type: String, format: 'uuid' }) assetId: string;
  @ApiProperty({ type: String }) altText: string;
  @ApiProperty({ type: 'string', nullable: true, enum: [null], description: 'Current approved crop is null (default crop).' }) crop: null;
  @ApiProperty({ type: String, example: '/api/v1/media/{assetId}/content', description: 'Owner-authorized private media route; never a public delivery URL.' }) contentPath: string;
}

export class ProjectPreviewMonthDto {
  @ApiProperty({ type: Number, minimum: 1, maximum: 12 }) monthNumber: number;
  @ApiProperty({ type: String, nullable: true, description: 'Persisted message, or null when this Month has none.' }) caption: string | null;
  @ApiProperty({ type: [ProjectPreviewImageDto], maxItems: 4 }) images: ProjectPreviewImageDto[];
}

export class ProjectPreviewSpecialDateDto {
  @ApiProperty({ type: String, format: 'uuid' }) id: string;
  @ApiProperty({ type: String, format: 'date', pattern: '^\\d{4}-\\d{2}-\\d{2}$', description: 'Gregorian civil date in the saved Project year.' }) date: string;
  @ApiProperty({ type: String, minLength: 1, maxLength: 80 }) title: string;
  @ApiProperty({ type: String, nullable: true, maxLength: 300 }) note: string | null;
}

export class ProjectPreviewDataDto {
  @ApiProperty({ type: Number, minimum: 1, description: 'One SERIALIZABLE persisted Project revision for all returned content and readiness.' }) projectVersion: number;
  @ApiProperty({ type: ProjectDataDto }) project: ProjectDataDto;
  @ApiProperty({ type: [ProjectPreviewMonthDto], minItems: 12, maxItems: 12 }) months: ProjectPreviewMonthDto[];
  @ApiProperty({ type: [ProjectPreviewSpecialDateDto], description: 'Persisted civil Special Dates; may be empty.' }) specialDates: ProjectPreviewSpecialDateDto[];
  @ApiProperty({ type: ProjectPreviewReadinessDto }) readiness: ProjectPreviewReadinessDto;

  static from(view: ProjectPreviewView): ProjectPreviewDataDto {
    return {
      projectVersion: view.projectVersion,
      project: ProjectDataDto.from(view.project),
      months: view.months.map(month => ({
        monthNumber: month.monthNumber,
        caption: month.caption,
        images: month.images.map(image => ({
          assetId: image.assetId,
          altText: image.altText,
          crop: null,
          contentPath: `/api/v1/media/${image.assetId}/content`,
        })),
      })),
      specialDates: view.specialDates.map(event => ({ id: event.id, date: event.date, title: event.title, note: event.note ?? null })),
      readiness: {
        previewReady: view.readiness.previewReady,
        arReady: view.readiness.arReady,
        orderReady: view.readiness.orderReady,
        issues: {
          preview: [...view.readiness.issues.preview],
          ar: [...view.readiness.issues.ar],
          order: [...view.readiness.issues.order],
        },
      },
    };
  }
}

export class ProjectPreviewResponseDto {
  @ApiProperty({ type: ProjectPreviewDataDto }) data: ProjectPreviewDataDto;
}

export class FieldErrorDto {
  @ApiProperty({ type: String }) path: string;
  @ApiProperty({ type: String }) code: string;
  @ApiProperty({ type: String }) messageKey: string;
}
export class ErrorDataDto {
  @ApiPropertyOptional({ type: Number, minimum: 1 }) currentVersion?: number;
  @ApiProperty({ type: String }) code: string;
  @ApiProperty({ type: String }) messageKey: string;
  @ApiProperty({ type: String }) requestId: string;
  @ApiProperty({ type: Boolean }) retryable: boolean;
  @ApiProperty({ type: [FieldErrorDto] }) fieldErrors: FieldErrorDto[];
}
export class ErrorResponseDto {
  @ApiProperty({ type: ErrorDataDto }) error: ErrorDataDto;
}
