'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useId, useRef, useState, type ReactNode } from 'react';
import { useIdentity } from '../../features/identity/provider';
import { identityCopy } from '../../i18n/identity';
import { productCopy } from '../../i18n/product';
import { templateCopy } from '../../i18n/templates';
import { usePreferences } from '../foundations/preferences-provider';
import { PreferenceControls } from '../foundations/preference-controls';
import { Button } from '../primitives/button';
import legacy from '../foundations/legacy-ui.module.css';
import { LegacyBrand } from './legacy-brand';
import styles from './public-shell.module.css';

export function PublicShell({ children, fullWidth = false }: { children: ReactNode; fullWidth?: boolean }) {
  const { locale } = usePreferences();
  const { state } = useIdentity();
  const pathname = usePathname();
  const copy = templateCopy[locale];
  const product = productCopy[locale];
  const identity = identityCopy[locale];
  const principal = state.phase === 'authenticated' && state.principal?.accountStatus === 'ACTIVE' ? state.principal : undefined;
  const [menuOpen, setMenuOpen] = useState(false);
  const menuId = useId();
  const trigger = useRef<HTMLButtonElement>(null);
  const links = [
    { href: '/', label: copy.home },
    { href: '/templates', label: copy.catalog, section: '/templates/' },
    { href: '/account', label: product.calendars, section: '/projects/' },
    ...(principal ? [{ href: '/media/upload', label: product.media }] : []),
    ...(principal?.role === 'ADMIN' ? [{ href: '/admin/templates', label: product.admin }] : []),
    ...(!principal ? [{ href: '/login', label: identity.login }, { href: '/register', label: identity.register }] : []),
  ];

  return <div className={`${legacy.theme} ${styles.canvas}`}>
    <a className={styles.skip} href="#main" tabIndex={0}>{copy.skip}</a>
    <header className={styles.header} onKeyDown={event => {
      if (event.key === 'Escape' && menuOpen && trigger.current?.getClientRects().length) {
        setMenuOpen(false);
        trigger.current.focus();
      }
    }}>
      <div className={styles.utility}><div className={styles.container}>
        <span>{product.utility}</span><Link href="/#home-faq">{product.help}</Link>
      </div></div>
      <div className={`${styles.container} ${styles.headerGrid}`}>
        <Link className={styles.brand} href="/" onNavigate={() => setMenuOpen(false)}><LegacyBrand /></Link>
        <Button ref={trigger} variant="outline" className={styles.menuToggle} aria-expanded={menuOpen} aria-controls={menuId}
          onClick={() => setMenuOpen(open => !open)}><span aria-hidden="true">{menuOpen ? '×' : '☰'}</span> {product.menu}</Button>
        <div className={styles.menu} id={menuId} data-open={menuOpen}>
          <nav className={styles.navigation} aria-label={copy.navigation}>
            {links.map(({ href, label, section }) => <Link key={href} href={href} tabIndex={0}
              onNavigate={() => {
                setMenuOpen(false);
                if (pathname === href && menuOpen) trigger.current?.focus();
              }}
              aria-current={pathname === href ? 'page' : section && pathname?.startsWith(section) ? 'location' : undefined}>
              {label}
            </Link>)}
          </nav>
          <div className={styles.toolbar}><PreferenceControls /></div>
        </div>
      </div>
    </header>
    <main id="main" tabIndex={-1} className={fullWidth ? styles.fullMain : styles.main}>{children}</main>
    <footer className={styles.footer}>
      <div className={`${styles.container} ${styles.footerGrid}`}>
        <div><LegacyBrand /><p>{copy.footer}</p></div>
        <div><h2>{product.footerProduct}</h2><ul><li><Link href="/templates">{product.footerCatalog}</Link></li><li><Link href="/account">{product.footerAccount}</Link></li></ul></div>
        <div><h2>{product.footerGuide}</h2><ul><li><Link href="/#home-start">{product.footerSteps}</Link></li><li><Link href="/#home-faq">{product.faq}</Link></li></ul></div>
      </div>
      <div className={styles.footerBase}><div className={styles.container}>© LumiCal</div></div>
    </footer>
  </div>;
}
