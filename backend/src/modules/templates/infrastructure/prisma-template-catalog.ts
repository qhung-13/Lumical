import { Injectable } from '@nestjs/common';
import { Prisma } from '../../../platform/database/infrastructure/generated/client';
import { PrismaDatabase } from '../../../platform/database/infrastructure/prisma-database';
import { escapeLike, type PublicTemplateRecord, type TemplateCategory } from '../domain/template-catalog';
import type { TemplateCatalog } from '../application/template-catalog';

interface CatalogRow {
  id: string; category: TemplateCategory; revisionId: string; templateId: string; revision: number;
  nameVi: string; nameEn: string; descriptionVi: string; descriptionEn: string;
  layoutDefinition: unknown; stylePresets: unknown; unitPriceMinor: bigint; currency: string; publishedAt: Date;
}

@Injectable()
export class PrismaTemplateCatalog implements TemplateCatalog {
  constructor(private readonly database: PrismaDatabase) {}

  async list(input: { category?: TemplateCategory; query?: string; after?: { nameVi: string; id: string }; take: number }): Promise<PublicTemplateRecord[]> {
    const where = [Prisma.sql`t.availability = 'ACTIVE'::lumical.template_availability`, Prisma.sql`r.revision > 0`,
      Prisma.sql`length(btrim(r.name_vi)) > 0 AND length(btrim(r.name_en)) > 0 AND length(btrim(r.description_vi)) > 0 AND length(btrim(r.description_en)) > 0`,
      Prisma.sql`r.currency = 'USD' AND r.unit_price_minor BETWEEN 1 AND 9007199254740991`,
      completeLayoutSql(),
      Prisma.sql`CASE WHEN jsonb_typeof(r.style_presets) = 'array' THEN jsonb_array_length(r.style_presets) > 0 AND NOT EXISTS (
        SELECT 1 FROM jsonb_array_elements(r.style_presets) p
        WHERE jsonb_typeof(p) <> 'object' OR p->>'id' NOT IN ('classic','minimal','vibrant')
          OR length(btrim(COALESCE(p->>'nameVi',''))) = 0 OR length(btrim(COALESCE(p->>'nameEn',''))) = 0
          OR CASE WHEN jsonb_typeof(p) = 'object' THEN (SELECT count(*) FROM jsonb_object_keys(p)) <> 3 ELSE TRUE END
      ) AND (SELECT count(DISTINCT p->>'id') FROM jsonb_array_elements(r.style_presets) p) = jsonb_array_length(r.style_presets) ELSE FALSE END`];
    if (input.category) where.push(Prisma.sql`t.category = ${input.category}::lumical.template_category`);
    if (input.query) {
      const pattern = `%${escapeLike(input.query)}%`;
      where.push(Prisma.sql`(r.name_vi ILIKE ${pattern} ESCAPE E'\\\\' OR r.name_en ILIKE ${pattern} ESCAPE E'\\\\' OR r.description_vi ILIKE ${pattern} ESCAPE E'\\\\' OR r.description_en ILIKE ${pattern} ESCAPE E'\\\\')`);
    }
    if (input.after) where.push(Prisma.sql`(r.name_vi, t.id) > (${input.after.nameVi}, ${input.after.id}::uuid)`);
    const sql = Prisma.sql`SELECT t.id, t.category, r.id AS "revisionId", r.template_id AS "templateId", r.revision,
      r.name_vi AS "nameVi", r.name_en AS "nameEn", r.description_vi AS "descriptionVi", r.description_en AS "descriptionEn",
      r.layout_definition AS "layoutDefinition", r.style_presets AS "stylePresets", r.unit_price_minor AS "unitPriceMinor",
      r.currency, r.published_at AS "publishedAt"
      FROM lumical.templates t JOIN lumical.template_revisions r ON r.id = t.current_published_revision_id AND r.template_id = t.id
      WHERE ${Prisma.join(where, ' AND ')} ORDER BY r.name_vi ASC, t.id ASC LIMIT ${input.take}`;
    return (await this.database.client.$queryRaw<CatalogRow[]>(sql)).map(mapRow);
  }

  async find(id: string): Promise<PublicTemplateRecord | null> {
    const rows = await this.database.client.$queryRaw<CatalogRow[]>`
      SELECT t.id, t.category, r.id AS "revisionId", r.template_id AS "templateId", r.revision,
        r.name_vi AS "nameVi", r.name_en AS "nameEn", r.description_vi AS "descriptionVi", r.description_en AS "descriptionEn",
        r.layout_definition AS "layoutDefinition", r.style_presets AS "stylePresets", r.unit_price_minor AS "unitPriceMinor",
        r.currency, r.published_at AS "publishedAt"
      FROM lumical.templates t JOIN lumical.template_revisions r ON r.id = t.current_published_revision_id AND r.template_id = t.id
      WHERE t.id = ${id}::uuid AND t.availability = 'ACTIVE'::lumical.template_availability
        AND r.revision > 0 AND length(btrim(r.name_vi)) > 0 AND length(btrim(r.name_en)) > 0
        AND length(btrim(r.description_vi)) > 0 AND length(btrim(r.description_en)) > 0
        AND r.currency = 'USD' AND r.unit_price_minor BETWEEN 1 AND 9007199254740991
        AND ${completeLayoutSql()}
        AND CASE WHEN jsonb_typeof(r.style_presets) = 'array' THEN jsonb_array_length(r.style_presets) > 0
        AND NOT EXISTS (SELECT 1 FROM jsonb_array_elements(r.style_presets) p WHERE jsonb_typeof(p) <> 'object'
          OR p->>'id' NOT IN ('classic','minimal','vibrant') OR length(btrim(COALESCE(p->>'nameVi',''))) = 0
          OR length(btrim(COALESCE(p->>'nameEn',''))) = 0 OR CASE WHEN jsonb_typeof(p) = 'object' THEN (SELECT count(*) FROM jsonb_object_keys(p)) <> 3 ELSE TRUE END)
        AND (SELECT count(DISTINCT p->>'id') FROM jsonb_array_elements(r.style_presets) p) = jsonb_array_length(r.style_presets) ELSE FALSE END
      LIMIT 1`;
    return rows[0] ? mapRow(rows[0]) : null;
  }
}

function completeLayoutSql() {
  return Prisma.sql`jsonb_typeof(r.layout_definition) = 'object' AND (
    r.layout_definition = '{"version":1,"type":"PHOTO_FOCUS","monthCount":12,"maxImagesPerMonth":4}'::jsonb OR
    r.layout_definition = '{"version":1,"type":"COLLAGE","monthCount":12,"maxImagesPerMonth":4}'::jsonb
  )`;
}

function mapRow(row: CatalogRow): PublicTemplateRecord {
  return { id: row.id, category: row.category, revision: {
    id: row.revisionId, templateId: row.templateId, revision: row.revision,
    nameVi: row.nameVi, nameEn: row.nameEn, descriptionVi: row.descriptionVi, descriptionEn: row.descriptionEn,
    layoutDefinition: row.layoutDefinition, stylePresets: row.stylePresets, unitPriceMinor: row.unitPriceMinor,
    currency: row.currency, publishedAt: row.publishedAt,
  } };
}
