'use client';
// I04-P04 — Admin chrome (sidebar shell + page header), following the I13 admin
// design. Locale comes from the shared preferences provider (the approved dev
// pattern); the nav is presentation only — permission stays with the backend.
import type { ReactNode } from 'react';
import { usePreferences } from '../../design-system/foundations/preferences-provider';
import { formatTemplateAdmin, type TemplateAdminKey, type TemplateAdminLocale } from '../../i18n/admin-templates';
import { IconBell, IconOrders, IconTemplates, IconUsers } from './icons';
import styles from './admin-template.module.css';

export interface AdminShellProps {
  readonly activeItem?: 'orders' | 'templates' | 'users' | 'notifications';
  readonly adminEmail?: string;
  readonly children: ReactNode;
}

export function AdminShell({ activeItem = 'templates', adminEmail, children }: AdminShellProps) {
  const { locale } = usePreferences();
  const t = (key: TemplateAdminKey) => formatTemplateAdmin(locale, key);
  const items = [
    { id: 'templates' as const, label: t('navTemplates'), Icon: IconTemplates, available: true },
    { id: 'orders' as const, label: t('navOrders'), Icon: IconOrders, available: false },
    { id: 'users' as const, label: t('navUsers'), Icon: IconUsers, available: false },
    { id: 'notifications' as const, label: t('navNotifications'), Icon: IconBell, available: false },
  ];

  return (
    <div className={styles.shell}>
      <a className={styles.skip} href="#main" tabIndex={0}>{t('skip')}</a>
      <aside className={styles.sidebar}>
        <div className={styles.brand}>
          <span className={styles.brandMark}>{t('brand')}</span>
          <span className={styles.brandArea}>{t('adminArea')}</span>
        </div>
        <nav aria-label={t('navGroup')}>
          <ul className={styles.nav}>
            {items.map(({ id, label, Icon, available }) => (
              <li key={id}>
                <button
                  type="button"
                  className={`${styles.navBtn} ${activeItem === id ? styles.navBtnActive : ''}`}
                  aria-current={activeItem === id ? 'page' : undefined}
                  disabled={!available && activeItem !== id}
                >
                  <Icon size={20} />
                  {label}
                </button>
              </li>
            ))}
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

/** Locale switcher for the admin header (VI/EN). Presentation only. */
export function LocaleSwitcher() {
  const { locale, setLocale } = usePreferences();
  return (
    <label className={styles.selectWrap}>
      <span className={styles.vh}>Language</span>
      <select
        aria-label="Language"
        value={locale}
        onChange={(event) => setLocale(event.target.value as TemplateAdminLocale)}
      >
        <option value="en" lang="en">English</option>
        <option value="vi" lang="vi">Tiếng Việt</option>
      </select>
    </label>
  );
}
