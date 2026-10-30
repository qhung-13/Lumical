'use client';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { templateCopy } from '../../i18n/templates';
import { usePreferences } from '../foundations/preferences-provider';
import { PreferenceControls } from '../foundations/preference-controls';
import styles from './public-shell.module.css';

export function PublicShell({ children }: { children: ReactNode }) {
  const { locale } = usePreferences();
  const copy = templateCopy[locale];
  return <div className={styles.canvas}>
    <a className={styles.skip} href="#main">{copy.skip}</a>
    <header className={styles.header}>
      <Link className={styles.brand} href="/" aria-label="LumiCal">LumiCal</Link>
      <nav className={styles.navigation} aria-label={copy.navigation}>
        <Link href="/">{copy.home}</Link><Link href="/templates" aria-current="page">{copy.catalog}</Link>
      </nav>
      <PreferenceControls />
    </header>
    <main id="main" tabIndex={-1} className={styles.main}>{children}</main>
    <footer className={styles.footer}>{copy.footer}</footer>
  </div>;
}
