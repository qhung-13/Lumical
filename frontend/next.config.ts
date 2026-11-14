import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // I00 excludes automatically generated agent instruction files.
  agentRules: false,
  // Personal media use authenticated backend streams; disable the shared optimizer.
  images: {
    unoptimized: true,
    localPatterns: [],
    remotePatterns: [],
  },
  // Development HTTP proxy only; Compose/deployed traffic uses the separate gateway.
  async rewrites() {
    if (process.env.NODE_ENV !== 'development') return [];
    const backend = process.env.BACKEND_URL ?? 'http://localhost:3001';
    const url = new URL(backend);
    if (!['http:', 'https:'].includes(url.protocol) || url.origin !== backend || url.username || url.password) throw new Error('Invalid trusted BACKEND_URL.');
    return { beforeFiles: [{ source: '/api/:path*', destination: `${backend}/api/:path*` }] };
  },
  async headers() {
    // The backend supplies the bounded Cloudinary upload URL. Permit only its API origin;
    // provider CORS remains an account-level setting verified separately.
    return [{ source: '/:path*', headers: [{ key: 'Content-Security-Policy', value: "connect-src 'self' https://api.cloudinary.com;" }] }];
  },
};

export default nextConfig;
