import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { encodeCursor, parseCursor, projectPublicTemplate, type PublicTemplateDto, type PublicTemplateRecord, type TemplateCategory, TemplateCatalogValidationError } from '../domain/template-catalog';

export const TEMPLATE_CATALOG = Symbol('TEMPLATE_CATALOG');
export interface TemplateCatalog {
  list(input: { category?: TemplateCategory; query?: string; after?: { nameVi: string; id: string }; take: number }): Promise<PublicTemplateRecord[]>;
  find(id: string): Promise<PublicTemplateRecord | null>;
}

export interface TemplateListResult { data: PublicTemplateDto[]; meta: { nextCursor: string | null; hasMore: boolean } }

@Injectable()
export class PublicTemplateCatalog {
  constructor(@Inject(TEMPLATE_CATALOG) private readonly catalog: TemplateCatalog) {}

  async list(input: { category?: TemplateCategory; query?: string; cursor?: string; limit?: number }): Promise<TemplateListResult> {
    const limit = input.limit ?? 20;
    if (!Number.isSafeInteger(limit) || limit < 1 || limit > 50) throw new BadRequestException();
    const query = input.query?.trim();
    if (query && query.length > 100) throw new BadRequestException();
    let after: { nameVi: string; id: string } | undefined;
    try { after = parseCursor(input.cursor); } catch (error) {
      if (error instanceof TemplateCatalogValidationError) throw new BadRequestException();
      throw error;
    }
    const rows = await this.catalog.list({ category: input.category, query: query || undefined, after, take: limit + 1 });
    const visible: PublicTemplateRecord[] = [];
    for (const row of rows) {
      try { projectPublicTemplate(row); visible.push(row); } catch (error) {
        if (!(error instanceof TemplateCatalogValidationError)) throw error;
      }
    }
    const hasMore = visible.length > limit;
    const page = visible.slice(0, limit).map(projectPublicTemplate);
    const last = page.at(-1);
    return { data: page, meta: { nextCursor: hasMore && last ? encodeCursor({ nameVi: last.publishedRevision.name.vi, id: last.id }) : null, hasMore } };
  }

  async get(id: string): Promise<{ data: PublicTemplateDto }> {
    const record = await this.catalog.find(id);
    if (!record) throw new NotFoundException();
    try { return { data: projectPublicTemplate(record) }; }
    catch (error) { if (error instanceof TemplateCatalogValidationError) throw new NotFoundException(); throw error; }
  }
}
