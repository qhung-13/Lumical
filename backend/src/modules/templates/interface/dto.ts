import { ApiProperty, ApiPropertyOptional, type ApiPropertyOptions, type SchemaObject } from '@nestjs/swagger';
import { TEMPLATE_AVAILABILITIES, type TemplateAdminView } from '../domain/template-admin';
import { TEMPLATE_CATEGORIES } from '../domain/template-catalog';

// Schema objects are plain consts so nesting stays readable and each constraint can be reviewed
// against the rule it enforces rather than against decorator punctuation.
const localisedSchema = (description: string): SchemaObject => ({
  type: 'object', additionalProperties: false, required: ['vi', 'en'], description,
  properties: { vi: { type: 'string' }, en: { type: 'string' } },
});

const layoutSchema: ApiPropertyOptions = {
  type: 'object', additionalProperties: false, required: ['version', 'type', 'monthCount', 'maxImagesPerMonth'],
  description: 'Frozen published layout. Only version 1 and the approved values are stored.',
  properties: {
    version: { type: 'integer', enum: [1] },
    type: { type: 'string', enum: ['PHOTO_FOCUS', 'COLLAGE'] },
    monthCount: { type: 'integer', enum: [12] },
    maxImagesPerMonth: { type: 'integer', enum: [4] },
  },
};

const presetSchema: SchemaObject = {
  type: 'object', additionalProperties: false, required: ['id', 'name'],
  description: 'Approved presets only; a request never invents an id.',
  properties: { id: { type: 'string', enum: ['classic', 'minimal', 'vibrant'] }, name: localisedSchema('Approved preset name') },
};

const presetsSchema: ApiPropertyOptions = {
  type: 'array', minItems: 1, description: 'Every approved preset must appear at least once.', items: presetSchema,
};

const priceSchema: ApiPropertyOptions = {
  type: 'object', additionalProperties: false, required: ['currency', 'unitPriceMinor'],
  description: 'BR-PRICE-001: positive USD minor units inside the safe integer range.',
  properties: { currency: { type: 'string', enum: ['USD'] },
    unitPriceMinor: { type: 'integer', minimum: 1, maximum: 9007199254740991 } },
};

const reasonProperty: ApiPropertyOptions = { type: 'string', minLength: 1, maxLength: 1000, description: 'Recorded as the audit purpose.' };

export class LocalisedDto {
  @ApiProperty({ type: String }) vi: string;
  @ApiProperty({ type: String }) en: string;
}

export class TemplateRevisionDto {
  @ApiProperty({ type: LocalisedDto }) name: LocalisedDto;
  @ApiProperty({ type: LocalisedDto }) description: LocalisedDto;
  @ApiProperty(layoutSchema) layout: Record<string, unknown>;
  @ApiProperty(presetsSchema) presets: { id: string; name: LocalisedDto }[];
  @ApiProperty(priceSchema) price: { currency: 'USD'; unitPriceMinor: number };
}

export class TemplateCreateDto {
  @ApiProperty({ enum: [...TEMPLATE_CATEGORIES] }) category: (typeof TEMPLATE_CATEGORIES)[number];
  @ApiProperty({ type: TemplateRevisionDto }) revision: TemplateRevisionDto;
  @ApiPropertyOptional(reasonProperty) reason?: string;
}

export class TemplatePublishDto {
  @ApiProperty({ type: TemplateRevisionDto }) revision: TemplateRevisionDto;
  @ApiPropertyOptional(reasonProperty) reason?: string;
}

export class TemplateAvailabilityDto {
  @ApiProperty({ enum: [...TEMPLATE_AVAILABILITIES] }) availability: (typeof TEMPLATE_AVAILABILITIES)[number];
  @ApiProperty({ ...reasonProperty, description: 'Operational reason; stored as the audit purpose.' }) reason: string;
}

export class TemplateAdminDataDto {
  @ApiProperty({ type: String, format: 'uuid' }) id: string;
  @ApiProperty({ enum: [...TEMPLATE_CATEGORIES] }) category: (typeof TEMPLATE_CATEGORIES)[number];
  @ApiProperty({ enum: [...TEMPLATE_AVAILABILITIES] }) availability: (typeof TEMPLATE_AVAILABILITIES)[number];
  @ApiProperty({ type: Number, minimum: 1 }) version: number;
  @ApiProperty({ type: String, format: 'uuid', nullable: true }) currentPublishedRevisionId: string | null;
  @ApiProperty({ type: Number, nullable: true, minimum: 1 }) publishedRevision: number | null;

  static from(view: TemplateAdminView): TemplateAdminDataDto {
    return { id: view.id, category: view.category, availability: view.availability, version: view.version,
      currentPublishedRevisionId: view.currentPublishedRevisionId, publishedRevision: view.publishedRevision };
  }
}

export class TemplateAdminResponseDto { @ApiProperty({ type: TemplateAdminDataDto }) data: TemplateAdminDataDto; }

// API contract §7: cursor page with an opaque cursor and an explicit hasMore flag — no total count.
export class TemplateAdminMetaDto {
  @ApiProperty({ type: String, nullable: true, description: 'Cursor of the last row on this page; null on the final page.' })
  nextCursor: string | null;
  @ApiProperty({ description: 'True when more rows exist beyond this page.' })
  hasMore: boolean;
}
export class TemplateAdminListResponseDto {
  @ApiProperty({ type: [TemplateAdminDataDto] }) data: TemplateAdminDataDto[];
  @ApiProperty({ type: TemplateAdminMetaDto }) meta: TemplateAdminMetaDto;
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
export class ErrorResponseDto { @ApiProperty({ type: ErrorDataDto }) error: ErrorDataDto; }
