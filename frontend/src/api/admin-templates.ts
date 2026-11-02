// I04-P04 — Admin Template command boundary (docs/API_CONTRACT.md §17).
// Mirrors api/templates.ts conventions (runtime boundary parsing + injected
// fetcher) and api/admin-orders.ts (error type carrying fields), so switching
// between the real backend and a synthetic Playwright mock is only a route
// interception — no component changes.
import type { components, operations } from './generated';

export type AdminTemplateData = components['schemas']['TemplateAdminDataDto'];
export type AdminTemplateList = components['schemas']['TemplateAdminListResponseDto'];
export type TemplateCreateBody = components['schemas']['TemplateCreateDto'];
export type TemplatePublishBody = components['schemas']['TemplatePublishDto'];
export type TemplateAvailabilityBody = components['schemas']['TemplateAvailabilityDto'];
export type TemplateRevision = components['schemas']['TemplateRevisionDto'];
export type Localised = components['schemas']['LocalisedDto'];
export type TemplateCategory = AdminTemplateData['category'];
export type TemplateAvailability = AdminTemplateData['availability'];
export type TemplateLayoutType = NonNullable<TemplateRevision['layout']>['type'];
export type TemplatePresetId = NonNullable<TemplateRevision['presets']>[number]['id'];

export type AdminTemplateListQuery = NonNullable<operations['listAdminTemplates']['parameters']['query']>;

export class AdminTemplateError extends Error {
  constructor(
    readonly code: string,
    readonly status: number,
    readonly requestId?: string,
    readonly fields: { path: string; messageKey: string }[] = [],
    readonly currentVersion?: number,
  ) {
    super(code);
    this.name = 'AdminTemplateError';
  }
}

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new AdminTemplateError('PROVIDER_UNAVAILABLE', 502);
  }
  return value as Record<string, unknown>;
}

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function validCategory(value: unknown): value is TemplateCategory {
  return value === 'GENERAL' || value === 'BIRTHDAY' || value === 'ANNIVERSARY' || value === 'HOLIDAY';
}

function validAvailability(value: unknown): value is TemplateAvailability {
  return value === 'INACTIVE' || value === 'ACTIVE' || value === 'ARCHIVED';
}

function parseAdminTemplate(value: unknown): AdminTemplateData {
  const data = record(value);
  if (typeof data.id !== 'string' || !uuid.test(data.id) || !validCategory(data.category) ||
      !validAvailability(data.availability) || typeof data.version !== 'number' ||
      !Number.isSafeInteger(data.version) || data.version < 1 ||
      !(data.currentPublishedRevisionId === null || (typeof data.currentPublishedRevisionId === 'string' && uuid.test(data.currentPublishedRevisionId))) ||
      !(data.publishedRevision === null || (typeof data.publishedRevision === 'number' && Number.isSafeInteger(data.publishedRevision) && data.publishedRevision >= 1))) {
    throw new AdminTemplateError('PROVIDER_UNAVAILABLE', 502);
  }
  return data as AdminTemplateData;
}

function parseList(value: unknown): AdminTemplateList {
  const page = record(value);
  const meta = record(page.meta);
  if (!Array.isArray(page.data) || !page.data.every((row) => { try { parseAdminTemplate(row); return true; } catch { return false; } })) {
    throw new AdminTemplateError('PROVIDER_UNAVAILABLE', 502);
  }
  if (!(meta.nextCursor === null || typeof meta.nextCursor === 'string') || typeof meta.hasMore !== 'boolean') {
    throw new AdminTemplateError('PROVIDER_UNAVAILABLE', 502);
  }
  return { data: page.data as AdminTemplateData[], meta: { nextCursor: (meta.nextCursor as string | null) ?? null, hasMore: meta.hasMore } };
}

function parseEnvelope(value: unknown): AdminTemplateData {
  return parseAdminTemplate(record(value).data);
}

/** Parse the shared error envelope (§9): code, safe field paths and optional currentVersion for 412. */
function parseError(value: unknown, status: number): AdminTemplateError {
  let code = status === 401 ? 'UNAUTHENTICATED' : status === 403 ? 'FORBIDDEN' :
    status === 404 ? 'NOT_FOUND' : status === 409 ? 'CONFLICT' :
    status === 412 ? 'VERSION_CONFLICT' : status === 422 ? 'VALIDATION_FAILED' :
    status === 428 ? 'PRECONDITION_REQUIRED' : 'PROVIDER_UNAVAILABLE';
  let requestId: string | undefined;
  let currentVersion: number | undefined;
  let fields: { path: string; messageKey: string }[] = [];
  try {
    const error = record(record(value).error);
    if (typeof error.code === 'string' && /^[A-Z_]{1,64}$/.test(error.code)) code = error.code;
    if (typeof error.requestId === 'string') requestId = error.requestId;
    if (typeof error.currentVersion === 'number' && Number.isSafeInteger(error.currentVersion)) currentVersion = error.currentVersion;
    if (Array.isArray(error.fieldErrors)) {
      fields = error.fieldErrors.flatMap((entry): { path: string; messageKey: string }[] => {
        const item = record(entry);
        return typeof item.path === 'string' && typeof item.messageKey === 'string' ? [{ path: item.path, messageKey: item.messageKey }] : [];
      });
    }
  } catch { /* Keep only the safe status-based error. */ }
  return new AdminTemplateError(code, status, requestId, fields, currentVersion);
}

export interface AdminTemplateApiOptions {
  /** CSRF token for mutations; read from the live session, never a prop. */
  csrf: () => string | undefined;
  fetcher?: typeof fetch;
}

async function request<T>(
  path: string,
  method: 'GET' | 'POST' | 'PUT',
  options: AdminTemplateApiOptions,
  decode: (value: unknown) => T,
  body?: unknown,
  headers: Record<string, string> = {},
  signal: AbortSignal = new AbortController().signal,
): Promise<T> {
  const fetcher = options.fetcher ?? fetch;
  const requestHeaders: Record<string, string> = { Accept: 'application/json', ...headers };
  if (body !== undefined) requestHeaders['Content-Type'] = 'application/json';
  if (method !== 'GET') {
    const csrf = options.csrf();
    if (csrf) requestHeaders['X-CSRF-Token'] = csrf;
  }
  let response: Response;
  try {
    response = await fetcher(path, {
      method, credentials: 'same-origin', cache: 'no-store', redirect: 'error',
      headers: requestHeaders, signal: AbortSignal.any([signal, AbortSignal.timeout(15000)]),
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
  } catch (error) {
    if ((error as { name?: string })?.name === 'AbortError') throw error;
    throw new AdminTemplateError('PROVIDER_UNAVAILABLE', 503);
  }
  if (!response.ok) throw parseError(await response.json().catch(() => ({})), response.status);
  try { return decode(await response.json()); }
  catch (error) {
    if (error instanceof AdminTemplateError) throw error;
    throw new AdminTemplateError('PROVIDER_UNAVAILABLE', 502);
  }
}

export function adminTemplateApi(options: AdminTemplateApiOptions) {
  return {
    list: (query: AdminTemplateListQuery = {}, signal?: AbortSignal) => {
      const params = new URLSearchParams();
      if (query.state) params.set('state', query.state);
      if (query.cursor) params.set('cursor', query.cursor);
      if (query.limit !== undefined) params.set('limit', String(query.limit));
      const suffix = params.size ? `?${params.toString()}` : '';
      return request(`/api/v1/admin/templates${suffix}`, 'GET', options, parseList, undefined, {}, signal);
    },
    create: (body: TemplateCreateBody, key: string) =>
      request('/api/v1/admin/templates', 'POST', options, parseEnvelope, body, { 'Idempotency-Key': key }),
    publish: (id: string, body: TemplatePublishBody, key: string, ifMatch: number) =>
      request(`/api/v1/admin/templates/${encodeURIComponent(id)}/revisions`, 'POST', options, parseEnvelope, body, { 'Idempotency-Key': key, 'If-Match': `"${ifMatch}"` }),
    availability: (id: string, body: TemplateAvailabilityBody, key: string, ifMatch: number) =>
      request(`/api/v1/admin/templates/${encodeURIComponent(id)}/availability`, 'PUT', options, parseEnvelope, body, { 'Idempotency-Key': key, 'If-Match': `"${ifMatch}"` }),
  };
}

export type AdminTemplateApi = ReturnType<typeof adminTemplateApi>;

export const adminTemplateKeys = {
  all: ['admin-templates'] as const,
  lists: () => [...adminTemplateKeys.all, 'list'] as const,
  list: (query: AdminTemplateListQuery = {}) =>
    [...adminTemplateKeys.lists(), query.state ?? null, query.cursor ?? null, query.limit ?? null] as const,
};

const retryTransient = (failureCount: number, error: Error) =>
  error instanceof AdminTemplateError && error.status >= 500 && failureCount < 2;

export function adminTemplateListOptions(query: AdminTemplateListQuery = {}, api?: AdminTemplateApi) {
  return {
    queryKey: adminTemplateKeys.list(query),
    queryFn: ({ signal }: { signal: AbortSignal }) => (api ?? adminTemplateApi({ csrf: () => undefined })).list(query, signal),
    staleTime: 15_000,
    retry: retryTransient,
  } as const;
}

export const adminTemplateKeysDetail = (id: string) => [...adminTemplateKeys.all, 'detail', id] as const;

/**
 * Load one template by walking the cursor list (the contract has no GET-by-id
 * on the admin surface). Stops at the first page containing the id; a bounded
 * walk keeps a single detail view from scanning an unbounded catalog.
 */
export function adminTemplateDetailOptions(id: string, api?: AdminTemplateApi, maxPages = 10) {
  return {
    queryKey: adminTemplateKeysDetail(id),
    queryFn: async ({ signal }: { signal: AbortSignal }): Promise<AdminTemplateData | null> => {
      const client = api ?? adminTemplateApi({ csrf: () => undefined });
      let cursor: string | null = null;
      for (let page = 0; page < maxPages; page += 1) {
        const result = await client.list(cursor ? { cursor } : {}, signal);
        const found = result.data.find((row) => row.id === id);
        if (found) return found;
        if (!result.meta.hasMore || !result.meta.nextCursor) return null;
        cursor = result.meta.nextCursor;
      }
      return null;
    },
    staleTime: 15_000,
    retry: retryTransient,
  } as const;
}
