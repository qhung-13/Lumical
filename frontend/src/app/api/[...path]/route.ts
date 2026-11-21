import { forwardApiRequest } from '../../../../../infra/next-gateway.mjs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

function gateway(request: Request) {
  return forwardApiRequest(request, {
    backend: process.env.BACKEND_URL,
    gatewayKey: process.env.LUMICAL_GATEWAY_KEY,
    vercel: process.env.VERCEL === '1',
  });
}

export { gateway as GET, gateway as HEAD, gateway as POST, gateway as PUT, gateway as PATCH, gateway as DELETE, gateway as OPTIONS };
