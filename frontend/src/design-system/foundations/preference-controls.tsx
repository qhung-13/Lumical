'use client';
import { useId } from 'react';
import { foundationCopy } from '../../i18n/foundation';
import { usePreferences } from './preferences-provider';
import { presentationPreferences } from './preferences';
import styles from '../layouts/shell.module.css';
export function PreferenceControls() {
  const { locale, theme, setLocale, setTheme } = usePreferences();
  const copy = foundationCopy[locale];
  const id = useId();
  return <div className={styles.preferences} role="group" aria-label={copy.preferences}>
    <div className={styles.preferenceField}><label htmlFor={`${id}-locale`}>{copy.language}</label><select id={`${id}-locale`} value={locale} onChange={event => setLocale(presentationPreferences(event.target.value).locale)}>
      <option value="en" lang="en">English</option><option value="vi" lang="vi">Tiếng Việt</option>
    </select></div>
    <div className={styles.preferenceField}><label htmlFor={`${id}-theme`}>{copy.theme}</label><select id={`${id}-theme`} value={theme} onChange={event => setTheme(presentationPreferences(locale, event.target.value).theme)}>
      <option value="system">{copy.system}</option><option value="light">{copy.light}</option><option value="dark">{copy.dark}</option>
    </select></div>
  </div>;
}
