'use client';
// I04-P04 — availability control (F4): three concrete actions, each through a
// dialog that states the operational result and requires an audit reason
// (1..1000). The current state is always shown; ARCHIVED reverses per the
// approved P02 contract. Version conflicts (412) surface as the conflict
// banner inside the dialog — the reason stays typed, nothing is re-sent.
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { usePreferences } from '../../design-system/foundations/preferences-provider';
import type { AdminTemplateData, TemplateAvailability } from '../../api/admin-templates';
import { fieldErrorMessage, formatTemplateAdmin, type TemplateAdminKey } from '../../i18n/admin-templates';
import type { FieldError } from './revision-form';
import { ModalLayer } from './modal-layer';
import { ConflictBanner } from './conflict-banner';
import { IconAlertCircle, IconArchive, IconCheckCircle, IconInfo } from './icons';
import styles from './admin-template.module.css';

const AVAILABILITY_KEY: Record<TemplateAvailability, TemplateAdminKey> = {
  INACTIVE: 'availInactive', ACTIVE: 'availActive', ARCHIVED: 'availArchived',
};

/** What each change means operationally — stated before the admin commits. */
const RESULT_KEY: Record<TemplateAvailability, TemplateAdminKey> = {
  INACTIVE: 'resultInactive',
  ACTIVE: 'resultActive',
  ARCHIVED: 'resultArchived',
};

export interface AvailabilityPanelProps {
  readonly template: AdminTemplateData;
  readonly pending?: boolean;
  readonly notice?: ReactNode;
  /** 412 from the last attempt — version from the load, never re-guessed. */
  readonly conflictVersion?: number;
  /** 422 field errors from backend (F6) scoped to availability command. */
  readonly fieldErrors?: readonly FieldError[];
  readonly onSetAvailability: (availability: TemplateAvailability, reason: string) => void;
  /** Reload the current version (conflict refresh). The typed reason is kept in the dialog. */
  readonly onRefreshVersion: () => void;
}

export function AvailabilityPanel({ template, pending = false, notice, conflictVersion, fieldErrors = [], onSetAvailability, onRefreshVersion }: AvailabilityPanelProps) {
  const { locale } = usePreferences();
  const t = (key: TemplateAdminKey) => formatTemplateAdmin(locale, key);
  const [target, setTarget] = useState<TemplateAvailability | null>(null);
  const [reason, setReason] = useState('');
  const [reasonError, setReasonError] = useState<string | undefined>(undefined);
  const [dismissedServerErrors, setDismissedServerErrors] = useState<readonly FieldError[]>([]);
  const reasonRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => { if (target) reasonRef.current?.focus(); }, [target]);

  const open = (availability: TemplateAvailability) => {
    setTarget(availability);
    setReason('');
    setReasonError(undefined);
  };
  const close = () => { if (!pending) { setTarget(null); setReason(''); setReasonError(undefined); } };

  const confirm = () => {
    const length = Array.from(reason.trim()).length;
    if (length < 1 || length > 1000) { setReasonError(t('errReason')); reasonRef.current?.focus(); return; }
    if (target) onSetAvailability(target, reason.trim());
  };

  const serverReasonError = fieldErrors !== dismissedServerErrors
    ? fieldErrors.find((err) => err.path === 'reason')?.path
    : undefined;
  const activeError = reasonError || (serverReasonError ? fieldErrorMessage(locale, 'reason') : undefined);

  const controls: { availability: TemplateAvailability; label: string }[] = [
    { availability: 'ACTIVE', label: t('activate') },
    { availability: 'INACTIVE', label: t('deactivate') },
    { availability: 'ARCHIVED', label: t('archive') },
  ];

  return (
    <section className={styles.panel} aria-labelledby="availability-heading">
      <h2 className={styles.panelTitle} id="availability-heading">{t('availabilitySection')}</h2>
      <dl className={styles.datalist}>
        <div className={styles.datalistRow}>
          <dt>{t('stateRow')}</dt>
          <dd><span className={`${styles.pill} ${template.availability === 'ACTIVE' ? styles.pillSuccess : template.availability === 'ARCHIVED' ? styles.pillMuted : styles.pillWarning}`}>
            {t(AVAILABILITY_KEY[template.availability])}
          </span></dd>
        </div>
      </dl>
      <p className={styles.note}><IconInfo size={16} />{t('availDesc').replace('{id}', template.id.slice(0, 8))}</p>

      <div className={styles.toolbar}>
        {controls.map(({ availability, label }) => (
          <button
            key={availability}
            type="button"
            className={`${styles.btn} ${availability === 'ACTIVE' ? styles.btnPrimary : availability === 'ARCHIVED' ? styles.btnDangerOutline : styles.btnSecondary}`}
            disabled={template.availability === availability || pending}
            onClick={() => open(availability)}
            data-testid={`availability-${availability.toLowerCase()}`}
          >
            {availability === 'ACTIVE' ? <IconCheckCircle size={18} /> : availability === 'ARCHIVED' ? <IconArchive size={18} /> : <IconInfo size={18} />}
            {label}
          </button>
        ))}
      </div>

      <ModalLayer
        open={target !== null}
        labelledBy="availability-title"
        describedBy="availability-desc"
        initialFocusRef={reasonRef}
        onDismiss={close}
      >
        <h2 className={styles.dialogTitle} id="availability-title">{t('availTitle')}</h2>
        <p className={styles.dialogDesc} id="availability-desc">
          {target && <strong>{t(RESULT_KEY[target])}</strong>}
        </p>
        {conflictVersion !== undefined && (
          <ConflictBanner version={conflictVersion} onRefresh={onRefreshVersion} onClose={close} />
        )}
        {notice}
        <div className={styles.field}>
          <label className={styles.fieldLabel} htmlFor="availability-reason">
            {t('reasonLabel')} <span className={styles.fieldRequired}>({t('reasonRequired')})</span>
          </label>
          <textarea
            className={`${styles.textarea} ${activeError ? styles.textareaInvalid : ''}`}
            id="availability-reason" ref={reasonRef} value={reason} maxLength={1000}
            placeholder={t('availReasonPh')}
            onChange={(event) => {
              setReason(event.target.value);
              setReasonError(undefined);
              setDismissedServerErrors(fieldErrors);
            }}
            aria-describedby={activeError ? 'availability-reason-error' : 'availability-reason-help'}
            aria-invalid={Boolean(activeError) || undefined}
          />
          {!activeError && <p className={styles.fieldHelp} id="availability-reason-help">{t('reasonHelp')}</p>}
          {activeError && (
            <p className={styles.fieldError} id="availability-reason-error" role="alert"><IconAlertCircle size={16} />{activeError}</p>
          )}
        </div>
        <div className={styles.dialogActions}>
          <button type="button" className={`${styles.btn} ${styles.btnSecondary}`} onClick={close} disabled={pending}>{t('cancel')}</button>
          <button type="button" className={`${styles.btn} ${styles.btnPrimary}`} onClick={confirm} disabled={pending} data-testid="availability-confirm">
            {pending ? t('saving') : t('availConfirm')}
          </button>
        </div>
      </ModalLayer>
    </section>
  );
}
