'use client';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { defaultPreferences, preferenceCookie, type Locale, type Theme, type PresentationPreferences } from './preferences';

interface PreferenceContext extends PresentationPreferences {
  setLocale: (locale: Locale) => void;
  setTheme: (theme: Theme) => void;
}
const Preferences = createContext<PreferenceContext | undefined>(undefined);
export function PreferencesProvider({ initial = defaultPreferences, children }: { initial?: PresentationPreferences; children: ReactNode }) {
  const [locale, updateLocale] = useState(initial.locale);
  const [theme, updateTheme] = useState(initial.theme);
  useEffect(() => { document.documentElement.lang = locale; document.documentElement.dataset.theme = theme; }, [locale, theme]);
  const setLocale = (value: Locale) => { document.cookie = preferenceCookie('lumical_locale', value); updateLocale(value); };
  const setTheme = (value: Theme) => { document.cookie = preferenceCookie('lumical_theme', value); updateTheme(value); };
  return <Preferences.Provider value={{ locale, theme, setLocale, setTheme }}>{children}</Preferences.Provider>;
}
export function usePreferences() {
  const value = useContext(Preferences);
  if (!value) throw new Error('PreferencesProvider is required');
  return value;
}
