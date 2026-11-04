'use client';

import { usePreferences } from '../../design-system/foundations/preferences-provider';
import { formatTemplateAdmin } from '../../i18n/admin-templates';
import styles from './admin-template.module.css';

export function IntentReview({ onAcknowledge }: { onAcknowledge: () => void }) {
  const { locale } = usePreferences();
  return (
    <div className={`${styles.banner} ${styles.bannerDanger}`} role="alert">
      <div>
        <p className={styles.bannerTitle}>{formatTemplateAdmin(locale, 'intentReviewTitle')}</p>
        <p className={styles.bannerCopy}>{formatTemplateAdmin(locale, 'intentReviewDesc')}</p>
        <button type="button" className={`${styles.btn} ${styles.btnSecondary}`} onClick={onAcknowledge}>
          {formatTemplateAdmin(locale, 'intentReviewAck')}
        </button>
      </div>
    </div>
  );
}
