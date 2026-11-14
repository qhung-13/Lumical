import type { components } from './generated';

export type MediaCategory = components['schemas']['UploadCreateDto']['category'];
export type UploadCreate = components['schemas']['UploadCreateDto'];
export type UploadIntent = components['schemas']['UploadIntentDto'];
export type OwnedMedia = components['schemas']['OwnedMediaDto'];
type FinalizeResult =
  | { status: 200; data: components['schemas']['FinalizedMediaDto'] }
  | { status: 202; data: components['schemas']['PendingMediaDto'] };

export class MediaApiError extends Error {
  constructor(readonly code: string, readonly status: number, readonly messageKey?: string, readonly retryable = false,
    readonly retryAt?: number) {
    super(code);
    this.name = 'MediaApiError';
  }
}

export class ProviderUploadError extends Error {
  constructor(readonly status?: number, readonly uncertain = false) {
    super('PROVIDER_UPLOAD_FAILED');
    this.name = 'ProviderUploadError';
  }
}

function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new MediaApiError('PROVIDER_UNAVAILABLE', 502);
  return value as Record<string, unknown>;
}
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const category = (value: unknown): value is MediaCategory => value === 'IMAGE' || value === 'VIDEO' || value === 'AUDIO';

function parseIntent(value: unknown): UploadIntent {
  const data = object(object(value).data);
  const upload = object(data.upload);
  const fields = object(upload.fields);
  if (typeof data.assetId !== 'string' || !uuid.test(data.assetId) || typeof upload.url !== 'string' ||
      !(upload.expiresAt && typeof upload.expiresAt === 'string' && Number.isFinite(Date.parse(upload.expiresAt))) ||
      Object.values(fields).some(item => typeof item !== 'string')) throw new MediaApiError('PROVIDER_UNAVAILABLE', 502);
  return { assetId: data.assetId, upload: { url: upload.url, fields: fields as Record<string, string>, expiresAt: upload.expiresAt } };
}

function parseMedia(value: unknown, expectedId: string): OwnedMedia {
  const data = object(object(value).data);
  const status = data.status;
  const verifiedBytesValid = data.verifiedBytes === null || (typeof data.verifiedBytes === 'number' && Number.isSafeInteger(data.verifiedBytes) && data.verifiedBytes > 0);
  if (data.id !== expectedId || !category(data.category) ||
      !['PENDING', 'READY', 'UNAVAILABLE'].includes(String(status)) || !verifiedBytesValid ||
      (status === 'READY' && (typeof data.verifiedBytes !== 'number' || typeof data.contentPath !== 'string')) ||
      (data.durationSeconds !== undefined && (typeof data.durationSeconds !== 'number' || !Number.isFinite(data.durationSeconds) || data.durationSeconds <= 0 || data.durationSeconds > 60)) ||
      (data.contentPath !== undefined && data.contentPath !== `/api/v1/media/${expectedId}/content`)) {
    throw new MediaApiError('PROVIDER_UNAVAILABLE', 502);
  }
  if (data.status !== 'READY' && data.contentPath !== undefined) throw new MediaApiError('PROVIDER_UNAVAILABLE', 502);
  return data as unknown as OwnedMedia;
}

function retryDeadline(value: string | null): number | undefined {
  if (!value) return undefined;
  const now = Date.now();
  // The upload endpoint sends delay-seconds. Also accept the standard HTTP-date form.
  if (/^\d+$/.test(value)) {
    const deadline = now + Number(value) * 1000;
    return Number.isSafeInteger(deadline) ? deadline : undefined;
  }
  const date = new Date(value);
  const timestamp = date.getTime();
  return Number.isFinite(timestamp) && date.toUTCString() === value ? Math.max(now, timestamp) : undefined;
}

function parseError(value: unknown, status: number, retryAt?: number): MediaApiError {
  let code = status === 401 ? 'UNAUTHENTICATED' : status === 403 ? 'FORBIDDEN' : status === 404 ? 'NOT_FOUND' :
    status === 409 ? 'CONFLICT' : status === 422 ? 'VALIDATION_FAILED' : status === 429 ? 'RATE_LIMITED' : 'PROVIDER_UNAVAILABLE';
  let messageKey: string | undefined;
  let retryable = status >= 500 || status === 429;
  try {
    const error = object(object(value).error);
    if (typeof error.code === 'string' && /^[A-Z_]{1,64}$/.test(error.code)) code = error.code;
    if (typeof error.messageKey === 'string' && /^[a-zA-Z0-9_.-]{1,100}$/.test(error.messageKey)) messageKey = error.messageKey;
    if (typeof error.retryable === 'boolean') retryable = error.retryable;
  } catch { /* Keep only safe status defaults. */ }
  return new MediaApiError(code, status, messageKey, retryable, retryAt);
}

function cloudinaryUploadUrl(value: string, mediaCategory: MediaCategory): boolean {
  try {
    const url = new URL(value);
    const resource = mediaCategory === 'IMAGE' ? 'image' : 'video';
    return url.protocol === 'https:' && url.hostname === 'api.cloudinary.com' && !url.port && !url.username && !url.password &&
      !url.search && !url.hash && new RegExp(`^/v1_1/[a-z0-9_-]+/${resource}/upload$`, 'i').test(url.pathname);
  } catch { return false; }
}

export interface MediaApiOptions {
  csrf: () => string | undefined;
  epoch: () => number;
  unauthorized: () => Promise<void>;
  fetcher?: typeof fetch;
  uploader?: typeof uploadToProvider;
}

export function uploadToProvider(intent: UploadIntent, file: File, mediaCategory: MediaCategory,
  onProgress: (percentage: number) => void, signal: AbortSignal): Promise<void> {
  if (!cloudinaryUploadUrl(intent.upload.url, mediaCategory)) return Promise.reject(new ProviderUploadError(undefined, false));
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const form = new FormData();
    for (const [key, value] of Object.entries(intent.upload.fields)) {
      if (key.toLowerCase() === 'file') { reject(new ProviderUploadError(undefined, false)); return; }
      form.append(key, value);
    }
    form.append('file', file, file.name);
    const abort = () => xhr.abort();
    xhr.open('POST', intent.upload.url);
    xhr.timeout = 180000;
    xhr.responseType = 'text';
    xhr.upload.onprogress = event => { if (event.lengthComputable && event.total > 0) onProgress(Math.min(100, Math.round(event.loaded / event.total * 100))); };
    xhr.onload = () => {
      signal.removeEventListener('abort', abort);
      if (xhr.status >= 200 && xhr.status < 300) resolve();
      else reject(new ProviderUploadError(xhr.status, xhr.status === 409 || xhr.status >= 500 && xhr.status < 600));
    };
    xhr.onerror = () => { signal.removeEventListener('abort', abort); reject(new ProviderUploadError(undefined, true)); };
    xhr.ontimeout = () => { signal.removeEventListener('abort', abort); reject(new ProviderUploadError(undefined, true)); };
    xhr.onabort = () => { signal.removeEventListener('abort', abort); reject(new DOMException('Upload cancelled', 'AbortError')); };
    if (signal.aborted) { reject(new DOMException('Upload cancelled', 'AbortError')); return; }
    signal.addEventListener('abort', abort, { once: true });
    xhr.send(form);
  });
}

export function mediaApi(options: MediaApiOptions) {
  const fetcher = options.fetcher ?? fetch;
  async function request<T>(path: string, method: 'GET' | 'POST', parse: (value: unknown) => T,
    signal?: AbortSignal, body?: unknown, key?: string, timeoutMs = 15_000): Promise<T> {
    const epoch = options.epoch();
    const headers: Record<string, string> = { Accept: 'application/json' };
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    if (method === 'POST') {
      const csrf = options.csrf();
      if (!csrf) throw new MediaApiError('UNAUTHENTICATED', 401);
      headers['X-CSRF-Token'] = csrf;
      if (key) headers['Idempotency-Key'] = key;
    }
    let response: Response;
    try {
      response = await fetcher(`/api/v1${path}`, { method, credentials: 'same-origin', cache: 'no-store', redirect: 'error', headers,
        signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(timeoutMs)]) : AbortSignal.timeout(timeoutMs),
        ...(body !== undefined ? { body: JSON.stringify(body) } : {}) });
    } catch (error) {
      if ((error as { name?: string })?.name === 'AbortError') throw error;
      throw new MediaApiError('PROVIDER_UNAVAILABLE', 503, undefined, true);
    }
    if (epoch !== options.epoch()) throw new MediaApiError('STALE_RESPONSE', 0);
    if (!response.ok) {
      const retryAt = response.status === 429 ? retryDeadline(response.headers.get('Retry-After')) : undefined;
      if (response.status === 401) await options.unauthorized();
      throw parseError(await response.json().catch(() => ({})), response.status, retryAt);
    }
    let payload: unknown;
    try { payload = await response.json(); } catch { throw new MediaApiError('PROVIDER_UNAVAILABLE', 502); }
    if (epoch !== options.epoch()) throw new MediaApiError('STALE_RESPONSE', 0);
    return parse(payload);
  }
  return {
    initiate: (body: UploadCreate, key: string, signal?: AbortSignal) => request('/media/uploads', 'POST', parseIntent, signal, body, key),
    finalize: async (id: string, key: string, signal?: AbortSignal): Promise<FinalizeResult> => {
      // Leave the gateway time to relay Nest's controlled timeout response.
      const result = await request(`/media/${encodeURIComponent(id)}/finalize`, 'POST', value => object(value), signal, { uploadCompleted: true }, key, 35_000);
      const data = object(result.data);
      if (data.status === 'PENDING' && data.assetId === id) return { status: 202, data: data as unknown as components['schemas']['PendingMediaDto'] };
      if (data.status === 'READY' && data.id === id && category(data.category) && typeof data.verifiedBytes === 'number')
        return { status: 200, data: data as unknown as components['schemas']['FinalizedMediaDto'] };
      throw new MediaApiError('PROVIDER_UNAVAILABLE', 502);
    },
    status: (id: string, signal?: AbortSignal) => request(`/media/${encodeURIComponent(id)}`, 'GET', value => parseMedia(value, id), signal),
    upload: (intent: UploadIntent, file: File, mediaCategory: MediaCategory, onProgress: (percentage: number) => void, signal: AbortSignal) => {
      if (!cloudinaryUploadUrl(intent.upload.url, mediaCategory)) return Promise.reject(new ProviderUploadError(undefined, false));
      return (options.uploader ?? uploadToProvider)(intent, file, mediaCategory, onProgress, signal);
    },
  };
}
export type MediaApi = ReturnType<typeof mediaApi>;
