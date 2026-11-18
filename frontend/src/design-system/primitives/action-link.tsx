import Link from 'next/link';
import type { ReactNode } from 'react';
import styles from './controls.module.css';

export function ActionLink({ href, children }: { href: string; children: ReactNode }) {
  return <Link href={href} className={styles.button} data-variant="primary" data-size="lg" tabIndex={0}>{children}</Link>;
}
