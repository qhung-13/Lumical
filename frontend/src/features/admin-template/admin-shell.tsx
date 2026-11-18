'use client';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { usePreferences } from '../../design-system/foundations/preferences-provider';
import { LegacyBrand } from '../../design-system/layouts/legacy-brand';
import legacy from '../../design-system/foundations/legacy-ui.module.css';
import { formatTemplateAdmin, type TemplateAdminKey } from '../../i18n/admin-templates';
import { IconTemplates } from './icons';
import styles from './admin-template.module.css';

export interface AdminShellProps {
  readonly adminEmail?: string;
  readonly children: ReactNode;
}
export function AdminShell({ adminEmail, children }: AdminShellProps) {
  const { locale } = usePreferences();
  const t = (key: TemplateAdminKey) => formatTemplateAdmin(locale, key);
  return (
    <div className={`${legacy.theme} ${styles.shell}`}>
      <a className={styles.skip} href="#main" tabIndex={0}>{t('skip')}</a>
      <aside className={styles.sidebar}>
        <Link href="/" className={styles.brand}>
          <LegacyBrand inverse />
          <span className={styles.brandArea}>{t('adminArea')}</span>
        </Link>
        <nav aria-label={t('navGroup')}>
          <ul className={styles.nav}>
            <li><Link href="/admin/templates" className={styles.navBtn} aria-current="location"><IconTemplates size={16} /> {t('navTemplates')}</Link></li>
          </ul>
        </nav>
        <div className={styles.sidebarFoot}>
          <p className={styles.who}>{adminEmail ?? ''}</p>
          <p className={styles.whoRole}>{t('role')}</p>
        </div>
      </aside>
      <main className={styles.main} id="main" tabIndex={-1}>{children}</main>
    </div>
  );
}

export interface PageHeaderProps {
  readonly eyebrow?: string;
  readonly title: string;
  readonly description: string;
  /** Breadcrumb entries; the last is rendered as the current page. */
  readonly crumbs?: readonly { readonly label: string; readonly href?: string }[];
  readonly onRefresh?: () => void;
  readonly caption?: string;
  /** Extra header controls (primary action, locale switcher). */
  readonly actions?: ReactNode;
}

export function PageHeader({ eyebrow, title, description, crumbs, onRefresh, caption, actions }: PageHeaderProps) {
  const { locale } = usePreferences();
  const t = (key: TemplateAdminKey) => formatTemplateAdmin(locale, key);
  return (
    <header className={styles.header}>
      <div>
        <p className={styles.eyebrow}>{eyebrow ?? t('eyebrow')}</p>
        {crumbs && crumbs.length > 0 && (
          <nav className={styles.breadcrumb} aria-label="Breadcrumb">
            <ol className={styles.breadcrumbList}>
              {crumbs.map((crumb, index) => (
                <li key={`${crumb.label}-${index}`}>
                  {crumb.href
                    ? <a className={styles.breadcrumbLink} href={crumb.href}>{crumb.label}</a>
                    : <span className={styles.breadcrumbCurrent} aria-current="page">{crumb.label}</span>}
                  {index < crumbs.length - 1 && <span className={styles.breadcrumbSep}> / </span>}
                </li>
              ))}
            </ol>
          </nav>
        )}
        <h1 className={styles.title}>{title}</h1>
        <p className={styles.desc}>{description}</p>
      </div>
      <div className={styles.headerActions}>
        {actions}
        {onRefresh && (
          <button type="button" className={`${styles.btn} ${styles.btnSecondary}`} onClick={onRefresh}>
            {t('refresh')}
          </button>
        )}
        {caption && <p className={styles.caption}>{caption}</p>}
      </div>
    </header>
  );
}
