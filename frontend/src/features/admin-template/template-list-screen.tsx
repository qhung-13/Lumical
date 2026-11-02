'use client';
// I04-P04 — operational template list (F1): TemplateAdminDataDto table,
// availability filter, cursor pagination ("Load next page" — no total count),
// and no audit rows (BR-ADM-001: reads are not audited). Availability is shown
// as a word plus icon, never colour alone.
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useQueries } from '@tanstack/react-query';
import { useIdentity } from '../identity/provider';
import { adminTemplateApi, adminTemplateListOptions, type AdminTemplateData, type AdminTemplateListQuery, type TemplateAvailability } from '../../api/admin-templates';
import { formatTemplateAdmin, type TemplateAdminKey } from '../../i18n/admin-templates';
import { usePreferences } from '../../design-system/foundations/preferences-provider';
import { AdminShell, LocaleSwitcher, PageHeader } from './admin-shell';
import { IconAlertCircle, IconChevronLeft, IconChevronRight, IconPlus, IconTemplates } from './icons';
import styles from './admin-template.module.css';

const AVAILABILITY_KEY: Record<TemplateAvailability, TemplateAdminKey> = {
  INACTIVE: 'availInactive', ACTIVE: 'availActive', ARCHIVED: 'availArchived',
};
const AVAILABILITY_PILL: Record<TemplateAvailability, string> = {
  INACTIVE: 'pillWarning', ACTIVE: 'pillSuccess', ARCHIVED: 'pillMuted',
};
const CATEGORY_KEY: Record<AdminTemplateData['category'], TemplateAdminKey> = {
  GENERAL: 'catGeneral', BIRTHDAY: 'catBirthday', ANNIVERSARY: 'catAnniversary', HOLIDAY: 'catHoliday',
};

export function TemplateListScreen() {
  const { locale } = usePreferences();
  const t = (key: TemplateAdminKey) => formatTemplateAdmin(locale, key);
  const { manager } = useIdentity();
  const api = useMemo(() => adminTemplateApi({ csrf: () => manager.csrfToken() }), [manager]);

  const [state, setState] = useState<TemplateAvailability | ''>('');
  const [cursors, setCursors] = useState<(string | null)[]>([null]);

  const query: AdminTemplateListQuery = state ? { state: state as TemplateAvailability } : {};
  const queries = useQueries({
    queries: cursors.map((cursor) => adminTemplateListOptions({ ...query, ...(cursor ? { cursor } : {}) }, api)),
  });
  const first = queries[0];
  const latestSuccessful = [...queries].reverse().find((entry) => entry.data);
  const rows = useMemo(() => {
    const seen = new Set<string>();
    return queries.flatMap((entry) => entry.data?.data ?? []).filter((row) => {
      if (seen.has(row.id)) return false;
      seen.add(row.id);
      return true;
    });
  }, [queries]);
  const hasMore = latestSuccessful?.data?.meta.hasMore ?? false;
  const initialLoading = first?.isPending && rows.length === 0;
  const initialError = first?.isError && rows.length === 0;

  const changeState = (value: string) => { setCursors([null]); setState(value as TemplateAvailability | ''); };

  return (
    <AdminShell activeItem="templates" adminEmail={manager.getSnapshot().principal?.email}>
      <PageHeader
        title={t('listTitle')}
        description={t('listDesc')}
        caption={t('listCaption')}
        onRefresh={() => { setCursors([null]); void first?.refetch(); }}
        actions={<LocaleSwitcher />}
      />

      <div className={styles.toolbar}>
        <label className={styles.fieldLabel} htmlFor="availability-filter">{t('filterLabel')}</label>
        <span className={styles.selectWrap}>
          <select id="availability-filter" value={state} onChange={(event) => changeState(event.target.value)}>
            <option value="">{t('allStates')}</option>
            <option value="ACTIVE">{t('availActive')}</option>
            <option value="INACTIVE">{t('availInactive')}</option>
            <option value="ARCHIVED">{t('availArchived')}</option>
          </select>
          <IconChevronRight size={16} />
        </span>
        <Link className={`${styles.btn} ${styles.btnPrimary}`} href="/admin/templates/new" data-testid="create-template">
          <IconPlus size={18} />{t('create')}
        </Link>
      </div>
      <p className={styles.count}>{t('resultCount').replace('{n}', String(rows.length))}</p>

      {initialLoading && <p className={styles.status} role="status" aria-live="polite">{t('savingList')}</p>}
      {initialError && (
        <section className={`${styles.banner} ${styles.bannerDanger}`} role="alert">
          <IconAlertCircle size={20} />
          <div>
            <p className={styles.bannerTitle}>{t('unavailable')}</p>
            <button type="button" className={`${styles.btn} ${styles.btnSecondary}`} onClick={() => void first?.refetch()}>{t('retry')}</button>
          </div>
        </section>
      )}

      {!initialLoading && !initialError && rows.length === 0 && (
        <section className={`${styles.empty} ${styles.emptyOn}`} aria-labelledby="empty-title">
          <IconTemplates size={32} />
          <h2 id="empty-title">{t('listTitle')}</h2>
          <p>{t('listDesc')}</p>
        </section>
      )}

      {rows.length > 0 && (
        <div className={styles.tableWrap}>
          <table>
            <caption className={styles.vh}>{t('tableCaption')}</caption>
            <thead>
              <tr>
                <th scope="col">{t('thTemplate')}</th>
                <th scope="col">{t('thCategory')}</th>
                <th scope="col">{t('thAvailability')}</th>
                <th scope="col">{t('thVersion')}</th>
                <th scope="col">{t('thPublished')}</th>
                <th scope="col" className={styles.thAction}>{t('thAction')}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <td>
                    <span className={styles.cellStrong}>{row.id.slice(0, 8)}</span>
                    <span className={styles.cellSub}>{row.id}</span>
                  </td>
                  <td>{t(CATEGORY_KEY[row.category])}</td>
                  <td>
                    <span className={`${styles.pill} ${styles[AVAILABILITY_PILL[row.availability]]}`}>
                      {t(AVAILABILITY_KEY[row.availability])}
                    </span>
                  </td>
                  <td className={styles.num}>{t('versionLabel').replace('{n}', String(row.version))}</td>
                  <td className={styles.num}>
                    {row.publishedRevision === null ? t('neverPublished') : t('publishedRev').replace('{n}', String(row.publishedRevision))}
                  </td>
                  <td className={styles.tdAction}>
                    <Link className={styles.linkBtn} href={`/admin/templates/${encodeURIComponent(row.id)}`}>
                      {t('manage')}
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {rows.length > 0 && (
        <nav className={styles.pagination} aria-label="Pagination">
          <button
            type="button" className={styles.iconBtn} disabled={cursors.length <= 1}
            onClick={() => setCursors((previous) => previous.slice(0, -1))}
            aria-label={t('prev')}
          >
            <IconChevronLeft size={18} />
          </button>
          <span className={styles.pageCount}>{cursors.length}</span>
          <button
            type="button" className={styles.iconBtn} disabled={!hasMore}
            onClick={() => setCursors((previous) => [...previous, latestSuccessful?.data?.meta.nextCursor ?? null])}
            aria-label={t('loadMore')}
          >
            <IconChevronRight size={18} />
          </button>
          <span className={styles.pageLabel}>{hasMore ? t('loadMore') : t('endOfList')}</span>
        </nav>
      )}
    </AdminShell>
  );
}
