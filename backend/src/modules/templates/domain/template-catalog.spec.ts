import { projectPublicTemplate, parseCursor, encodeCursor, escapeLike, TemplateCatalogValidationError, type PublicTemplateRecord } from './template-catalog';

const valid = (): PublicTemplateRecord => ({
  id: '11111111-1111-4111-8111-111111111111', category: 'GENERAL', revision: {
    id: '22222222-2222-4222-8222-222222222222', templateId: '11111111-1111-4111-8111-111111111111', revision: 2,
    nameVi: 'Lịch mùa xuân', nameEn: 'Spring calendar', descriptionVi: 'Mô tả', descriptionEn: 'Description',
    layoutDefinition: { version: 1, type: 'PHOTO_FOCUS', monthCount: 12, maxImagesPerMonth: 4 },
    stylePresets: [{ id: 'classic', nameVi: 'Cổ điển', nameEn: 'Classic' }], unitPriceMinor: 1450n,
    currency: 'USD', publishedAt: new Date('2026-01-01T00:00:00Z'),
  },
});

describe('public Template projection policy', () => {
  it('projects bilingual copy, curated starting design and checked USD integer without internal fields', () => {
    const dto = projectPublicTemplate(valid());
    expect(dto.publishedRevision.price).toEqual({ currency: 'USD', unitPriceMinor: 1450 });
    expect(dto.publishedRevision.name).toEqual({ vi: 'Lịch mùa xuân', en: 'Spring calendar' });
    expect(dto.publishedRevision.layout).toEqual({ version: 1, type: 'PHOTO_FOCUS', monthCount: 12, maxImagesPerMonth: 4 });
    expect(JSON.stringify(dto)).not.toContain('templateId');
    expect(JSON.stringify(dto)).not.toContain('layoutDefinition');
  });

  it.each([0n, -1n, BigInt(Number.MAX_SAFE_INTEGER) + 1n])('rejects invalid money %s', (price) => {
    const record = valid(); record.revision.unitPriceMinor = price;
    expect(() => projectPublicTemplate(record)).toThrow(TemplateCatalogValidationError);
  });

  it('projects both approved layouts and rejects unsupported preset, layout and incomplete VI/EN copy', () => {
    const record = valid(); record.revision.stylePresets = [{ id: 'custom', nameVi: 'Tùy chỉnh', nameEn: 'Custom' }];
    expect(() => projectPublicTemplate(record)).toThrow(TemplateCatalogValidationError);
    record.revision.stylePresets = [{ id: 'classic', nameVi: 'Cổ điển', nameEn: 'Classic' }];
    record.revision.layoutDefinition = { version: 1, type: 'COLLAGE', monthCount: 12, maxImagesPerMonth: 4 };
    expect(projectPublicTemplate(record).publishedRevision.layout.type).toBe('COLLAGE');
    record.revision.layoutDefinition = { version: 2, type: 'PHOTO_FOCUS', monthCount: 12, maxImagesPerMonth: 4 };
    expect(() => projectPublicTemplate(record)).toThrow(TemplateCatalogValidationError);
    record.revision.layoutDefinition = { version: 1, type: 'PHOTO_FOCUS', monthCount: 12, maxImagesPerMonth: 5 };
    expect(() => projectPublicTemplate(record)).toThrow(TemplateCatalogValidationError);
    record.revision.layoutDefinition = { version: 1, type: 'PHOTO_FOCUS', monthCount: 12, maxImagesPerMonth: 4 };
    record.revision.descriptionEn = ' ';
    expect(() => projectPublicTemplate(record)).toThrow(TemplateCatalogValidationError);
  });

  it('encodes stable name/id cursor and rejects arbitrary cursor values', () => {
    const cursor = encodeCursor({ nameVi: 'Lịch A', id: valid().id });
    expect(parseCursor(cursor)).toEqual({ nameVi: 'Lịch A', id: valid().id });
    expect(() => parseCursor(Buffer.from('{"id":"x"}').toString('base64url'))).toThrow(TemplateCatalogValidationError);
  });

  it('escapes LIKE wildcards and escape character', () => {
    expect(escapeLike('100%_\\')).toBe('100\\%\\_\\\\');
  });
});
