import { useQuery, type UseQueryOptions } from '@tanstack/react-query';
import type { operations } from './generated';

export type TemplateCategory = NonNullable<NonNullable<operations['listTemplates']['parameters']['query']>['category']>;
export type TemplateListQuery = NonNullable<operations['listTemplates']['parameters']['query']>;
export type PublicTemplate = operations['getTemplate']['responses'][200]['content']['application/json']['data'];
export type PublicTemplatePage = operations['listTemplates']['responses'][200]['content']['application/json'];

export class TemplateApiError extends Error {
  constructor(readonly code: string, readonly status: number, readonly requestId?: string) {
    super(code);
    this.name = 'TemplateApiError';
  }
}

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TemplateApiError('PROVIDER_UNAVAILABLE', 502);
  return value as Record<string, unknown>;
}

function nonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function validTemplate(value: unknown): value is PublicTemplate {
  const data = record(value);
  const revision = record(data.publishedRevision);
  const name = record(revision.name);
  const description = record(revision.description);
  const layout = record(revision.layout);
  const price = record(revision.price);
  const presetIds = new Set<string>();
  const validPresets = Array.isArray(revision.presets) && revision.presets.length > 0 && revision.presets.every(preset => {
    const item = record(preset);
    const presetName = record(item.name);
    const valid = typeof item.id === 'string' && ['classic', 'minimal', 'vibrant'].includes(item.id) &&
      !presetIds.has(item.id) && nonEmptyString(presetName.vi) && nonEmptyString(presetName.en);
    if (valid) presetIds.add(item.id as string);
    return valid;
  });
  return typeof data.id === 'string' &&
    ['GENERAL', 'BIRTHDAY', 'ANNIVERSARY', 'HOLIDAY'].includes(String(data.category)) &&
    typeof revision.id === 'string' && Number.isSafeInteger(revision.version) && Number(revision.version) > 0 &&
    typeof revision.publishedAt === 'string' &&
    nonEmptyString(name.vi) && nonEmptyString(name.en) &&
    nonEmptyString(description.vi) && nonEmptyString(description.en) &&
    layout.version === 1 && ['PHOTO_FOCUS', 'COLLAGE'].includes(String(layout.type)) &&
    layout.monthCount === 12 && layout.maxImagesPerMonth === 4 &&
    validPresets && price.currency === 'USD' && Number.isSafeInteger(price.unitPriceMinor) && Number(price.unitPriceMinor) > 0;
}

function parseTemplate(value: unknown): PublicTemplate {
  if (!validTemplate(value)) throw new TemplateApiError('PROVIDER_UNAVAILABLE', 502);
  return value;
}

function parsePage(value: unknown): PublicTemplatePage {
  const data = record(value);
  const meta = record(data.meta);
  if (!Array.isArray(data.data) || !data.data.every(validTemplate) ||
    !(meta.nextCursor === null || typeof meta.nextCursor === 'string') || typeof meta.hasMore !== 'boolean') {
    throw new TemplateApiError('PROVIDER_UNAVAILABLE', 502);
  }
  return { data: data.data, meta: { nextCursor: meta.nextCursor, hasMore: meta.hasMore } };
}

function parseDetail(value: unknown): PublicTemplate {
  return parseTemplate(record(value).data);
}

async function request<T>(path: string, signal: AbortSignal, decode: (value: unknown) => T, fetcher: typeof fetch): Promise<T> {
  let response: Response;
  try {
    response = await fetcher(path, {
      method: 'GET', credentials: 'same-origin', cache: 'no-store', redirect: 'error',
      headers: { Accept: 'application/json' }, signal: AbortSignal.any([signal, AbortSignal.timeout(10000)]),
    });
  } catch {
    if (signal.aborted) throw new DOMException('The request was cancelled', 'AbortError');
    throw new TemplateApiError('PROVIDER_UNAVAILABLE', 503);
  }
  if (!response.ok) {
    let code = response.status === 404 ? 'NOT_FOUND' : 'PROVIDER_UNAVAILABLE';
    try {
      const error = record(record(await response.json()).error);
      if (typeof error.code === 'string' && /^[A-Z_]{1,64}$/.test(error.code)) code = error.code;
    } catch { /* Keep only the safe status-based error. */ }
    throw new TemplateApiError(code, response.status, response.headers.get('X-Request-Id') ?? undefined);
  }
  try { return decode(await response.json()); }
  catch (error) {
    if (error instanceof TemplateApiError) throw error;
    throw new TemplateApiError('PROVIDER_UNAVAILABLE', 502);
  }
}

export function templateApi(fetcher: typeof fetch = fetch) {
  return {
    list: (query: TemplateListQuery = {}, signal: AbortSignal = new AbortController().signal) => {
      const params = new URLSearchParams();
      if (query.category) params.set('category', query.category);
      if (query.query !== undefined) params.set('query', query.query);
      if (query.cursor) params.set('cursor', query.cursor);
      if (query.limit !== undefined) params.set('limit', String(query.limit));
      const suffix = params.size ? `?${params.toString()}` : '';
      return request(`/api/v1/templates${suffix}`, signal, parsePage, fetcher);
    },
    detail: (id: string, signal: AbortSignal = new AbortController().signal) =>
      request(`/api/v1/templates/${encodeURIComponent(id)}`, signal, parseDetail, fetcher),
  };
}

export const templateKeys = {
  all: ['templates'] as const,
  lists: () => [...templateKeys.all, 'list'] as const,
  list: (query: TemplateListQuery = {}) => [...templateKeys.lists(), query.category ?? null, query.query ?? null, query.cursor ?? null, query.limit ?? null] as const,
  details: () => [...templateKeys.all, 'detail'] as const,
  detail: (id: string) => [...templateKeys.details(), id] as const,
};

const retryTransient = (failureCount: number, error: Error) =>
  error instanceof TemplateApiError && error.status >= 500 && failureCount < 2;

export function templateListOptions(query: TemplateListQuery = {}, fetcher?: typeof fetch) {
  const api = templateApi(fetcher);
  return {
    queryKey: templateKeys.list(query),
    queryFn: ({ signal }: { signal: AbortSignal }) => api.list(query, signal),
    staleTime: 60_000,
    retry: retryTransient,
  } as const;
}

export function templateDetailOptions(id: string, fetcher?: typeof fetch) {
  const api = templateApi(fetcher);
  return {
    queryKey: templateKeys.detail(id),
    queryFn: ({ signal }: { signal: AbortSignal }) => api.detail(id, signal),
    staleTime: 60_000,
    retry: retryTransient,
  } as const;
}

export function useTemplateList(query: TemplateListQuery = {}, options?: Omit<UseQueryOptions<PublicTemplatePage, Error>, 'queryKey' | 'queryFn'>) {
  return useQuery({ ...templateListOptions(query), ...options });
}

export function useTemplateDetail(id: string, options?: Omit<UseQueryOptions<PublicTemplate, Error>, 'queryKey' | 'queryFn'>) {
  return useQuery({ ...templateDetailOptions(id), ...options, enabled: Boolean(id) && options?.enabled !== false });
}
