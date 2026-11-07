import type { operations } from './generated';

export type Project = operations['getProject']['responses'][200]['content']['application/json']['data'];
export type ProjectCreate = operations['createProject']['requestBody']['content']['application/json'];
export type ProjectPage = operations['listProjects']['responses'][200]['content']['application/json'];
export type ProjectListQuery = NonNullable<operations['listProjects']['parameters']['query']>;

export class ProjectApiError extends Error {
  constructor(readonly code: string, readonly status: number, readonly requestId?: string,
    readonly fields: { path: string; code: string; messageKey: string }[] = [], readonly retryable = false) {
    super(code);
    this.name = 'ProjectApiError';
  }
}

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new ProjectApiError('PROVIDER_UNAVAILABLE', 502);
  return value as Record<string, unknown>;
}
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function validProject(value: unknown): value is Project {
  const data = record(value);
  const baseline = record(data.baseline);
  const name = record(baseline.name);
  const layout = record(baseline.layout);
  return typeof data.id === 'string' && uuid.test(data.id) && typeof data.title === 'string' &&
    Number.isInteger(data.year) && typeof data.recipientName === 'string' &&
    (data.status === 'WORKING' || data.status === 'ARCHIVED') && Number.isSafeInteger(data.version) &&
    typeof data.stylePresetId === 'string' && typeof name.vi === 'string' && typeof name.en === 'string' &&
    layout.version === 1 && (layout.type === 'PHOTO_FOCUS' || layout.type === 'COLLAGE') &&
    layout.monthCount === 12 && layout.maxImagesPerMonth === 4 &&
    typeof data.createdAt === 'string' && typeof data.updatedAt === 'string';
}
function parseProject(value: unknown): Project {
  const data = record(value).data;
  if (!validProject(data)) throw new ProjectApiError('PROVIDER_UNAVAILABLE', 502);
  return data;
}
function parsePage(value: unknown): ProjectPage {
  const page = record(value); const meta = record(page.meta);
  if (!Array.isArray(page.data) || !page.data.every(validProject) ||
      !(meta.nextCursor === null || typeof meta.nextCursor === 'string') || typeof meta.hasMore !== 'boolean') {
    throw new ProjectApiError('PROVIDER_UNAVAILABLE', 502);
  }
  return { data: page.data, meta: { nextCursor: meta.nextCursor, hasMore: meta.hasMore } };
}
function parseError(value: unknown, status: number): ProjectApiError {
  let code = status === 401 ? 'UNAUTHENTICATED' : status === 403 ? 'FORBIDDEN' : status === 404 ? 'NOT_FOUND' :
    status === 409 ? 'CONFLICT' : status === 412 ? 'VERSION_CONFLICT' : status === 422 ? 'VALIDATION_FAILED' :
      status === 428 ? 'PRECONDITION_REQUIRED' : status === 429 ? 'RATE_LIMITED' : 'PROVIDER_UNAVAILABLE';
  let requestId: string | undefined; let retryable = status >= 500;
  let fields: ProjectApiError['fields'] = [];
  try {
    const error = record(record(value).error);
    if (typeof error.code === 'string' && /^[A-Z_]{1,64}$/.test(error.code)) code = error.code;
    if (typeof error.requestId === 'string') requestId = error.requestId;
    if (typeof error.retryable === 'boolean') retryable = error.retryable;
    if (Array.isArray(error.fieldErrors)) fields = error.fieldErrors.flatMap(item => {
      const field = record(item);
      return typeof field.path === 'string' && typeof field.code === 'string' && typeof field.messageKey === 'string'
        ? [{ path: field.path, code: field.code, messageKey: field.messageKey }] : [];
    });
  } catch { /* Preserve only the status-based safe error. */ }
  return new ProjectApiError(code, status, requestId, fields, retryable);
}

export interface ProjectApiOptions { csrf: () => string | undefined; fetcher?: typeof fetch; epoch?: () => number; unauthorized?: () => Promise<void> }
export function projectApi(options: ProjectApiOptions) {
  const fetcher = options.fetcher ?? fetch;
  async function request<T>(path: string, method: 'GET' | 'POST', decode: (value: unknown) => T,
    signal?: AbortSignal, body?: ProjectCreate, key?: string): Promise<T> {
    const epoch = options.epoch?.();
    const headers: Record<string, string> = { Accept: 'application/json' };
    if (body) headers['Content-Type'] = 'application/json';
    if (method === 'POST') {
      const csrf = options.csrf();
      if (csrf) headers['X-CSRF-Token'] = csrf;
      if (key) headers['Idempotency-Key'] = key;
    }
    let response: Response;
    try {
      response = await fetcher(`/api/v1${path}`, { method, credentials: 'same-origin', cache: 'no-store', redirect: 'error', headers,
        ...(signal ? { signal: AbortSignal.any([signal, AbortSignal.timeout(15000)]) } : { signal: AbortSignal.timeout(15000) }),
        ...(body ? { body: JSON.stringify(body) } : {}) });
    } catch (error) {
      if ((error as { name?: string })?.name === 'AbortError') throw error;
      throw new ProjectApiError('PROVIDER_UNAVAILABLE', 503, undefined, [], true);
    }
    if (options.epoch && epoch !== options.epoch()) throw new ProjectApiError('STALE_RESPONSE', 0);
    if (response.status === 401) await options.unauthorized?.();
    if (!response.ok) throw parseError(await response.json().catch(() => ({})), response.status);
    try {
      const result = decode(await response.json());
      if (options.epoch && epoch !== options.epoch()) throw new ProjectApiError('STALE_RESPONSE', 0);
      return result;
    }
    catch (error) { if (error instanceof ProjectApiError) throw error; throw new ProjectApiError('PROVIDER_UNAVAILABLE', 502); }
  }
  return {
    list: (query: ProjectListQuery = {}, signal?: AbortSignal) => {
      const params = new URLSearchParams();
      if (query.state) params.set('state', query.state);
      if (query.cursor) params.set('cursor', query.cursor);
      if (query.limit !== undefined) params.set('limit', String(query.limit));
      return request(`/projects${params.size ? `?${params}` : ''}`, 'GET', parsePage, signal);
    },
    detail: (id: string, signal?: AbortSignal) => request(`/projects/${encodeURIComponent(id)}`, 'GET', parseProject, signal),
    create: (body: ProjectCreate, key: string) => request('/projects', 'POST', parseProject, undefined, body, key),
  };
}
export type ProjectApi = ReturnType<typeof projectApi>;
export const projectKeys = {
  all: (actorId: string) => ['private', actorId, 'projects'] as const,
  lists: (actorId: string) => [...projectKeys.all(actorId), 'list'] as const,
  list: (actorId: string, query: ProjectListQuery = {}) => [...projectKeys.lists(actorId), query.state ?? null, query.cursor ?? null, query.limit ?? null] as const,
  detail: (actorId: string, id: string) => [...projectKeys.all(actorId), 'detail', id] as const,
};
const retryTransient = (count: number, error: Error) => error instanceof ProjectApiError && error.status >= 500 && count < 2;
export function projectListOptions(actorId: string, query: ProjectListQuery, api: ProjectApi, enabled = true) {
  return { queryKey: projectKeys.list(actorId, query), queryFn: ({ signal }: { signal: AbortSignal }) => api.list(query, signal), staleTime: 15_000, retry: retryTransient, enabled } as const;
}
export function projectDetailOptions(actorId: string, id: string, api: ProjectApi) {
  return { queryKey: projectKeys.detail(actorId, id), queryFn: ({ signal }: { signal: AbortSignal }) => api.detail(id, signal), staleTime: 15_000, retry: retryTransient } as const;
}
