import { cookies } from 'next/headers';
import type { Locale } from '../i18n/identity';
export async function identityPreferences(): Promise<{ initialLocale: Locale; initialTheme: string }> {
  const store = await cookies();
  const theme = store.get('lumical_theme')?.value;
  return { initialLocale: store.get('lumical_locale')?.value === 'vi' ? 'vi' : 'en',
    initialTheme: theme && ['system', 'light', 'dark'].includes(theme) ? theme : 'system' };
}
