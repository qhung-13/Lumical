import { PublicTemplateCatalog, type TemplateCatalog } from './template-catalog';
import type { PublicTemplateRecord } from '../domain/template-catalog';

const record: PublicTemplateRecord = {
  id: '11111111-1111-4111-8111-111111111111', category: 'IMAGE', revision: {
    id: '22222222-2222-4222-8222-222222222222', templateId: '11111111-1111-4111-8111-111111111111', revision: 1,
    nameVi: 'Lịch A', nameEn: 'Calendar A', descriptionVi: 'Mô tả', descriptionEn: 'Description',
    layoutDefinition: { version: 1, monthCount: 12, imageSlotsPerMonth: 4 }, stylePresets: [{ id: 'classic', nameVi: 'Cổ điển', nameEn: 'Classic' }],
    unitPriceMinor: 500n, currency: 'USD', publishedAt: new Date('2026-01-01Z'),
  },
};

describe('PublicTemplateCatalog', () => {
  it('requests only the selected category/query and returns data/meta cursor envelope', async () => {
    const repository: TemplateCatalog = { list: jest.fn().mockResolvedValue([record]), find: jest.fn() };
    const useCase = new PublicTemplateCatalog(repository);
    const result = await useCase.list({ category: 'IMAGE', query: '  mùa  ', limit: 20 });
    expect(repository.list).toHaveBeenCalledWith({ category: 'IMAGE', query: 'mùa', after: undefined, take: 21 });
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
});
