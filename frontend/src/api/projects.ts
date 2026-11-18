import type { operations } from './generated';

export type Project = operations['createProject']['responses'][201]['content']['application/json']['data'];
export type ProjectDetail = operations['getProject']['responses'][200]['content']['application/json']['data'];
export type ProjectMonths = operations['getProjectMonths']['responses'][200]['content']['application/json']['data'];
export type ProjectCreate = operations['createProject']['requestBody']['content']['application/json'];
export type MonthPatch = operations['replaceProjectMonth']['requestBody']['content']['application/json'];
export type MonthRevision = operations['replaceProjectMonth']['responses'][200]['content']['application/json']['data'];
export type SpecialDateWrite = operations['createProjectSpecialDate']['requestBody']['content']['application/json'];
export type SpecialDate = operations['listProjectSpecialDates']['responses'][200]['content']['application/json']['data']['events'][number];
export type SpecialDatesRevision = operations['listProjectSpecialDates']['responses'][200]['content']['application/json']['data'];
export type SpecialDateRevision = operations['createProjectSpecialDate']['responses'][201]['content']['application/json']['data'];
export type ProjectPage = operations['listProjects']['responses'][200]['content']['application/json'];
export type ProjectListQuery = NonNullable<operations['listProjects']['parameters']['query']>;
export type ARWrite = operations['writeProjectAR']['requestBody']['content']['application/json'];
export type ARRevision = operations['getProjectAR']['responses'][200]['content']['application/json']['data'];

function parseAR(value: unknown): ARRevision {
  const data = record(record(value).data);
  if (!Number.isSafeInteger(data.projectVersion) || Number(data.projectVersion) < 1) throw new ProjectApiError('PROVIDER_UNAVAILABLE', 502);
  if (data.config !== null) {
    const config = record(data.config);
    if (!Number.isInteger(config.monthNumber) || Number(config.monthNumber) < 1 || Number(config.monthNumber) > 12 ||
        typeof config.revealAssetId !== 'string' || !uuid.test(config.revealAssetId) || typeof config.readableText !== 'string' ||
        !['NOT_CONFIGURED', 'PREPARING', 'READY', 'UNAVAILABLE'].includes(String(config.status))) throw new ProjectApiError('PROVIDER_UNAVAILABLE', 502);
  }
  return data as unknown as ARRevision;
}

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
function validCivilDate(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const year = Number(match[1]); const month = Number(match[2]); const day = Number(match[3]);
  if (year < 1 || month < 1 || month > 12 || day < 1) return false;
  const leapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  return day <= [31, leapYear ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1];
}
function validProject(value: unknown, detail = false): value is Project | ProjectDetail {
  const data = record(value);
  const baseline = record(data.baseline);
  const name = record(baseline.name);
  const layout = record(baseline.layout);
  return typeof data.id === 'string' && uuid.test(data.id) && typeof data.title === 'string' &&
    typeof data.year === 'number' && Number.isInteger(data.year) && data.year >= 1 && data.year <= 9999 && typeof data.recipientName === 'string' &&
    (data.status === 'WORKING' || data.status === 'ARCHIVED') && typeof data.version === 'number' && Number.isSafeInteger(data.version) && data.version >= 1 &&
    typeof data.stylePresetId === 'string' && typeof name.vi === 'string' && typeof name.en === 'string' &&
    layout.version === 1 && (layout.type === 'PHOTO_FOCUS' || layout.type === 'COLLAGE') &&
    layout.monthCount === 12 && layout.maxImagesPerMonth === 4 &&
    typeof data.createdAt === 'string' && !Number.isNaN(Date.parse(data.createdAt)) &&
    typeof data.updatedAt === 'string' && !Number.isNaN(Date.parse(data.updatedAt)) &&
    (!detail || typeof data.deletionEligible === 'boolean');
}
function parseProject(value: unknown, detail = false): Project | ProjectDetail {
  const data = record(value).data;
  if (!validProject(data, detail)) throw new ProjectApiError('PROVIDER_UNAVAILABLE', 502);
  return data as Project | ProjectDetail;
}
function parsePage(value: unknown): ProjectPage {
  const page = record(value); const meta = record(page.meta);
  if (!Array.isArray(page.data) || !page.data.every(item => validProject(item)) ||
      !(meta.nextCursor === null || typeof meta.nextCursor === 'string') || typeof meta.hasMore !== 'boolean') {
    throw new ProjectApiError('PROVIDER_UNAVAILABLE', 502);
  }
  return { data: page.data, meta: { nextCursor: meta.nextCursor, hasMore: meta.hasMore } };
}
function parseSpecialDate(value: unknown): SpecialDate {
  const date = record(value);
  if (typeof date.id !== 'string' || !uuid.test(date.id) || typeof date.date !== 'string' ||
      !validCivilDate(date.date) || typeof date.title !== 'string' ||
      !(date.note === undefined || date.note === null || typeof date.note === 'string')) {
    throw new ProjectApiError('PROVIDER_UNAVAILABLE', 502);
  }
  return date as unknown as SpecialDate;
}
function parseSpecialDates(value: unknown): SpecialDatesRevision {
  const data = record(record(value).data);
  if (typeof data.projectVersion !== 'number' || !Number.isSafeInteger(data.projectVersion) || data.projectVersion < 1 || !Array.isArray(data.events)) {
    throw new ProjectApiError('PROVIDER_UNAVAILABLE', 502);
  }
  return { projectVersion: data.projectVersion, events: data.events.map(parseSpecialDate) };
}
function parseSpecialDateRevision(value: unknown): SpecialDateRevision {
  const data = record(record(value).data);
  const event = parseSpecialDate(data);
  if (typeof data.projectVersion !== 'number' || !Number.isSafeInteger(data.projectVersion) || data.projectVersion < 1) {
    throw new ProjectApiError('PROVIDER_UNAVAILABLE', 502);
  }
  return { ...event, projectVersion: data.projectVersion } as SpecialDateRevision;
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
  async function request<T>(path: string, method: 'GET' | 'POST' | 'PUT' | 'DELETE', decode: (value: unknown) => T,
    signal?: AbortSignal, body?: unknown, key?: string, version?: number): Promise<T> {
    const epoch = options.epoch?.();
    const headers: Record<string, string> = { Accept: 'application/json' };
    if (method !== 'GET') {
      const csrf = options.csrf();
      if (csrf) headers['X-CSRF-Token'] = csrf;
      if (key) headers['Idempotency-Key'] = key;
      if (version !== undefined) headers['If-Match'] = `"${version}"`;
      if (body !== undefined) headers['Content-Type'] = 'application/json';
    }
    let response: Response;
    try {
      response = await fetcher(`/api/v1${path}`, { method, credentials: 'same-origin', cache: 'no-store', redirect: 'error', headers,
        ...(signal ? { signal: AbortSignal.any([signal, AbortSignal.timeout(15000)]) } : { signal: AbortSignal.timeout(15000) }),
        ...(body !== undefined ? { body: JSON.stringify(body) } : {}) });
    } catch (error) {
      if ((error as { name?: string })?.name === 'AbortError') throw error;
      throw new ProjectApiError('PROVIDER_UNAVAILABLE', 503, undefined, [], true);
    }
    if (options.epoch && epoch !== options.epoch()) throw new ProjectApiError('STALE_RESPONSE', 0);
    if (response.status === 401) await options.unauthorized?.();
    if (!response.ok) throw parseError(await response.json().catch(() => ({})), response.status);
    try {
      if (response.status === 204) return undefined as T;
      const result = decode(await response.json());
      if (options.epoch && epoch !== options.epoch()) throw new ProjectApiError('STALE_RESPONSE', 0);
      return result;
    }
    catch (error) { if (error instanceof ProjectApiError) throw error; throw new ProjectApiError('PROVIDER_UNAVAILABLE', 502); }
  }
  return {
    ar: (id: string, signal?: AbortSignal) => request(`/projects/${encodeURIComponent(id)}/ar`, 'GET', parseAR, signal),
    saveAR: (id: string, body: ARWrite, key: string, version: number) => request(`/projects/${encodeURIComponent(id)}/ar`, 'PUT', value => {
      const data = record(record(value).data);
      if (data.status !== 'PREPARING') throw new ProjectApiError('PROVIDER_UNAVAILABLE', 502);
      return parseAR({ data: { projectVersion: data.projectVersion, config: {
        monthNumber: data.monthNumber, revealAssetId: data.revealAssetId, readableText: data.readableText, status: data.status,
      } } });
    }, undefined, body, key, version),
    deleteAR: (id: string, version: number) => request(`/projects/${encodeURIComponent(id)}/ar`, 'DELETE', () => undefined, undefined, undefined, undefined, version),
    list: (query: ProjectListQuery = {}, signal?: AbortSignal) => {
      const params = new URLSearchParams();
      if (query.state) params.set('state', query.state);
      if (query.cursor) params.set('cursor', query.cursor);
      if (query.limit !== undefined) params.set('limit', String(query.limit));
      return request(`/projects${params.size ? `?${params}` : ''}`, 'GET', parsePage, signal);
    },
    detail: (id: string, signal?: AbortSignal) => request(`/projects/${encodeURIComponent(id)}`, 'GET', value => parseProject(value, true) as ProjectDetail, signal),
    months: (id: string, signal?: AbortSignal) => request(`/projects/${encodeURIComponent(id)}/months`, 'GET', value => {
      const data = record(record(value).data);
      if (typeof data.projectVersion !== 'number' || !Number.isSafeInteger(data.projectVersion) || data.projectVersion < 1 || !Array.isArray(data.months) || data.months.length !== 12) throw new ProjectApiError('PROVIDER_UNAVAILABLE', 502);
      const months = data.months.map(item => record(item));
      if (months.some((month, index) => month.monthNumber !== index + 1 || !(month.caption === null || typeof month.caption === 'string'))) throw new ProjectApiError('PROVIDER_UNAVAILABLE', 502);
      return data as unknown as ProjectMonths;
    }, signal),
    updateMonth: (id: string, number: number, body: MonthPatch, version: number) => request(
      `/projects/${encodeURIComponent(id)}/months/${number}`, 'PUT', value => {
        const data = record(record(value).data);
        if (data.monthNumber !== number || !(data.caption === null || typeof data.caption === 'string') ||
            typeof data.projectVersion !== 'number' || !Number.isSafeInteger(data.projectVersion) || data.projectVersion < 1 ||
            !Array.isArray(data.images) || data.images.length > 4 || data.images.some(item => {
              const image = record(item);
              return typeof image.assetId !== 'string' || !uuid.test(image.assetId) || typeof image.altText !== 'string' || image.crop !== null;
            })) throw new ProjectApiError('PROVIDER_UNAVAILABLE', 502);
        return data as unknown as MonthRevision;
      }, undefined, body, undefined, version),
    specialDates: (id: string, signal?: AbortSignal) => request(
      `/projects/${encodeURIComponent(id)}/special-dates`, 'GET', parseSpecialDates, signal),
    createSpecialDate: (id: string, body: SpecialDateWrite, key: string, version: number) => request(
      `/projects/${encodeURIComponent(id)}/special-dates`, 'POST', parseSpecialDateRevision, undefined, body, key, version),
    updateSpecialDate: (id: string, eventId: string, body: SpecialDateWrite, version: number) => request(
      `/projects/${encodeURIComponent(id)}/special-dates/${encodeURIComponent(eventId)}`, 'PUT', parseSpecialDateRevision, undefined, body, undefined, version),
    deleteSpecialDate: (id: string, eventId: string, version: number) => request(
      `/projects/${encodeURIComponent(id)}/special-dates/${encodeURIComponent(eventId)}`, 'DELETE', () => undefined, undefined, undefined, undefined, version),
    create: (body: ProjectCreate, key: string) => request('/projects', 'POST', value => parseProject(value) as Project, undefined, body, key),
    archive: (id: string, version: number) => request(`/projects/${encodeURIComponent(id)}/archive`, 'POST', value => parseProject(value) as Project, undefined, undefined, undefined, version),
    restore: (id: string, version: number) => request(`/projects/${encodeURIComponent(id)}/restore`, 'POST', value => parseProject(value) as Project, undefined, undefined, undefined, version),
    remove: (id: string, version: number) => request(`/projects/${encodeURIComponent(id)}`, 'DELETE', () => undefined, undefined, { confirmed: true }, undefined, version),
  };
}
export type ProjectApi = ReturnType<typeof projectApi>;
export const projectKeys = {
  all: (actorId: string) => ['private', actorId, 'projects'] as const,
  lists: (actorId: string) => [...projectKeys.all(actorId), 'list'] as const,
  list: (actorId: string, query: ProjectListQuery = {}) => [...projectKeys.lists(actorId), query.state ?? null, query.cursor ?? null, query.limit ?? null] as const,
  detail: (actorId: string, id: string) => [...projectKeys.all(actorId), 'detail', id] as const,
  months: (actorId: string, id: string) => [...projectKeys.all(actorId), 'months', id] as const,
  specialDates: (actorId: string, id: string) => [...projectKeys.all(actorId), 'special-dates', id] as const,
  ar: (actorId: string, id: string) => [...projectKeys.all(actorId), 'ar', id] as const,
};
const retryTransient = (count: number, error: Error) => error instanceof ProjectApiError && error.status >= 500 && count < 2;
export function projectListOptions(actorId: string, query: ProjectListQuery, api: ProjectApi, enabled = true) {
  return { queryKey: projectKeys.list(actorId, query), queryFn: ({ signal }: { signal: AbortSignal }) => api.list(query, signal), staleTime: 15_000, retry: retryTransient, enabled } as const;
}
export function projectDetailOptions(actorId: string, id: string, api: ProjectApi) {
  return { queryKey: projectKeys.detail(actorId, id), queryFn: ({ signal }: { signal: AbortSignal }) => api.detail(id, signal), staleTime: 15_000, retry: retryTransient } as const;
}
export function projectMonthsOptions(actorId: string, id: string, api: ProjectApi) {
  return { queryKey: projectKeys.months(actorId, id), queryFn: ({ signal }: { signal: AbortSignal }) => api.months(id, signal), staleTime: 15_000, retry: retryTransient } as const;
}
export function projectSpecialDatesOptions(actorId: string, id: string, api: ProjectApi) {
  return { queryKey: projectKeys.specialDates(actorId, id), queryFn: ({ signal }: { signal: AbortSignal }) => api.specialDates(id, signal), staleTime: 15_000, retry: retryTransient } as const;
}
