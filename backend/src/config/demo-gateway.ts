import { timingSafeEqual } from 'node:crypto';
import { isIP } from 'node:net';
import type { NextFunction, Request, Response } from 'express';

export function demoGateway() {
  const secret = process.env.LUMICAL_GATEWAY_KEY;
  if (secret === undefined && process.env.RENDER !== 'true') return;
  if (!secret || !/^[a-f0-9]{64}$/.test(secret)) {
    throw new Error('Set a valid LUMICAL_GATEWAY_KEY for the demo ingress.');
  }

  const expected = Buffer.from(secret);
  return (req: Request, res: Response, next: NextFunction) => {
    // Render probes reveal only liveness/readiness, never account or catalog data.
    if (['GET', 'HEAD'].includes(req.method) &&
        ['/api/v1/health/live', '/api/v1/health/ready'].includes(req.path)) {
      next();
      return;
    }
    const received = Buffer.from(req.get('X-LumiCal-Gateway-Key') ?? '');
    if (received.length !== expected.length || !timingSafeEqual(received, expected)) {
      res.status(404).end();
      return;
    }
    const address = req.get('X-LumiCal-Client-IP') ?? '';
    res.locals.gatewayClientIp = isIP(address) ? address : 'unknown';
    next();
  };
}
