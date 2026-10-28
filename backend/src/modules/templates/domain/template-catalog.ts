export const TEMPLATE_CATEGORIES = ['GENERAL', 'BIRTHDAY', 'ANNIVERSARY', 'HOLIDAY'] as const;
export type TemplateCategory = (typeof TEMPLATE_CATEGORIES)[number];

export const TEMPLATE_LAYOUT_TYPES = ['PHOTO_FOCUS', 'COLLAGE'] as const;
export type TemplateLayoutType = (typeof TEMPLATE_LAYOUT_TYPES)[number];

export const TEMPLATE_PRESET_IDS = ['classic', 'minimal', 'vibrant'] as const;
export type TemplatePresetId = (typeof TEMPLATE_PRESET_IDS)[number];

export interface TemplateRevisionRecord {
  id: string;
  templateId: string;
  revision: number;
  nameVi: string;
  nameEn: string;
  descriptionVi: string;
  descriptionEn: string;
  layoutDefinition: unknown;
  stylePresets: unknown;
  unitPriceMinor: bigint;
  currency: string;
  publishedAt: Date;
}

export interface PublicTemplateRecord {
  id: string;
  category: TemplateCategory;
  revision: TemplateRevisionRecord;
}

export interface PublicTemplateDto {
  id: string;
  category: TemplateCategory;
  publishedRevision: {
    id: string;
    version: number;
    publishedAt: string;
    name: { vi: string; en: string };
    description: { vi: string; en: string };
    layout: { version: 1; type: TemplateLayoutType; monthCount: 12; maxImagesPerMonth: 4 };
    presets: { id: TemplatePresetId; name: { vi: string; en: string } }[];
    price: { currency: 'USD'; unitPriceMinor: number };
  };
}

export class TemplateCatalogValidationError extends Error {}

const safeIntegerMax = BigInt(Number.MAX_SAFE_INTEGER);

export function projectPublicTemplate(record: PublicTemplateRecord): PublicTemplateDto {
  const revision = record.revision;
  const strings = [revision.nameVi, revision.nameEn, revision.descriptionVi, revision.descriptionEn];
  if (!TEMPLATE_CATEGORIES.includes(record.category)) {
    throw new TemplateCatalogValidationError('Invalid category');
  }
  if (revision.id.length === 0 || revision.templateId !== record.id || !Number.isSafeInteger(revision.revision) || revision.revision < 1 ||
      strings.some((value) => typeof value !== 'string' || value.trim().length === 0) ||
      revision.currency !== 'USD' || revision.unitPriceMinor <= 0n || revision.unitPriceMinor > safeIntegerMax ||
      !(revision.publishedAt instanceof Date) || Number.isNaN(revision.publishedAt.getTime())) {
    throw new TemplateCatalogValidationError('Published revision is incomplete');
  }

  const layout = revision.layoutDefinition as Record<string, unknown> | null;
  if (!layout || layout.version !== 1 || !TEMPLATE_LAYOUT_TYPES.includes(layout.type as TemplateLayoutType) ||
      layout.monthCount !== 12 || layout.maxImagesPerMonth !== 4 || Object.keys(layout).length !== 4) {
    throw new TemplateCatalogValidationError('Unsupported layout definition');
  }
  if (!Array.isArray(revision.stylePresets) || revision.stylePresets.length === 0) {
    throw new TemplateCatalogValidationError('No approved presets');
  }
  const seen = new Set<string>();
  const presets = revision.stylePresets.map((preset: unknown) => {
    if (!preset || typeof preset !== 'object' || Array.isArray(preset)) throw new TemplateCatalogValidationError('Invalid preset');
    const value = preset as Record<string, unknown>;
    if (Object.keys(value).length !== 3 || typeof value.id !== 'string' || !TEMPLATE_PRESET_IDS.includes(value.id as TemplatePresetId) || seen.has(value.id) ||
        typeof value.nameVi !== 'string' || !value.nameVi.trim() || typeof value.nameEn !== 'string' || !value.nameEn.trim()) {
      throw new TemplateCatalogValidationError('Invalid preset');
    }
    seen.add(value.id);
    return { id: value.id as TemplatePresetId, name: { vi: value.nameVi, en: value.nameEn } };
  });

  return {
    id: record.id,
    category: record.category,
    publishedRevision: {
      id: revision.id,
      version: revision.revision,
      publishedAt: revision.publishedAt.toISOString(),
      name: { vi: revision.nameVi, en: revision.nameEn },
      description: { vi: revision.descriptionVi, en: revision.descriptionEn },
      layout: {
        version: 1,
        type: layout.type as TemplateLayoutType,
        monthCount: 12,
        maxImagesPerMonth: 4,
      },
      presets,
      price: { currency: 'USD', unitPriceMinor: Number(revision.unitPriceMinor) },
    },
  };
}

export function parseCursor(cursor: string | undefined): { nameVi: string; id: string } | undefined {
  if (!cursor) return undefined;
  try {
    const decoded = Buffer.from(cursor, 'base64url').toString('utf8');
    const value: unknown = JSON.parse(decoded);
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error();
    const record = value as Record<string, unknown>;
    if (Object.keys(record).length !== 2 || typeof record.nameVi !== 'string' || !record.nameVi.trim() || typeof record.id !== 'string' ||
        !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(record.id) ||
        Buffer.from(cursor, 'base64url').toString('base64url') !== cursor) throw new Error();
    return { nameVi: record.nameVi, id: record.id };
  } catch {
    throw new TemplateCatalogValidationError('Invalid cursor');
  }
}

export function encodeCursor(value: { nameVi: string; id: string }): string {
  return Buffer.from(JSON.stringify(value)).toString('base64url');
}

export function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, '\\$&');
}
