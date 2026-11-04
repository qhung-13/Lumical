import { PublicTemplateCatalog, type TemplateCatalog } from './template-catalog';
import type { PublicTemplateRecord } from '../domain/template-catalog';

const record: PublicTemplateRecord = {
  id: '11111111-1111-4111-8111-111111111111', category: 'GENERAL', revision: {
    id: '22222222-2222-4222-8222-222222222222', templateId: '11111111-1111-4111-8111-111111111111', revision: 1,
    nameVi: 'Lịch A', nameEn: 'Calendar A', descriptionVi: 'Mô tả', descriptionEn: 'Description',
    layoutDefinition: { version: 1, type: 'PHOTO_FOCUS', monthCount: 12, maxImagesPerMonth: 4 }, stylePresets: [{ id: 'classic', nameVi: 'Cổ điển', nameEn: 'Classic' }],
    unitPriceMinor: 500n, currency: 'USD', publishedAt: new Date('2026-01-01Z'),
  },
};

describe('PublicTemplateCatalog', () => {
  it('requests only the selected category/query and returns data/meta cursor envelope', async () => {
    const repository: TemplateCatalog = { list: jest.fn().mockResolvedValue([record]), find: jest.fn() };
    const useCase = new PublicTemplateCatalog(repository);
    const result = await useCase.list({ category: 'GENERAL', query: '  mùa  ', limit: 20 });
    expect(repository.list).toHaveBeenCalledWith({ category: 'GENERAL', query: 'mùa', after: undefined, take: 21 });
    expect(result).toEqual({ data: [expect.objectContaining({ id: record.id })], meta: { nextCursor: null, hasMore: false } });
  });

  it('enforces default/max page boundaries and detail missing behavior', async () => {
    const repository: TemplateCatalog = { list: jest.fn().mockResolvedValue([]), find: jest.fn().mockResolvedValue(null) };
    const useCase = new PublicTemplateCatalog(repository);
    await useCase.list({});
    expect(repository.list).toHaveBeenCalledWith({ category: undefined, query: undefined, after: undefined, take: 21 });
    await expect(useCase.list({ limit: 51 })).rejects.toMatchObject({ status: 400 });
    await expect(useCase.get(record.id)).rejects.toMatchObject({ status: 404 });
  });

  it('creates next cursor from name and id tie-break only', async () => {
    const second: PublicTemplateRecord = { ...record, id: '33333333-3333-4333-8333-333333333333', revision: { ...record.revision, templateId: '33333333-3333-4333-8333-333333333333', nameVi: 'Lịch B' } };
    const repository: TemplateCatalog = { list: jest.fn().mockResolvedValue([record, second]), find: jest.fn() };
    const result = await new PublicTemplateCatalog(repository).list({ limit: 1 });
    expect(result.meta.hasMore).toBe(true);
    expect(result.meta.nextCursor).toBeTruthy();
  });

  it('continues scanning when an invalid row falls between valid rows on a page boundary', async () => {
    const invalid = { ...record, id: '22222222-2222-4222-8222-222222222222', revision: {
      ...record.revision, templateId: '22222222-2222-4222-8222-222222222222', nameVi: 'Lịch B',
      descriptionEn: ' ',
    } };
    const last = { ...record, id: '33333333-3333-4333-8333-333333333333', revision: {
      ...record.revision, templateId: '33333333-3333-4333-8333-333333333333', nameVi: 'Lịch C',
    } };
    const repository: TemplateCatalog = {
      list: jest.fn()
        .mockResolvedValueOnce([record, invalid])
        .mockResolvedValueOnce([last])
        .mockResolvedValueOnce([invalid, last])
        .mockResolvedValueOnce([]),
      find: jest.fn(),
    };
    const useCase = new PublicTemplateCatalog(repository);
    const firstPage = await useCase.list({ limit: 1 });
    expect(firstPage.data.map(({ id }) => id)).toEqual([record.id]);
    expect(firstPage.meta.hasMore).toBe(true);
    const secondPage = await useCase.list({ limit: 1, cursor: firstPage.meta.nextCursor ?? undefined });
    expect(secondPage.data.map(({ id }) => id)).toEqual([last.id]);
    expect(secondPage.meta.hasMore).toBe(false);
    expect(repository.list).toHaveBeenNthCalledWith(2, {
      category: undefined, query: undefined,
      after: { nameVi: 'Lịch B', id: invalid.id }, take: 2,
    });
  });
});
