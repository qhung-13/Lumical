import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";
// Weight entry points include unicode-range, so browsers fetch only used glyph subsets.
import '@fontsource/be-vietnam-pro/400.css';
import '@fontsource/be-vietnam-pro/600.css';
import '@fontsource/be-vietnam-pro/700.css';
import '@fontsource/baloo-2/700.css';
import { headers } from 'next/headers';
import { IdentityProvider } from '../features/identity/provider';
import { serverBootstrap } from '../lib/session-bootstrap';
import { serverPreferences } from '../lib/presentation-preferences';
import { PreferencesProvider } from '../design-system/foundations/preferences-provider';

export const metadata: Metadata = {
  title: "LumiCal | Foundation",
  description: "LumiCal university project application foundation.",
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  const request = await headers();
  const cookieName = process.env.NODE_ENV === 'development' && process.env.ACCOUNT_COOKIE_NAME === 'lumical_session_dev'
    ? 'lumical_session_dev' : '__Host-lumical_session';
  const initial = await serverBootstrap(request.get('cookie'), process.env.BACKEND_URL ?? 'http://localhost:3001', cookieName);
  const preferences = await serverPreferences();
  return (
    <html lang={preferences.locale} data-theme={preferences.theme}>
      <body><PreferencesProvider initial={preferences}><IdentityProvider initial={initial}>{children}</IdentityProvider></PreferencesProvider></body>
    </html>
  );
}
