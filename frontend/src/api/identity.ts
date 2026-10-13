import type { components } from './generated';
export type Principal = components['schemas']['PrincipalDto'];
export type SessionData = components['schemas']['SessionDataDto'];
export type Credentials = components['schemas']['CredentialsDto'];
export type StatusView = components['schemas']['AccountStatusDto'];

export class ApiError extends Error {
  constructor(readonly code: string, readonly status: number, readonly requestId?: string,
    readonly fields: { path: string; messageKey: string }[] = []) { super(code); }
}
function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new ApiError('PROVIDER_UNAVAILABLE', 502);
  return value as Record<string, unknown>;
}
export function parsePrincipal(value: unknown): Principal {
  const data = object(value);
  if (typeof data.id !== 'string' || !/^[a-f0-9-]{36}$/i.test(data.id) || typeof data.email !== 'string' ||
    (data.role !== 'USER' && data.role !== 'ADMIN') || (data.accountStatus !== 'ACTIVE' && data.accountStatus !== 'DISABLED')) throw new ApiError('PROVIDER_UNAVAILABLE', 502);
  return { id: data.id, email: data.email, role: data.role, accountStatus: data.accountStatus };
}
function csrf(value: unknown): string {
  if (typeof value !== 'string' || !/^[a-f0-9]{64}$/.test(value)) throw new ApiError('PROVIDER_UNAVAILABLE', 502);
  return value;
}
export function parseSession(value: unknown): SessionData {
  const data = object(value);
  if (data.authenticated === false) return { authenticated: false };
  if (data.authenticated !== true) throw new ApiError('PROVIDER_UNAVAILABLE', 502);
  const principal = parsePrincipal(data.principal);
  if (principal.accountStatus !== 'ACTIVE') throw new ApiError('PROVIDER_UNAVAILABLE', 502);
  return { authenticated: true, principal, csrfToken: csrf(data.csrfToken) };
}
function parseAuth(value: unknown): SessionData {
  const data = object(value);
  return parseSession({ authenticated: true, principal: data, csrfToken: data.csrfToken });
}
function parseStatus(value: unknown): StatusView {
  const data = object(value);
  if (typeof data.id !== 'string' || typeof data.version !== 'number' || !Number.isSafeInteger(data.version) || data.version < 1 ||
    (data.status !== 'ACTIVE' && data.status !== 'DISABLED')) throw new ApiError('PROVIDER_UNAVAILABLE', 502);
  return { id: data.id, status: data.status, version: data.version };
}
export function identityApi(options: { csrf: () => string | undefined; epoch: () => number; unauthorized: () => Promise<void>; fetcher?: typeof fetch }) {
  const execute = async <T>(path: string, method: string, decode: (data: unknown) => T, body?: unknown, extra?: Record<string, string>, scoped = true): Promise<T> => {
    const epoch = options.epoch();
    const headers: Record<string, string> = { Accept: 'application/json', ...extra };
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    if (method !== 'GET' && options.csrf()) headers['X-CSRF-Token'] = options.csrf()!;
    let response: Response;
    try { response = await (options.fetcher ?? fetch)(`/api/v1${path}`, { method, headers, credentials: 'same-origin', cache: 'no-store',
      redirect: 'error', signal: AbortSignal.timeout(10000), ...(body !== undefined ? { body: JSON.stringify(body) } : {}) }); }
    catch { throw new ApiError('PROVIDER_UNAVAILABLE', 503); }
    if (scoped && epoch !== options.epoch()) throw new ApiError('STALE_RESPONSE', 0);
    if (!response.ok) {
      if (response.status === 401) await options.unauthorized();
      let code = response.status === 401 ? 'UNAUTHENTICATED' : 'PROVIDER_UNAVAILABLE';
      let fields: { path: string; messageKey: string }[] = [];
      try {
        const error = object(object(await response.json()).error);
        if (typeof error.code === 'string' && /^[A-Z_]{1,64}$/.test(error.code)) code = error.code;
        if (Array.isArray(error.fieldErrors)) fields = error.fieldErrors.filter((field) => field && typeof field === 'object' &&
          ['email', 'password', 'reason', 'status'].includes(field.path) && typeof field.messageKey === 'string').map(field => ({ path: field.path, messageKey: field.messageKey }));
      } catch { /* Only the safe default error survives an invalid envelope. */ }
      throw new ApiError(code, response.status, response.headers.get('X-Request-Id') ?? undefined, fields);
    }
    if (response.status === 204) return decode(undefined);
    try {
      const data = decode(object(await response.json()).data);
      if (scoped && epoch !== options.epoch()) throw new ApiError('STALE_RESPONSE', 0);
      return data;
    }
    catch (error) { if (error instanceof ApiError) throw error; throw new ApiError('PROVIDER_UNAVAILABLE', 502); }
  };
  return {
    bootstrap: () => execute('/auth/session', 'GET', parseSession),
    register: (body: Credentials, key: string) => execute('/auth/register', 'POST', parseAuth, body, { 'Idempotency-Key': key }, false),
    login: (body: Credentials) => execute('/auth/login', 'POST', parseAuth, body, undefined, false),
    logout: () => execute('/auth/session', 'DELETE', () => undefined),
    ownAccount: () => execute('/account/me', 'GET', parsePrincipal),
    accountStatus: (id: string) => execute(`/admin/users/${encodeURIComponent(id)}/account-status`, 'GET', parseStatus),
    changeAccountStatus: (id: string, body: components['schemas']['AccountStatusChangeDto'], key: string, etag: string) =>
      execute(`/admin/users/${encodeURIComponent(id)}/account-status`, 'PUT', parseStatus, body, { 'Idempotency-Key': key, 'If-Match': etag }),
  };
}
