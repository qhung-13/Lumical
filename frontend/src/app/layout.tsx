import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import { headers } from 'next/headers';
import { IdentityProvider } from '../features/identity/provider';
import { serverBootstrap } from '../lib/session-bootstrap';

export const metadata: Metadata = {
  title: "LumiCal | Foundation",
  description: "LumiCal university project application foundation.",
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  const request = await headers();
  const cookieName = process.env.NODE_ENV === 'development' && process.env.ACCOUNT_COOKIE_NAME === 'lumical_session_dev'
    ? 'lumical_session_dev' : '__Host-lumical_session';
  const initial = await serverBootstrap(request.get('cookie'), process.env.BACKEND_URL ?? 'http://localhost:3001', cookieName);
  return (
    <html lang="en">
      <body><IdentityProvider initial={initial}>{children}</IdentityProvider></body>
    </html>
  );
}
