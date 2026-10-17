export type Locale = 'en' | 'vi';
export type Theme = 'system' | 'light' | 'dark';
export interface PresentationPreferences { locale: Locale; theme: Theme }
export const defaultPreferences: PresentationPreferences = { locale: 'en', theme: 'system' };
export function presentationPreferences(locale?: string, theme?: string): PresentationPreferences {
  return { locale: locale === 'vi' ? 'vi' : 'en', theme: theme === 'light' || theme === 'dark' ? theme : 'system' };
}
// Only these enum values can cross the non-sensitive presentation cookie boundary.
export function preferenceCookie(name: 'lumical_locale' | 'lumical_theme', value: Locale | Theme): string {
  const permitted = name === 'lumical_locale' ? ['en', 'vi'] : ['system', 'light', 'dark'];
  if (!permitted.includes(value)) throw new Error('Invalid presentation preference');
  return `${name}=${value}; Path=/; SameSite=Lax; Max-Age=31536000`;
}
