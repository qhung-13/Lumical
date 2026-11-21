import { randomBytes } from 'node:crypto';
import type { Request, Response } from 'express';
import { gatewayAuthentication, requestClientAddress } from './gateway-authentication';

describe('Authenticated server gateway boundary', () => {
  const original = { ...process.env };
  const key = randomBytes(32).toString('hex');
  beforeEach(() => { process.env.LUMICAL_GATEWAY_KEY = key; });
  afterEach(() => { process.env = { ...original }; });
  function call(headers: Record<string, string> = {}, path = '/api/v1/auth/login', method = 'POST') {
    const req = { headers, path, method, ip: '127.0.0.9', get: (name: string) => headers[name.toLowerCase()] } as Request;
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn(), getHeader: () => 'test-id' } as unknown as Response;
    const next = jest.fn(); gatewayAuthentication()(req, res, next);
    return { req, res, next };
  }
  it('rejects direct requests and spoofed IP chains before business handlers', () => {
    for (const supplied of [undefined, 'wrong', randomBytes(32).toString('hex'), `${key},${key}`]) {
      const { res, next } = call({ ...(supplied ? { 'x-lumical-gateway-key': supplied } : {}), 'x-forwarded-for': '198.51.100.7', 'x-lumical-client-ip': '198.51.100.7' });
      expect(res.status).toHaveBeenCalledWith(403); expect(next).not.toHaveBeenCalled();
      expect(JSON.stringify((res.json as jest.Mock).mock.calls)).not.toContain(key);
    }
  });
  it('accepts only authenticated single IP metadata and removes credentials', () => {
    const { req, next } = call({ 'x-lumical-gateway-key': key, 'x-lumical-client-ip': '::ffff:198.51.100.7', 'x-forwarded-for': '203.0.113.99' });
    expect(next).toHaveBeenCalled(); expect(requestClientAddress(req)).toBe('198.51.100.7');
    expect(req.headers['x-lumical-gateway-key']).toBeUndefined(); expect(req.headers['x-lumical-client-ip']).toBeUndefined();
    for (const address of ['', '198.51.100.7, 203.0.113.1', 'unknown']) {
      const result = call({ 'x-lumical-gateway-key': key, 'x-lumical-client-ip': address });
      expect(result.res.status).toHaveBeenCalledWith(400); expect(result.next).not.toHaveBeenCalled();
    }
    expect(call({ 'x-lumical-gateway-key': key }).next).not.toHaveBeenCalled();
    expect(call({ 'x-lumical-gateway-key': key }, '/api/v1/auth/session', 'GET').next).toHaveBeenCalled();
  });
  it('exempts only exact operational health reads', () => {
    for (const path of ['/api/v1/health', '/api/v1/health/live', '/api/v1/health/ready']) expect(call({}, path, 'GET').next).toHaveBeenCalled();
    for (const path of ['/api/v1/health/other', '/api/v1/templates', '/api/v1/openapi.json', '/api/v1/auth/session']) expect(call({}, path, 'GET').next).not.toHaveBeenCalled();
    expect(call({}, '/api/v1/health/live', 'POST').next).not.toHaveBeenCalled();
  });
  it('fails startup on Render without a strong key and preserves the existing Compose mode', () => {
    process.env.RENDER = 'true'; delete process.env.LUMICAL_GATEWAY_KEY;
    expect(() => gatewayAuthentication()).toThrow('Invalid server gateway configuration.');
    process.env.LUMICAL_GATEWAY_KEY = 'a'.repeat(64); expect(() => gatewayAuthentication()).toThrow();
    delete process.env.LUMICAL_GATEWAY_KEY; delete process.env.RENDER;
    expect(call().next).toHaveBeenCalled();
  });
});
