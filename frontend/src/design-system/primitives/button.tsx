import type { ButtonHTMLAttributes } from 'react';
import styles from './controls.module.css';

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'destructive';
  size?: 'sm' | 'md' | 'lg';
} & ({ loading: boolean; loadingLabel: string } | { loading?: false; loadingLabel?: string });

export function Button({ variant = 'secondary', size = 'md', loading = false,
  loadingLabel, disabled, children, className = '', type = 'button', tabIndex = 0, ...props }: ButtonProps) {
  // Explicit zero includes buttons in WebKit keyboard navigation; no positive ordering.
  return <><button {...props} type={type} tabIndex={tabIndex} className={`${styles.button} ${className}`}
    data-variant={variant} data-size={size} disabled={disabled || loading} aria-busy={loading || undefined}>
    <span className={styles.buttonLabel} style={{ visibility: loading ? 'hidden' : 'visible' }} aria-hidden={loading || undefined}>{children}</span>
    {loadingLabel && <span className={styles.buttonLabel} style={{ visibility: loading ? 'visible' : 'hidden' }} aria-hidden={!loading}>{loadingLabel}</span>}
    {loading && !loadingLabel && <span className={styles.buttonLabel}>{children}</span>}
  </button>
    {loadingLabel && <span role="status" className={styles.loadingStatus}>{loading ? loadingLabel : ''}</span>}
  </>;
}
