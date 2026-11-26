import type { operations } from './generated';

export type Project = operations['createProject']['responses'][201]['content']['application/json']['data'];
export type ProjectDetail = operations['getProject']['responses'][200]['content']['application/json']['data'];
export type ProjectMonths = operations['getProjectMonths']['responses'][200]['content']['application/json']['data'];
export type ProjectPreview = operations['getProjectPreview']['responses'][200]['content']['application/json']['data'];
export type ProjectCreate = operations['createProject']['requestBody']['content']['application/json'];
export type ProjectPatch = operations['patchProject']['requestBody']['content']['application/json'];
export type MonthPatch = operations['replaceProjectMonth']['requestBody']['content']['application/json'];
export type MonthRevision = operations['replaceProjectMonth']['responses'][200]['content']['application/json']['data'];
export type SpecialDateWrite = operations['createProjectSpecialDate']['requestBody']['content']['application/json'];
export type SpecialDate = operations['listProjectSpecialDates']['responses'][200]['content']['application/json']['data']['events'][number];
export type SpecialDatesRevision = operations['listProjectSpecialDates']['responses'][200]['content']['application/json']['data'];
export type SpecialDateRevision = operations['createProjectSpecialDate']['responses'][201]['content']['application/json']['data'];
export type ProjectPage = operations['listProjects']['responses'][200]['content']['application/json'];
export type ProjectListQuery = NonNullable<operations['listProjects']['parameters']['query']>;
export type ARWrite = operations['writeProjectAR']['requestBody']['content']['application/json'];
export type ARRevision = operations['getProjectARConfig']['responses'][200]['content']['application/json']['data'];
export interface ARPreview {
  projectVersion: number;
  config: { monthNumber: number; revealAssetId: string; readableText: string; status: 'NOT_CONFIGURED' | 'PREPARING' | 'READY' | 'UNAVAILABLE' } | null;
  target: { artifactId: string; targetId: string; sourceRevision: number; status: 'PREPARING' | 'READY' | 'UNAVAILABLE'; available: boolean; contentPath: string } | null;
  reveal: { assetId: string; category: 'IMAGE' | 'VIDEO' | 'AUDIO'; contentVersion: number; status: 'PENDING' | 'READY' | 'UNAVAILABLE'; contentPath: string | null } | null;
}

function parseARPreview(value: unknown): ARPreview {
  const data = record(record(value).data);
  if (!Number.isSafeInteger(data.projectVersion) || Number(data.projectVersion) < 1) throw new ProjectApiError('PROVIDER_UNAVAILABLE', 502);
  const config = data.config === null ? null : record(data.config);
  if (config && (!Number.isInteger(config.monthNumber) || Number(config.monthNumber) < 1 || Number(config.monthNumber) > 12 || typeof config.revealAssetId !== 'string' || !uuid.test(config.revealAssetId) || typeof config.readableText !== 'string')) throw new ProjectApiError('PROVIDER_UNAVAILABLE', 502);
  const target = data.target === null ? null : record(data.target);
  if (target && (typeof target.artifactId !== 'string' || !uuid.test(target.artifactId) || typeof target.targetId !== 'string' || !uuid.test(target.targetId) || typeof target.sourceRevision !== 'number' || !['PREPARING', 'READY', 'UNAVAILABLE'].includes(String(target.status)) || typeof target.available !== 'boolean' || typeof target.contentPath !== 'string')) throw new ProjectApiError('PROVIDER_UNAVAILABLE', 502);
  const reveal = data.reveal === null ? null : record(data.reveal);
  if (reveal && (typeof reveal.assetId !== 'string' || !uuid.test(reveal.assetId) || !['IMAGE', 'VIDEO', 'AUDIO'].includes(String(reveal.category)) || typeof reveal.contentVersion !== 'number' || !['PENDING', 'READY', 'UNAVAILABLE'].includes(String(reveal.status)) || !(reveal.contentPath === null || typeof reveal.contentPath === 'string'))) throw new ProjectApiError('PROVIDER_UNAVAILABLE', 502);
  return data as unknown as ARPreview;
}

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
    readonly fields: { path: string; code: string; messageKey: string }[] = [], readonly retryable = false,
    // P06: a 412 names the version the server is actually on, so conflict review
    // can tell the truth instead of guessing.
    readonly currentVersion?: number) {
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
    (!detail || (typeof data.deletionEligible === 'boolean' && Array.isArray(data.stylePresets) &&
      data.stylePresets.every(preset => {
        const item = record(preset); const name = record(item.name);
        return typeof item.id === 'string' && item.id.length > 0 && item.id.length <= 64 &&
          typeof name.vi === 'string' && name.vi.length > 0 && typeof name.en === 'string' && name.en.length > 0;
      })));
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
const publicPreviewIssueCodes = new Set([
  'PROJECT_STRUCTURE_INVALID', 'PROJECT_MONTHS_INVALID', 'AR_SETUP_REQUIRED', 'AR_SETUP_INVALID',
  'AR_MEDIA_UNAVAILABLE', 'AR_PROCESSING', 'AR_PROCESSING_FAILED', 'AR_PREPARATION_REQUIRED',
  'AR_CONTENT_INVALID', 'AR_OWNER_CONFIRMATION_REQUIRED', 'PROJECT_CONTENT_INVALID', 'PROJECT_ARCHIVED',
  'CALENDAR_IMAGE_REQUIRED', 'AR_REQUIREMENTS_INCOMPLETE', 'PROJECT_REVIEW_REQUIRED',
]);
function parseProjectPreview(value: unknown): ProjectPreview {
  const data = record(record(value).data); const project = record(data.project); const readiness = record(data.readiness);
  const issues = record(readiness.issues);
  if (!Number.isSafeInteger(data.projectVersion) || Number(data.projectVersion) < 1 ||
      !validProject(project) || project.version !== data.projectVersion ||
      typeof readiness.previewReady !== 'boolean' || typeof readiness.arReady !== 'boolean' || typeof readiness.orderReady !== 'boolean' ||
      !Array.isArray(issues.preview) || !Array.isArray(issues.ar) || !Array.isArray(issues.order) ||
      [issues.preview, issues.ar, issues.order].some(list => list.some(code => typeof code !== 'string' || !publicPreviewIssueCodes.has(code))) ||
      !Array.isArray(data.months) || data.months.length !== 12 || !Array.isArray(data.specialDates)) {
    throw new ProjectApiError('PROVIDER_UNAVAILABLE', 502);
  }
  const months = data.months.map(item => record(item));
  if (months.some((month, index) => month.monthNumber !== index + 1 || !(month.caption === null || typeof month.caption === 'string') ||
      !Array.isArray(month.images) || month.images.length > 4 || month.images.some(raw => {
        const image = record(raw);
        return typeof image.assetId !== 'string' || !uuid.test(image.assetId) || typeof image.altText !== 'string' ||
          image.crop !== null || image.contentPath !== `/api/v1/media/${image.assetId}/content`;
      }))) throw new ProjectApiError('PROVIDER_UNAVAILABLE', 502);
  const events = data.specialDates.map(parseSpecialDate);
  if (events.some(event => !validCivilDate(event.date) || Number(event.date.slice(0, 4)) !== project.year)) throw new ProjectApiError('PROVIDER_UNAVAILABLE', 502);
  return data as unknown as ProjectPreview;
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
  let currentVersion: number | undefined;
  try {
    const error = record(record(value).error);
    if (typeof error.code === 'string' && /^[A-Z_]{1,64}$/.test(error.code)) code = error.code;
    if (typeof error.requestId === 'string') requestId = error.requestId;
    if (typeof error.retryable === 'boolean') retryable = error.retryable;
    if (typeof error.currentVersion === 'number' && Number.isSafeInteger(error.currentVersion) && error.currentVersion >= 1) currentVersion = error.currentVersion;
    if (Array.isArray(error.fieldErrors)) fields = error.fieldErrors.flatMap(item => {
      const field = record(item);
      return typeof field.path === 'string' && typeof field.code === 'string' && typeof field.messageKey === 'string'
        ? [{ path: field.path, code: field.code, messageKey: field.messageKey }] : [];
    });
  } catch { /* Preserve only the status-based safe error. */ }
  return new ProjectApiError(code, status, requestId, fields, retryable, currentVersion);
}

export interface ProjectApiOptions { csrf: () => string | undefined; fetcher?: typeof fetch; epoch?: () => number; unauthorized?: () => Promise<void> }
export function projectApi(options: ProjectApiOptions) {
  const fetcher = options.fetcher ?? fetch;
  async function request<T>(path: string, method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE', decode: (value: unknown) => T,
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
    ar: (id: string, signal?: AbortSignal) => request(`/projects/${encodeURIComponent(id)}/ar/config`, 'GET', parseAR, signal),
    arPreview: (id: string, signal?: AbortSignal) => request(`/projects/${encodeURIComponent(id)}/ar/preview`, 'GET', parseARPreview, signal),
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
    preview: (id: string, signal?: AbortSignal) => request(`/projects/${encodeURIComponent(id)}/preview`, 'GET', parseProjectPreview, signal),
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
    // P06: identity/curated-style edits carry If-Match like every other write.
    patch: (id: string, body: ProjectPatch, version: number) => request(
      `/projects/${encodeURIComponent(id)}`, 'PATCH', value => parseProject(value) as Project, undefined, body, undefined, version),
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
  preview: (actorId: string, id: string) => [...projectKeys.all(actorId), 'preview', id] as const,
  months: (actorId: string, id: string) => [...projectKeys.all(actorId), 'months', id] as const,
  specialDates: (actorId: string, id: string) => [...projectKeys.all(actorId), 'special-dates', id] as const,
  ar: (actorId: string, id: string) => [...projectKeys.all(actorId), 'ar', id] as const,
  arPreview: (actorId: string, id: string) => [...projectKeys.all(actorId), 'ar-preview', id] as const,
};
const retryTransient = (count: number, error: Error) => error instanceof ProjectApiError && error.status >= 500 && count < 2;
export function projectListOptions(actorId: string, query: ProjectListQuery, api: ProjectApi, enabled = true) {
  return { queryKey: projectKeys.list(actorId, query), queryFn: ({ signal }: { signal: AbortSignal }) => api.list(query, signal), staleTime: 15_000, retry: retryTransient, enabled } as const;
}
export function projectDetailOptions(actorId: string, id: string, api: ProjectApi) {
  return { queryKey: projectKeys.detail(actorId, id), queryFn: ({ signal }: { signal: AbortSignal }) => api.detail(id, signal), staleTime: 15_000, retry: retryTransient } as const;
}
export function projectPreviewOptions(actorId: string, id: string, api: ProjectApi) {
  return { queryKey: projectKeys.preview(actorId, id), queryFn: ({ signal }: { signal: AbortSignal }) => api.preview(id, signal), staleTime: 0, retry: retryTransient } as const;
}
export function projectMonthsOptions(actorId: string, id: string, api: ProjectApi) {
  return { queryKey: projectKeys.months(actorId, id), queryFn: ({ signal }: { signal: AbortSignal }) => api.months(id, signal), staleTime: 15_000, retry: retryTransient } as const;
}
export function projectSpecialDatesOptions(actorId: string, id: string, api: ProjectApi) {
  return { queryKey: projectKeys.specialDates(actorId, id), queryFn: ({ signal }: { signal: AbortSignal }) => api.specialDates(id, signal), staleTime: 15_000, retry: retryTransient } as const;
}
