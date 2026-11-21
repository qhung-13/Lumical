import { randomUUID } from 'node:crypto';
import { isIP } from 'node:net';
import { trustedOrigin, transportHeaders, upstreamTimeout, gatewayFailure } from './http-gateway.mjs';

// Deliberate allowlists: never relay caller-selected hosts, forwarding metadata,
// gateway credentials, Vercel internals, or Connection-nominated headers.
const requestHeaders = new Set(['accept', 'content-type', 'content-encoding', 'cookie', 'origin', 'x-csrf-token', 'idempotency-key', 'if-match', 'if-none-match', 'range', 'if-range']);
const responseHeaders = new Set(['content-type', 'content-disposition', 'content-range', 'accept-ranges', 'etag', 'retry-after', 'x-request-id', 'x-content-type-options', 'www-authenticate']);

// HTTP only: the backend owns every business and authorization decision.
export async function forwardApiRequest(request, { backend, gatewayKey, vercel, fetcher = fetch }) {
  const requestId = randomUUID();
  try {
    const target = trustedOrigin(backend);
    // This adapter is only for the deployed HTTPS Vercel -> Render topology.
    // Socket-based Compose and development routing keep their existing transport.
    if (target.protocol !== 'https:' || !vercel || !/^[a-f0-9]{64}$/i.test(gatewayKey ?? '') || /^([a-f0-9])\1+$/i.test(gatewayKey)) throw new Error();
    const incoming = new URL(request.url);
    if (!incoming.pathname.startsWith('/api/') || /%2f|%5c|\\/i.test(incoming.pathname)) throw new Error();
    const destination = new URL(incoming.pathname + incoming.search, target);
    if (destination.origin !== target.origin) throw new Error();
    // Vercel overwrites this header at its edge. Accept one IP, never a chain.
    // No fallback to browser-supplied XFF, X-Real-IP or Cloudflare headers.
    const clientIP = request.headers.get('x-vercel-forwarded-for');
    if (!clientIP || !isIP(clientIP)) throw new Error();
    const clean = transportHeaders(Object.fromEntries(request.headers));
    const headers = new Headers(Object.entries(clean).filter(([name]) => requestHeaders.has(name)));
    headers.set('X-Lumical-Gateway-Key', gatewayKey);
    headers.set('X-Lumical-Client-IP', clientIP);
    const response = await fetcher(destination, {
      method: request.method, headers,
      ...(request.method === 'GET' || request.method === 'HEAD' ? {} : { body: request.body, duplex: 'half' }),
      cache: 'no-store', redirect: 'error',
      signal: AbortSignal.any([request.signal, AbortSignal.timeout(upstreamTimeout(destination.pathname))]),
    });
    const outgoing = new Headers(Object.entries(transportHeaders(Object.fromEntries(response.headers))).filter(([name]) => responseHeaders.has(name)));
    // Fetch decompresses upstream bytes: do not relay content-encoding/length.
    // Never collapse Set-Cookie into a comma-separated value (Expires has commas).
    for (const cookie of response.headers.getSetCookie()) outgoing.append('Set-Cookie', cookie);
    outgoing.set('Cache-Control', 'no-store');
    outgoing.set('CDN-Cache-Control', 'no-store');
    outgoing.set('Vercel-CDN-Cache-Control', 'no-store');
    return new Response(request.method === 'HEAD' ? null : response.body, { status: response.status, headers: outgoing });
  } catch {
    return Response.json(gatewayFailure(requestId), { status: 502, headers: { 'Cache-Control': 'no-store', 'X-Request-Id': requestId } });
  }
}
