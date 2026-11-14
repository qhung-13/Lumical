import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

const civilDate = {
  type: String,
  format: 'date',
  pattern: '^\\d{4}-\\d{2}-\\d{2}$',
  description: 'Gregorian civil date in the Project year.',
};
const month = { type: 'integer' as const, minimum: 1, maximum: 12 };
const version = { type: 'integer' as const, minimum: 1 };
const optionalText = {
  type: String,
  nullable: true,
  description:
    'At most 300 grapheme clusters after trim and NFC normalization.',
};

export class MonthImageDto {
  @ApiProperty({ type: String, format: 'uuid' }) assetId: string;
  @ApiProperty({ type: String }) altText: string;
  @ApiProperty({
    type: 'string',
    nullable: true,
    enum: [null],
    description:
      'Default crop. The non-null crop schema is pending contract review.',
  })
  crop: null;
}

export class MonthImageWriteDto {
  @ApiProperty({ type: String, format: 'uuid' }) assetId: string;
  @ApiProperty({ type: String }) altText: string;
  @ApiPropertyOptional({
    type: 'string',
    nullable: true,
    enum: [null],
    description:
      'Default crop. The non-null crop schema is pending contract review.',
  })
  crop?: null;
}

export class MonthPatchDto {
  @ApiPropertyOptional(optionalText) caption?: string | null;
  @ApiProperty({ type: [MonthImageWriteDto], maxItems: 4 })
  images: MonthImageWriteDto[];
}

export class EventWriteDto {
  @ApiProperty(civilDate) date: string;
  @ApiProperty({
    type: String,
    description: '1–80 grapheme clusters after trim and NFC normalization.',
  })
  title: string;
  @ApiPropertyOptional(optionalText) note?: string | null;
}

export class SpecialDateDto extends EventWriteDto {
  @ApiProperty({ type: String, format: 'uuid' }) id: string;
  @ApiProperty(optionalText) declare note: string | null;
}

export class ARWriteDto {
  @ApiProperty(month) monthNumber: number;
  @ApiProperty({ type: String, format: 'uuid' }) revealAssetId: string;
  @ApiProperty({
    type: String,
    description:
      'Readable image message, video caption/transcript, or audio transcript/caption.',
  })
  readableText: string;
}

export class SpecialDateRevisionDto extends SpecialDateDto {
  @ApiProperty(version) projectVersion: number;
}

export class SpecialDatesRevisionDto {
  @ApiProperty({ type: [SpecialDateDto] }) events: SpecialDateDto[];
  @ApiProperty(version) projectVersion: number;
}

export class ARRevisionDto extends ARWriteDto {
  @ApiProperty({ enum: ['PREPARING'] }) status: 'PREPARING';
  @ApiProperty(version) projectVersion: number;
}

export class SpecialDateResponseDto {
  @ApiProperty({ type: SpecialDateRevisionDto }) data: SpecialDateRevisionDto;
}

export class SpecialDatesResponseDto {
  @ApiProperty({ type: SpecialDatesRevisionDto }) data: SpecialDatesRevisionDto;
}

export class ARConfigResponseDto {
  @ApiProperty({ type: ARRevisionDto }) data: ARRevisionDto;
}
