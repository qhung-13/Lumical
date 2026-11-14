import { createServer, request as httpRequest } from 'node:http';
import { request as httpsRequest } from 'node:https';
import { randomUUID } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { isIP } from 'node:net';

function origin(value) {
  const url = new URL(value);
  if (!['http:', 'https:'].includes(url.protocol) || url.origin !== value || url.username || url.password) throw new Error('Invalid trusted proxy origin.');
  return url;
}
const hopHeaders = new Set(['connection','keep-alive','proxy-authenticate','proxy-authorization','te','trailer','transfer-encoding','upgrade']);
const clientHeaders = new Set(['forwarded', 'x-real-ip', 'x-client-ip', 'client-ip', 'true-client-ip', 'cf-connecting-ip', 'fastly-client-ip']);
// Nest's provider-backed media handlers have a 25 s response deadline.
const mediaTimeout = 30_000;
function headers(source) {
  const extra = String(source.connection ?? '').split(',').map(value => value.trim().toLowerCase());
  return Object.fromEntries(Object.entries(source).filter(([name]) => !hopHeaders.has(name.toLowerCase()) && !extra.includes(name.toLowerCase())));
}
// HTTP routing only. Credentials, cookies and business validation belong to Nest.
export function createGateway(backend, frontend) {
  const api = origin(backend); const web = origin(frontend);
  return createServer((req, res) => {
    const requestId = randomUUID();
    if (!req.url?.startsWith('/') || req.url.startsWith('//')) { res.writeHead(400).end(); return; }
    const target = req.url.startsWith('/api/') ? api : web;
    const destination = new URL(req.url, target);
    if (destination.origin !== target.origin) { res.writeHead(400).end(); return; }
    const forwarded = headers(req.headers);
    delete forwarded.host;
    for (const name of Object.keys(forwarded)) if (name.startsWith('x-forwarded-') || clientHeaders.has(name)) delete forwarded[name];
    const clientAddress = req.socket.remoteAddress;
    if (!clientAddress || !isIP(clientAddress)) { res.writeHead(400).end(); return; }
    forwarded['x-forwarded-for'] = clientAddress;
    const providerBackedMedia = /^\/api\/v1\/media\/[^/]+\/(?:content|finalize)\/?$/i.test(destination.pathname);
    const timeout = providerBackedMedia ? mediaTimeout : 15_000;
    const upstream = (target.protocol === 'https:' ? httpsRequest : httpRequest)(destination,
      { method: req.method, headers: forwarded, timeout }, (response) => {
        clearTimeout(responseDeadline);
        response.on('error', () => res.destroy());
        if (res.destroyed) { response.destroy(); return; }
        res.writeHead(response.statusCode ?? 502, headers(response.headers)); response.pipe(res);
      });
    const timeOut = () => upstream.destroy(new Error('Upstream timeout'));
    const responseDeadline = providerBackedMedia ? setTimeout(timeOut, timeout) : undefined;
    upstream.once('close', () => clearTimeout(responseDeadline));
    upstream.on('timeout', timeOut);
    upstream.on('error', () => {
      if (res.destroyed) return;
      if (res.headersSent) { res.destroy(); return; }
      res.writeHead(502, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'X-Request-Id': requestId });
      res.end(JSON.stringify({ error: { code: 'PROVIDER_UNAVAILABLE', messageKey: 'errors.unavailable', requestId, retryable: true, fieldErrors: [] } }));
    });
    req.on('aborted', () => upstream.destroy());
    res.once('close', () => { if (!res.writableFinished) upstream.destroy(); });
    req.pipe(upstream);
  });
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const server = createGateway(process.env.BACKEND_URL, process.env.FRONTEND_URL);
  server.listen(Number(process.env.PORT ?? 3000), '0.0.0.0');
  const shutdown = () => server.close();
  process.on('SIGTERM', shutdown); process.on('SIGINT', shutdown);
}
