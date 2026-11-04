'use client';
// I04-P04 — template detail: publication (F3), availability control (F4) and
// version-conflict handling (F5). The If-Match version is the one loaded with
// the row and is only ever replaced by a version the server reported — after a
// 412 the banner offers Refresh/Close and nothing is re-sent automatically.
import Link from 'next/link';
import { useMemo } from 'react';
import { skipToken, useQuery, useQueryClient } from '@tanstack/react-query';
import { useIdentity } from '../identity/provider';
import { adminTemplateApi, adminTemplateDetailOptions, adminTemplateKeys, type TemplateAvailability } from '../../api/admin-templates';
import { formatTemplateAdmin, type TemplateAdminKey } from '../../i18n/admin-templates';
import { usePreferences } from '../../design-system/foundations/preferences-provider';
import { AdminShell, LocaleSwitcher, PageHeader } from './admin-shell';
import { AvailabilityPanel } from './availability-panel';
import { ConflictBanner } from './conflict-banner';
import { RevisionForm, toRevisionBody, type RevisionDraft } from './revision-form';
import { useAdminCommand, useTemplateIntent } from './use-admin-command';
import { IntentReview } from './intent-review';
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
  const { manager, state: session } = useIdentity();
  const actorId = session.principal?.id;
  const api = useMemo(() => adminTemplateApi({ csrf: () => manager.csrfToken() }), [manager]);
  const queries = useQueryClient();
  const options = adminTemplateDetailOptions(actorId ?? 'anonymous', templateId, api);
  const detail = useQuery({ ...options, queryFn: actorId ? options.queryFn : skipToken });
  const command = useAdminCommand();
  const publication = useTemplateIntent(`${actorId}:${templateId}:publish`);
  const availabilityIntent = useTemplateIntent(`${actorId}:${templateId}:availability`);
  const template = detail.data;

  const invalidate = () => {
    if (actorId) void queries.invalidateQueries({ queryKey: adminTemplateKeys.all(actorId) });
  };

  const publish = (draft: RevisionDraft) => {
    if (!template) return;
    const payload = { revision: toRevisionBody(draft), ...(draft.reason ? { reason: draft.reason } : {}) };
    void command.run('revision', async () => {
      const published = await publication.execute(JSON.stringify(payload), template.version,
        (key, version) => api.publish(templateId, payload, key, version));
      if (!published) return;
      // The response is authoritative for the new revision number — never guessed.
      command.success(t('publishedOk', { n: published.publishedRevision ?? 1 }));
      invalidate();
    });
  };

  const setAvailability = (availability: TemplateAvailability, reason: string) => {
    if (!template) return;
    const payload = { availability, reason };
    void command.run('availability', async () => {
      const updated = await availabilityIntent.execute(JSON.stringify(payload), template.version,
        (key, version) => api.availability(templateId, payload, key, version));
      if (!updated) return;
      command.success(t('availOk', { state: t(AVAILABILITY_KEY[availability]) }));
      invalidate();
    });
  };

  /** Conflict refresh: load the version the server has. Entries stay in the form. */
  const refreshVersion = async () => {
    const refreshed = await detail.refetch();
    if (refreshed.isSuccess) command.dismissConflict();
  };

  if (session.phase === 'loading' || (actorId && detail.isPending)) {
    return (
      <AdminShell activeItem="templates" adminEmail={manager.getSnapshot().principal?.email}>
        <PageHeader title={t('detailTitle')} description={t('detailDesc')} actions={<LocaleSwitcher />} />
        <p className={styles.status} role="status" aria-live="polite">{t('savingList')}</p>
      </AdminShell>
    );
  }

  if (!actorId || !template) {
    return (
      <AdminShell activeItem="templates" adminEmail={manager.getSnapshot().principal?.email}>
        <PageHeader title={t('detailTitle')} description={t('detailDesc')} actions={<LocaleSwitcher />}
          onRefresh={detail.isError || session.phase === 'unavailable'
            ? () => void (actorId ? detail.refetch() : manager.bootstrap()) : undefined} />
        <section className={`${styles.banner} ${styles.bannerDanger}`} role="alert">
          <IconAlertCircle size={20} />
          <div>
            <p className={styles.bannerTitle}>{t(session.phase === 'unauthenticated' ? 'unauthenticated'
              : detail.isError || !actorId ? 'unavailable' : 'notFound')}</p>
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

      {detail.isError && <p role="alert" className={styles.status}>{t('unavailable')}</p>}
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
            fieldErrors={command.fieldSource === 'revision' ? command.fieldErrors : []}
            pending={command.pending}
            onSubmit={publish}
            notice={publication.reviewRequired ? <IntentReview onAcknowledge={publication.acknowledgeReview} /> : command.conflict?.source === 'revision' ? (
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
              fieldErrors={command.fieldSource === 'availability' ? command.fieldErrors : []}
              {...(command.conflict?.source === 'availability' ? { conflictVersion: command.conflict.version } : {})}
              onSetAvailability={setAvailability}
              onRefreshVersion={refreshVersion}
              notice={availabilityIntent.reviewRequired ? <IntentReview onAcknowledge={availabilityIntent.acknowledgeReview} /> : undefined}
            />
          </div>
        </div>
      </div>
    </AdminShell>
  );
}
