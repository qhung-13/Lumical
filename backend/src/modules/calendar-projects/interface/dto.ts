import {
  ApiProperty,
  ApiPropertyOptional,
  type ApiPropertyOptions,
} from '@nestjs/swagger';
import type { ProjectMonthRecord } from '../application/project-repository';
import { PROJECT_STATUSES, type ProjectView } from '../domain/project';
import type { ProjectDetailView } from '../application/project-owner';

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

export class ProjectDetailDataDto extends ProjectDataDto {
  @ApiProperty({ type: Boolean, description: 'Whether the Project has never been ordered and is currently eligible for permanent deletion.' })
  deletionEligible: boolean;

  static from(view: ProjectDetailView): ProjectDetailDataDto {
    return { ...ProjectDataDto.from(view), deletionEligible: view.deletionEligible };
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
  @ApiProperty({ type: String, nullable: true, maxLength: 300 }) caption: string | null;
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
      months: months.map((month) => ({ monthNumber: month.monthNumber, caption: month.caption })),
    };
  }
}

export class ProjectMonthsResponseDto {
  @ApiProperty({ type: ProjectMonthsDataDto }) data: ProjectMonthsDataDto;
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
