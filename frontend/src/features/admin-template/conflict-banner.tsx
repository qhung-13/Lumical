'use client';
// I04-P04 — version-conflict feedback (F5). After a 412 the banner states the
// current version and offers exactly two conscious choices: reload the current
// version, or close and keep the draft. It never auto-resends, never mutates
// the loaded version on its own — "Conflict refresh never silently overwrites
// a reviewed revision."
import { usePreferences } from '../../design-system/foundations/preferences-provider';
import { formatTemplateAdmin, type TemplateAdminKey } from '../../i18n/admin-templates';
import { IconAlertTriangle } from './icons';
import styles from './admin-template.module.css';

export interface ConflictBannerProps {
  readonly version: number;
  readonly onRefresh: () => void;
  readonly onClose: () => void;
}

export function ConflictBanner({ version, onRefresh, onClose }: ConflictBannerProps) {
  const { locale } = usePreferences();
  const t = (key: TemplateAdminKey) => formatTemplateAdmin(locale, key);
  return (
    <div className={`${styles.banner} ${styles.bannerDanger}`} role="alert" data-testid="conflict-banner">
      <IconAlertTriangle size={20} />
      <div>
        <p className={styles.bannerTitle}>{t('conflictTitle')}</p>
        <p className={styles.bannerCopy}>{t('conflictDesc').replace('{version}', String(version))}</p>
        <div className={styles.dialogActions}>
          <button type="button" className={`${styles.btn} ${styles.btnSecondary}`} onClick={onClose} data-testid="conflict-close">
            {t('cancel')}
          </button>
          <button type="button" className={`${styles.btn} ${styles.btnPrimary}`} onClick={onRefresh} data-testid="conflict-refresh">
            {t('refreshVersion')}
          </button>
        </div>
      </div>
    </div>
  );
}
