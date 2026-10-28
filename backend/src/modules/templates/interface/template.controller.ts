import { BadRequestException, Controller, Get, Inject, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { PublicTemplateCatalog, type TemplateListResult } from '../application/template-catalog';
import { TEMPLATE_CATEGORIES, TEMPLATE_LAYOUT_TYPES } from '../domain/template-catalog';

const templateSchema = {
  type: 'object', additionalProperties: false, required: ['id', 'category', 'publishedRevision'],
  properties: {
    id: { type: 'string', format: 'uuid' }, category: { type: 'string', enum: [...TEMPLATE_CATEGORIES] },
    publishedRevision: { type: 'object', additionalProperties: false,
      required: ['id', 'version', 'publishedAt', 'name', 'description', 'layout', 'presets', 'price'],
      properties: {
        id: { type: 'string', format: 'uuid' }, version: { type: 'integer', minimum: 1 }, publishedAt: { type: 'string', format: 'date-time' },
        name: { type: 'object', additionalProperties: false, required: ['vi', 'en'], properties: { vi: { type: 'string' }, en: { type: 'string' } } },
        description: { type: 'object', additionalProperties: false, required: ['vi', 'en'], properties: { vi: { type: 'string' }, en: { type: 'string' } } },
        layout: { type: 'object', additionalProperties: false, required: ['version', 'type', 'monthCount', 'maxImagesPerMonth'], properties: { version: { type: 'integer', enum: [1] }, type: { type: 'string', enum: [...TEMPLATE_LAYOUT_TYPES] }, monthCount: { type: 'integer', enum: [12] }, maxImagesPerMonth: { type: 'integer', enum: [4] } } },
        presets: { type: 'array', minItems: 1, items: { type: 'object', additionalProperties: false, required: ['id', 'name'], properties: { id: { type: 'string', enum: ['classic', 'minimal', 'vibrant'] }, name: { type: 'object', additionalProperties: false, required: ['vi', 'en'], properties: { vi: { type: 'string' }, en: { type: 'string' } } } } } },
        price: { type: 'object', additionalProperties: false, required: ['currency', 'unitPriceMinor'], properties: { currency: { type: 'string', enum: ['USD'] }, unitPriceMinor: { type: 'integer', minimum: 1, maximum: Number.MAX_SAFE_INTEGER } } },
      },
    },
  },
};

@Controller('templates')
@ApiTags('templates')
export class TemplateController {
  constructor(@Inject(PublicTemplateCatalog) private readonly catalog: PublicTemplateCatalog) {}

  @Get()
  @ApiOperation({ operationId: 'listTemplates', summary: 'List active, complete published templates' })
  @ApiQuery({ name: 'category', required: false, enum: TEMPLATE_CATEGORIES })
  @ApiQuery({ name: 'query', required: false, description: 'Trimmed case-insensitive search across VI/EN names and descriptions; accents are compared as stored by PostgreSQL.', schema: { type: 'string', maxLength: 100 } })
  @ApiQuery({ name: 'cursor', required: false, schema: { type: 'string', maxLength: 512 } })
  @ApiQuery({ name: 'limit', required: false, schema: { type: 'integer', minimum: 1, maximum: 50, default: 20 } })
  @ApiResponse({ status: 200, description: 'Public catalog page.', schema: { type: 'object', additionalProperties: false, required: ['data', 'meta'], properties: { data: { type: 'array', items: templateSchema }, meta: { type: 'object', additionalProperties: false, required: ['nextCursor', 'hasMore'], properties: { nextCursor: { type: 'string', nullable: true }, hasMore: { type: 'boolean' } } } } } })
  @ApiResponse({ status: 422, description: 'Invalid filter, cursor, or limit.' })
  async list(@Query() raw: Record<string, string | undefined>): Promise<TemplateListResult> {
    const allowed = new Set(['category', 'query', 'cursor', 'limit']);
    if (Object.keys(raw).some((key) => !allowed.has(key))) throw new BadRequestException();
    const category = raw.category;
    if (category !== undefined && (typeof category !== 'string' || !TEMPLATE_CATEGORIES.some((item) => item === category))) throw new BadRequestException();
    if (raw.query !== undefined && typeof raw.query !== 'string') throw new BadRequestException();
    if (raw.cursor !== undefined && typeof raw.cursor !== 'string') throw new BadRequestException();
    if (raw.limit !== undefined && typeof raw.limit !== 'string') throw new BadRequestException();
    if (raw.query !== undefined && raw.query.length > 100) throw new BadRequestException();
    const query = raw.query?.trim() || undefined;
    if (raw.cursor !== undefined && (raw.cursor.length === 0 || raw.cursor.length > 512)) throw new BadRequestException();
    let limit: number | undefined;
    if (raw.limit !== undefined) {
      if (!/^\d+$/.test(raw.limit)) throw new BadRequestException();
      limit = Number(raw.limit);
      if (!Number.isSafeInteger(limit) || limit < 1 || limit > 50) throw new BadRequestException();
    }
    return this.catalog.list({ category: category as (typeof TEMPLATE_CATEGORIES)[number] | undefined, query, cursor: raw.cursor, limit });
  }

  @Get(':id')
  @ApiOperation({ operationId: 'getTemplate', summary: 'Get an active, complete published template' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Public published template.', schema: { type: 'object', additionalProperties: false, required: ['data'], properties: { data: templateSchema } } })
  @ApiResponse({ status: 422, description: 'Invalid Template UUID.' })
  @ApiResponse({ status: 404, description: 'Template is unavailable.' })
  get(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string) { return this.catalog.get(id); }
}
