'use client';
// I04-P04 — create screen (F2): one revision form, POST /admin/templates with
// Idempotency-Key + CSRF, a fresh template starts INACTIVE. On 201 the admin is
// taken to the new template's detail page; failures keep every entered value.
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMemo } from 'react';
import { useIdentity } from '../identity/provider';
import { adminTemplateApi } from '../../api/admin-templates';
import { formatTemplateAdmin, type TemplateAdminKey } from '../../i18n/admin-templates';
import { usePreferences } from '../../design-system/foundations/preferences-provider';
import { AdminShell, LocaleSwitcher, PageHeader } from './admin-shell';
import { RevisionForm, toRevisionBody, type RevisionDraft } from './revision-form';
import { useAdminCommand, useIntentKey } from './use-admin-command';
import { ConflictBanner } from './conflict-banner';
import { IconAlertCircle, IconCheckCircle } from './icons';
import styles from './admin-template.module.css';

export function TemplateNewScreen() {
  const { locale } = usePreferences();
  const t = (key: TemplateAdminKey) => formatTemplateAdmin(locale, key);
  const router = useRouter();
  const { manager } = useIdentity();
  const api = useMemo(() => adminTemplateApi({ csrf: () => manager.csrfToken() }), [manager]);
  const command = useAdminCommand();
  const { getKey, resetKey } = useIntentKey();

  const create = (draft: RevisionDraft) => {
    // One key per intent: reused while the same submission is retried, rotated
    // only after success or when intent changes (FRONTEND §10 — a timeout must not mint a new intent).
    const payload = { category: draft.category, revision: toRevisionBody(draft), ...(draft.reason ? { reason: draft.reason } : {}) };
    const fingerprint = JSON.stringify(payload);
    const key = getKey(fingerprint);
    void command.run('revision', async () => {
      const created = await api.create(payload, key);
      resetKey();
      command.success(t('createdOk'));
      router.push(`/admin/templates/${encodeURIComponent(created.id)}`);
    });
  };

  return (
    <AdminShell activeItem="templates" adminEmail={manager.getSnapshot().principal?.email}>
      <PageHeader
        title={t('newTitle')}
        description={t('newDesc')}
        crumbs={[{ label: t('crumbTemplates'), href: '/admin/templates' }, { label: t('crumbNew') }]}
        caption={t('listCaption')}
        actions={<LocaleSwitcher />}
      />

      {command.notice && (
        <div className={`${styles.banner} ${command.notice.tone === 'success' ? styles.bannerSuccess : styles.bannerDanger}`}
          role={command.notice.tone === 'success' ? 'status' : 'alert'} data-testid="command-notice">
          {command.notice.tone === 'success' ? <IconCheckCircle size={20} /> : <IconAlertCircle size={20} />}
          <p className={styles.bannerTitle}>{command.notice.message}</p>
        </div>
      )}

      <div className={`${styles.content} ${styles.contentSingle}`}>
        <RevisionForm
          mode="create"
          fieldErrors={command.fieldSource === 'revision' ? command.fieldErrors : []}
          pending={command.pending}
          onSubmit={create}
          notice={command.conflict?.source === 'revision' ? (
            <ConflictBanner
              version={command.conflict.version}
              onRefresh={command.dismissConflict}
              onClose={command.dismissConflict}
            />
          ) : undefined}
        />
        <p className={styles.status}>
          <Link className={styles.linkBtn} href="/admin/templates">{t('crumbTemplates')}</Link>
        </p>
      </div>
    </AdminShell>
  );
}
