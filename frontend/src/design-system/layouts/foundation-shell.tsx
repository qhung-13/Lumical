'use client';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { usePreferences } from '../foundations/preferences-provider';
import { PreferenceControls } from '../foundations/preference-controls';
import { foundationCopy } from '../../i18n/foundation';
import styles from './shell.module.css';

export type FoundationArea = 'public' | 'form' | 'admin';
export function FoundationShell({ area, children }: { area: FoundationArea; children: ReactNode }) {
  const { locale } = usePreferences();
  const copy = foundationCopy[locale];
  return <div className={styles.canvas} data-density={area === 'admin' ? 'admin' : 'public'}>
    <a className={styles.skip} href="#main" tabIndex={0}>{copy.skip}</a>
    <header className={styles.header}>
      <Link className={styles.brand} href="/" aria-label="LumiCal" tabIndex={0}>LumiCal</Link>
      <nav className={styles.navigation} aria-label={copy.navigation}>
        {(['public', 'form', 'admin'] as const).map(item => <Link key={item} tabIndex={0} href={item === 'public' ? '/' : `/foundation/${item}`} aria-current={area === item ? 'page' : undefined}>{copy[item]}</Link>)}
      </nav>
      <PreferenceControls />
    </header>
    <main id="main" tabIndex={-1} className={styles.main}>{children}</main>
    <footer className={styles.footer}>{copy.footer}</footer>
  </div>;
}
