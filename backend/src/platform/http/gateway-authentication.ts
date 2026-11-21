import { timingSafeEqual } from 'node:crypto';
import type { Request, Response, NextFunction } from 'express';
import { canonicalIp } from './client-address';

const verifiedIPs = new WeakMap<Request, string>();

export function requestClientAddress(req: Request): string {
  return verifiedIPs.get(req) ?? req.ip ?? req.socket.remoteAddress ?? 'unknown';
}

// Optional for the private socket-based Compose topology; mandatory on Render.
// Authenticate application metadata, never Render's changing socket/XFF chain.
export function gatewayAuthentication() {
  const key = process.env.LUMICAL_GATEWAY_KEY;
  if ((process.env.RENDER === 'true' || key !== undefined) &&
      (!key || !/^[a-f0-9]{64}$/i.test(key) || /^([a-f0-9])\1+$/i.test(key))) {
    throw new Error('Invalid server gateway configuration.');
  }
  const expected = key ? Buffer.from(key, 'hex') : undefined;
  return (req: Request, res: Response, next: NextFunction) => {
    if (!expected) return next();
    // Only exact operational health reads bypass the gateway credential.
    if (['GET', 'HEAD'].includes(req.method) && /^\/api\/v1\/health(?:\/live|\/ready)?$/.test(req.path)) return next();
    const supplied = req.get('X-Lumical-Gateway-Key');
    if (!supplied || !/^[a-f0-9]{64}$/i.test(supplied) || !timingSafeEqual(Buffer.from(supplied, 'hex'), expected)) {
      res.status(403).json({ error: { code: 'FORBIDDEN', messageKey: 'errors.forbidden', requestId: String(res.getHeader('X-Request-Id')), retryable: false, fieldErrors: [] } });
      return;
    }
    const address = req.get('X-Lumical-Client-IP');
    const canonical = address === undefined ? undefined : canonicalIp(address);
    // SSR session reads have no abuse counter and need no fabricated client IP.
    const sessionRead = ['GET', 'HEAD'].includes(req.method) && req.path === '/api/v1/auth/session';
    if ((address !== undefined && !canonical) || (!canonical && !sessionRead)) {
      res.status(400).json({ error: { code: 'VALIDATION_FAILED', messageKey: 'errors.validation', requestId: String(res.getHeader('X-Request-Id')), retryable: false, fieldErrors: [] } });
      return;
    }
    if (canonical) verifiedIPs.set(req, canonical);
    // Keep credentials out of downstream parsers, controllers, and error objects.
    delete req.headers['x-lumical-gateway-key'];
    delete req.headers['x-lumical-client-ip'];
    next();
  };
}
