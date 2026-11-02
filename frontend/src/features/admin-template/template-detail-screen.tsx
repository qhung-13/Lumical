'use client';
// I04-P04 — template detail: publication (F3), availability control (F4) and
// version-conflict handling (F5). The If-Match version is the one loaded with
// the row and is only ever replaced by a version the server reported — after a
// 412 the banner offers Refresh/Close and nothing is re-sent automatically.
import Link from 'next/link';
import { useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useIdentity } from '../identity/provider';
import { adminTemplateApi, adminTemplateDetailOptions, type TemplateAvailability } from '../../api/admin-templates';
import { formatTemplateAdmin, type TemplateAdminKey } from '../../i18n/admin-templates';
import { usePreferences } from '../../design-system/foundations/preferences-provider';
import { AdminShell, LocaleSwitcher, PageHeader } from './admin-shell';
import { AvailabilityPanel } from './availability-panel';
import { ConflictBanner } from './conflict-banner';
import { RevisionForm, toRevisionBody, type RevisionDraft } from './revision-form';
import { useAdminCommand } from './use-admin-command';
import { IconAlertCircle, IconCheckCircle } from './icons';
import styles from './admin-template.module.css';

const AVAILABILITY_KEY: Record<TemplateAvailability, TemplateAdminKey> = {
  INACTIVE: 'availInactive', ACTIVE: 'availActive', ARCHIVED: 'availArchived',
};
const CATEGORY_KEY: Record<'GENERAL' | 'BIRTHDAY' | 'ANNIVERSARY' | 'HOLIDAY', TemplateAdminKey> = {
  GENERAL: 'catGeneral', BIRTHDAY: 'catBirthday', ANNIVERSARY: 'catAnniversary', HOLIDAY: 'catHoliday',
};

export interface TemplateDetailScreenProps {
  readonly templateId: string;
}

export function TemplateDetailScreen({ templateId }: TemplateDetailScreenProps) {
  const { locale } = usePreferences();
  const t = (key: TemplateAdminKey, vars?: Record<string, string | number>) => formatTemplateAdmin(locale, key, vars);
  const { manager } = useIdentity();
  const api = useMemo(() => adminTemplateApi({ csrf: () => manager.csrfToken() }), [manager]);
  const queries = useQueryClient();
  const detail = useQuery(adminTemplateDetailOptions(templateId, api));
  const command = useAdminCommand();
  const template = detail.data;

  const invalidate = () => {
    void queries.invalidateQueries({ queryKey: ['admin-templates'] });
  };

  const publish = (draft: RevisionDraft) => {
    if (!template) return;
    const key = crypto.randomUUID();
    void command.run('revision', async () => {
      const published = await api.publish(templateId, { revision: toRevisionBody(draft), ...(draft.reason ? { reason: draft.reason } : {}) }, key, template.version);
      // The response is authoritative for the new revision number — never guessed.
      command.success(t('publishedOk', { n: published.publishedRevision ?? 1 }));
      invalidate();
    });
  };

  const setAvailability = (availability: TemplateAvailability, reason: string) => {
    if (!template) return;
    const key = crypto.randomUUID();
    void command.run('availability', async () => {
      await api.availability(templateId, { availability, reason }, key, template.version);
      command.success(t('availOk', { state: t(AVAILABILITY_KEY[availability]) }));
      invalidate();
    });
  };

  /** Conflict refresh: load the version the server has. Entries stay in the form. */
  const refreshVersion = () => {
    command.dismissConflict();
    void detail.refetch();
  };

  if (detail.isPending) {
    return (
      <AdminShell activeItem="templates" adminEmail={manager.getSnapshot().principal?.email}>
        <PageHeader title={t('detailTitle')} description={t('detailDesc')} actions={<LocaleSwitcher />} />
        <p className={styles.status} role="status" aria-live="polite">{t('savingList')}</p>
      </AdminShell>
    );
  }

  if (detail.isError || !template) {
    return (
      <AdminShell activeItem="templates" adminEmail={manager.getSnapshot().principal?.email}>
        <PageHeader title={t('detailTitle')} description={t('detailDesc')} actions={<LocaleSwitcher />} />
        <section className={`${styles.banner} ${styles.bannerDanger}`} role="alert">
          <IconAlertCircle size={20} />
          <div>
            <p className={styles.bannerTitle}>{detail.isError ? t('unavailable') : t('notFound')}</p>
            <Link className={`${styles.btn} ${styles.btnSecondary}`} href="/admin/templates">{t('crumbTemplates')}</Link>
          </div>
        </section>
      </AdminShell>
    );
  }

  return (
    <AdminShell activeItem="templates" adminEmail={manager.getSnapshot().principal?.email}>
      <PageHeader
        title={`${t('detailTitle')} · ${template.id.slice(0, 8)}`}
        description={t('detailDesc')}
        crumbs={[{ label: t('crumbTemplates'), href: '/admin/templates' }, { label: t('crumbDetail') }]}
        caption={t('currentVersionIs', { version: template.version })}
        onRefresh={() => void detail.refetch()}
        actions={<LocaleSwitcher />}
      />

      {command.notice && (
        <div className={`${styles.banner} ${command.notice.tone === 'success' ? styles.bannerSuccess : styles.bannerDanger}`}
          role={command.notice.tone === 'success' ? 'status' : 'alert'} data-testid="command-notice">
          {command.notice.tone === 'success' ? <IconCheckCircle size={20} /> : <IconAlertCircle size={20} />}
          <p className={styles.bannerTitle}>{command.notice.message}</p>
        </div>
      )}

      <div className={styles.content}>
        <div>
          <RevisionForm
            mode="publish"
            fieldErrors={command.fieldErrors}
            pending={command.pending}
            onSubmit={publish}
            notice={command.conflict?.source === 'revision' ? (
              <ConflictBanner version={command.conflict.version} onRefresh={refreshVersion} onClose={command.dismissConflict} />
            ) : undefined}
          />
        </div>

        <div>
          <section className={styles.panel} aria-labelledby="template-info-heading">
            <h2 className={styles.panelTitle} id="template-info-heading">{t('detailTitle')}</h2>
            <dl className={styles.datalist}>
              <div className={styles.datalistRow}>
                <dt>{t('thCategory')}</dt>
                <dd>{t(CATEGORY_KEY[template.category])}</dd>
              </div>
              <div className={styles.datalistRow}>
                <dt>{t('versionRow')}</dt>
                <dd className={styles.num}>{t('versionLabel', { n: template.version })}</dd>
              </div>
              <div className={styles.datalistRow}>
                <dt>{t('publishedRow')}</dt>
                <dd className={styles.num}>
                  {template.publishedRevision === null ? t('neverPublished') : t('publishedRev', { n: template.publishedRevision })}
                </dd>
              </div>
            </dl>
            <p className={styles.note}>{t('publishDesc')}</p>
          </section>

          <div style={{ marginTop: 24 }}>
            <AvailabilityPanel
              template={template}
              pending={command.pending}
              {...(command.conflict?.source === 'availability' ? { conflictVersion: command.conflict.version } : {})}
              onSetAvailability={setAvailability}
              onRefreshVersion={refreshVersion}
            />
          </div>
        </div>
      </div>
    </AdminShell>
  );
}
