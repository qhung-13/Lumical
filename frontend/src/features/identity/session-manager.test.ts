import { QueryClient } from '@tanstack/react-query';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError, identityApi } from '../../api/identity';
import { serverBootstrap } from '../../lib/session-bootstrap';
import { SessionManager, privateKey } from './session-manager';

const a = { id: '11111111-1111-4111-8111-111111111111', email: 'a@example.invalid', role: 'USER' as const, accountStatus: 'ACTIVE' as const };
const b = { ...a, id: '22222222-2222-4222-8222-222222222222', email: 'b@example.invalid' };
const token = 'a'.repeat(64);
const body = (data: unknown, status = 200) => new Response(JSON.stringify({ data }), { status, headers: { 'Content-Type': 'application/json' } });
const clients: QueryClient[] = [];
const queryClient = () => { const client = new QueryClient({ defaultOptions: { queries: { retry: false } } }); clients.push(client); return client; };
afterEach(() => { for (const client of clients) client.clear(); clients.length = 0; });
describe('typed identity transport and private session cache', () => {
  it('sends same-origin credentials/no-store, memory CSRF and idempotency only to fixed backend paths', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(body({ ...a, csrfToken: token }));
    const api = identityApi({ csrf: () => token, epoch: () => 0, unauthorized: async () => {}, fetcher });
    await api.register({ email: a.email, password: 'TEST ONLY passphrase' }, 'synthetic-intent-key');
    expect(fetcher).toHaveBeenCalledWith('/api/v1/auth/register', expect.objectContaining({ credentials: 'same-origin', cache: 'no-store', redirect: 'error',
      headers: expect.objectContaining({ 'X-CSRF-Token': token, 'Idempotency-Key': 'synthetic-intent-key' }) }));
  });
  it('switches actors only after clearing private data and keeps CSRF out of query serialization', async () => {
    const client = queryClient();
    const fetcher = vi.fn<typeof fetch>().mockResolvedValueOnce(body({ authenticated: true, principal: a, csrfToken: token }))
      .mockResolvedValueOnce(body({ ...b, csrfToken: 'b'.repeat(64) }));
    const manager = new SessionManager(client, { phase: 'unauthenticated' }, fetcher);
    await manager.bootstrap(); client.setQueryData(privateKey(a.id, 'private-document'), { text: 'actor A only' });
    await manager.authenticate('login', { email: b.email, password: 'TEST ONLY passphrase' }, 'not-used-on-login');
    expect(client.getQueryData(privateKey(a.id, 'private-document'))).toBeUndefined();
    expect(manager.getSnapshot().principal).toEqual(b);
    expect(JSON.stringify(client.getQueryCache().getAll().map(query => query.state.data))).not.toContain(token);
    expect(JSON.stringify(manager.getSnapshot())).not.toContain(token);
  });
  it('logout waits for durable success; an unavailable backend keeps an honest session and cache', async () => {
    const client = queryClient(); const fetcher = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(body({ authenticated: true, principal: a, csrfToken: token }))
      .mockRejectedValueOnce(new Error('do not render raw error'))
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    const manager = new SessionManager(client, { phase: 'unauthenticated' }, fetcher); await manager.bootstrap();
    client.setQueryData(privateKey(a.id, 'private-document'), { text: 'private' });
    await expect(manager.logout()).rejects.toBeInstanceOf(ApiError);
    expect(manager.getSnapshot().phase).toBe('unavailable'); expect(client.getQueryData(privateKey(a.id, 'private-document'))).toBeDefined();
    await manager.logout(); expect(manager.getSnapshot().phase).toBe('unauthenticated'); expect(client.getQueryCache().getAll()).toHaveLength(0);
  });
  it('401/disabled bootstrap clears private state; network failure remains unavailable rather than logged out', async () => {
    const client = queryClient(); const fetcher = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(body({ authenticated: true, principal: a, csrfToken: token }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ error: { code: 'UNAUTHENTICATED' } }), { status: 401 }))
      .mockRejectedValueOnce(new Error('network'));
    const manager = new SessionManager(client, { phase: 'unauthenticated' }, fetcher); await manager.bootstrap();
    client.setQueryData(privateKey(a.id, 'private-document'), 'private');
    await expect(manager.api.ownAccount()).rejects.toMatchObject({ status: 401 });
    expect(manager.getSnapshot().phase).toBe('unauthenticated'); expect(client.getQueryCache().getAll()).toHaveLength(0);
    await manager.bootstrap(); expect(manager.getSnapshot().phase).toBe('unavailable');
  });
  it('rejects delayed JSON from an earlier actor even after the HTTP response arrived', async () => {
    let epoch = 0; let release!: (value: unknown) => void;
    const response = { ok: true, status: 200, json: () => new Promise(resolve => { release = resolve; }) } as Response;
    const api = identityApi({ csrf: () => undefined, epoch: () => epoch, unauthorized: async () => {}, fetcher: vi.fn<typeof fetch>().mockResolvedValue(response) });
    const pending = api.ownAccount(); await Promise.resolve(); await Promise.resolve();
    epoch++; release({ data: a }); await expect(pending).rejects.toMatchObject({ code: 'STALE_RESPONSE' });
  });
  it('detects a cookie/account switch outside this tab before caching the returned principal', async () => {
    const client = queryClient(); const fetcher = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(body({ authenticated: true, principal: a, csrfToken: token }))
      .mockResolvedValueOnce(body(b))
      .mockResolvedValueOnce(body({ authenticated: true, principal: b, csrfToken: 'b'.repeat(64) }));
    const manager = new SessionManager(client, { phase: 'unauthenticated' }, fetcher); await manager.bootstrap();
    client.setQueryData(privateKey(a.id, 'private-document'), 'private A');
    await expect(manager.api.ownAccount()).rejects.toMatchObject({ code: 'STALE_RESPONSE' });
    expect(manager.getSnapshot().principal).toEqual(b); expect(client.getQueryData(privateKey(a.id, 'private-document'))).toBeUndefined();
  });
  it('SSR forwards just the relevant account cookie, uses no-store/trusted origin and returns only safe props', async () => {
    const raw = 'x'.repeat(43); const fetcher = vi.fn<typeof fetch>().mockResolvedValue(body({ authenticated: true, principal: a, csrfToken: token }));
    const result = await serverBootstrap(`other=private; __Host-lumical_session=${raw}; __Host-lumical_recipient=recipient`, 'http://backend:3001', '__Host-lumical_session', fetcher);
    expect(fetcher).toHaveBeenCalledWith(new URL('http://backend:3001/api/v1/auth/session'), expect.objectContaining({ cache: 'no-store', redirect: 'error',
      headers: { Accept: 'application/json', Cookie: `__Host-lumical_session=${raw}` } }));
    expect(result).toEqual({ phase: 'authenticated', principal: a }); expect(JSON.stringify(result)).not.toContain(raw); expect(JSON.stringify(result)).not.toContain(token);
    expect(await serverBootstrap(null, 'http://backend:3001/unsafe-path', '__Host-lumical_session', fetcher)).toEqual({ phase: 'unavailable' });
  });
  it('malformed response is unavailable and never coerced to unauthenticated or cached with private extra fields', async () => {
    const client = queryClient(); const manager = new SessionManager(client, { phase: 'unauthenticated' }, vi.fn<typeof fetch>().mockResolvedValue(body({ authenticated: true, principal: { ...a, passwordHash: 'PRIVATE' } })));
    await manager.bootstrap(); expect(manager.getSnapshot().phase).toBe('unavailable'); expect(client.getQueryCache().getAll()).toHaveLength(0);
  });
});
