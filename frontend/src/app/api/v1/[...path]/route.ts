import { randomUUID } from 'node:crypto';
import { isIP } from 'node:net';
import { backendFetch, backendOrigin, demoGatewayEnabled } from '../../../../lib/backend-transport';

export const dynamic = 'force-dynamic';

const requestHeaders = [
  'accept', 'content-type', 'cookie', 'origin', 'x-csrf-token', 'idempotency-key', 'if-match', 'if-none-match',
];
const responseHeaders = [
  'content-type', 'etag', 'x-request-id', 'retry-after', 'x-content-type-options',
];

async function proxy(request: Request) {
  const cache = { 'Cache-Control': 'private, no-store' };
  if (!demoGatewayEnabled()) return new Response(null, { status: 404, headers: cache });
  try {
    const url = new URL(request.url);
    const path = url.pathname;
    if (!path.startsWith('/api/v1/')) return new Response(null, { status: 404, headers: cache });

    const headers = new Headers();
    for (const name of requestHeaders) {
      const value = request.headers.get(name);
      if (value !== null) headers.set(name, value);
    }
    // Vercel supplies this client address at ingress. Ignore browser-supplied custom headers.
    const clientIp = request.headers.get('x-forwarded-for') ?? '';
    if (process.env.VERCEL === '1' && isIP(clientIp)) headers.set('X-LumiCal-Client-IP', clientIp);
    const upstream = await backendFetch(new URL(path + url.search, backendOrigin()), {
      method: request.method,
      headers,
      body: request.body === null ? undefined : await request.arrayBuffer(),
      signal: AbortSignal.timeout(75_000),
    });
    const outgoing = new Headers(cache);
    for (const name of responseHeaders) {
      const value = upstream.headers.get(name);
      if (value !== null) outgoing.set(name, value);
    }
    for (const cookie of upstream.headers.getSetCookie()) outgoing.append('Set-Cookie', cookie);
    return new Response(upstream.body, { status: upstream.status, headers: outgoing });
  } catch {
    const requestId = randomUUID();
    return Response.json({
      error: { code: 'PROVIDER_UNAVAILABLE', messageKey: 'errors.unavailable', requestId, retryable: true, fieldErrors: [] },
    }, { status: 502, headers: { ...cache, 'X-Request-Id': requestId } });
  }
}

export { proxy as GET, proxy as POST, proxy as PUT, proxy as DELETE, proxy as HEAD };
