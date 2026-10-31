'use client';
import Link from 'next/link';
import { useMemo, useState, type FormEvent } from 'react';
import { useQueries } from '@tanstack/react-query';
import { useTemplateDetail, templateListOptions, type PublicTemplate, type TemplateCategory, type TemplateListQuery } from '../../api/templates';
import { Button } from '../../design-system/primitives/button';
import { FormField } from '../../design-system/composites/form-field';
import { PublicShell } from '../../design-system/layouts/public-shell';
import { templateCopy } from '../../i18n/templates';
import { usePreferences } from '../../design-system/foundations/preferences-provider';
import { useIdentity } from '../identity/provider';
import styles from './templates.module.css';

const categories: TemplateCategory[] = ['GENERAL', 'BIRTHDAY', 'ANNIVERSARY', 'HOLIDAY'];

function CategoryLabel({ category }: { category: TemplateCategory }) {
  const { locale } = usePreferences();
  return <span className={styles.category}>{templateCopy[locale].categories[category]}</span>;
}

function TemplateIllustration({ template, label, labelText }: { template: PublicTemplate; label: string; labelText: string }) {
  const preset = template.publishedRevision.presets[0]?.id ?? 'classic';
  return <div className={styles.illustration} data-layout={template.publishedRevision.layout.type} data-preset={preset} role="img" aria-label={label}>
    <div className={styles.paper}>
      <div className={styles.previewTop}><span /><span /><span /></div>
      <div className={styles.previewBody}>
        <div className={styles.previewHero}><span /><i /><i /></div>
        <div className={styles.previewMonths} aria-hidden="true">{Array.from({ length: 12 }, (_, index) => <span key={index} />)}</div>
      </div>
    </div>
    <span className={styles.illustrationBadge}>{labelText}</span>
  </div>;
}

function TemplateCard({ template }: { template: PublicTemplate }) {
  const { locale } = usePreferences();
  const copy = templateCopy[locale];
  const revision = template.publishedRevision;
  return <article className={styles.card}>
    <Link className={styles.cardLink} href={`/templates/${encodeURIComponent(template.id)}`} aria-label={`${copy.open}: ${revision.name[locale]}`}>
      <TemplateIllustration template={template} label={copy.illustration} labelText={copy.illustrationLabel} />
      <div className={styles.cardContent}>
        <CategoryLabel category={template.category} />
        <h2>{revision.name[locale]}</h2>
        <p>{revision.description[locale]}</p>
        <dl className={styles.specs}>
          <div><dt>{copy.layout}</dt><dd>{copy.layouts[revision.layout.type]}</dd></div>
          <div><dt>{copy.presets}</dt><dd>{revision.presets.map(preset => preset.name[locale]).join(' · ')}</dd></div>
        </dl>
        <span className={styles.price}>{copy.price(revision.price.unitPriceMinor)}</span>
        <span className={styles.cardAction}>{copy.open}<span aria-hidden="true"> ↗</span></span>
      </div>
    </Link>
  </article>;
}

export function TemplateCatalogScreen() {
  const { locale } = usePreferences();
  const copy = templateCopy[locale];
  const [draftQuery, setDraftQuery] = useState('');
  const [filters, setFilters] = useState<Pick<TemplateListQuery, 'category' | 'query'>>({});
  const [cursors, setCursors] = useState<(string | null)[]>([null]);
  const queries = useQueries({ queries: cursors.map(cursor => templateListOptions({ ...filters, ...(cursor ? { cursor } : {}) })) });
  const first = queries[0];
  const last = queries[queries.length - 1];
  const latestSuccessful = [...queries].reverse().find(query => query.data);
  const data = useMemo(() => {
    const seen = new Set<string>();
    return queries.flatMap(query => query.data?.data ?? []).filter(template => {
      if (seen.has(template.id)) return false;
      seen.add(template.id);
      return true;
    });
  }, [queries]);
  const anyFilter = Boolean(filters.category || filters.query);
  const hasMore = latestSuccessful?.data?.meta.hasMore ?? false;
  const initialLoading = first?.isPending && data.length === 0;
  const initialError = first?.isError && data.length === 0;
  const loadMoreError = queries.length > 1 && last?.isError === true;

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCursors([null]);
    setFilters(current => ({ ...current, query: draftQuery.trim() || undefined }));
  }
  function changeCategory(value: string) {
    setCursors([null]);
    setFilters(current => ({ ...current, category: value ? value as TemplateCategory : undefined }));
  }
  function clearFilters() {
    setDraftQuery(''); setFilters({}); setCursors([null]);
  }

  return <PublicShell><div className={styles.page}>
    <p className={styles.eyebrow}>{copy.eyebrow}</p>
    <h1>{copy.title}</h1>
    <p className={styles.lead}>{copy.intro}</p>
    <form className={styles.filters} onSubmit={submitSearch}>
      <FormField label={copy.search} requirementLabel={locale === 'vi' ? 'không bắt buộc' : 'optional'} description={copy.searchHint}
        name="query" type="search" placeholder={copy.searchPlaceholder} value={draftQuery} onChange={event => setDraftQuery(event.target.value)} />
      <div className={styles.categoryFilter}>
        <label htmlFor="template-category">{copy.category}</label>
        <select id="template-category" value={filters.category ?? ''} onChange={event => changeCategory(event.target.value)}>
          <option value="">{copy.allCategories}</option>
          {categories.map(category => <option value={category} key={category}>{copy.categories[category]}</option>)}
        </select>
      </div>
      <Button type="submit" variant="secondary">{copy.searchAction}</Button>
    </form>

    {initialLoading ? <div className={styles.state} role="status" aria-live="polite">{copy.loading}</div> : null}
    {initialError ? <section className={styles.state} role="alert"><h2>{copy.errorTitle}</h2><p>{copy.errorBody}</p><Button onClick={() => void first?.refetch()}>{copy.retry}</Button></section> : null}
    {!initialLoading && !initialError && data.length === 0 ? <section className={styles.state} aria-labelledby="empty-title">
      <h2 id="empty-title">{anyFilter ? copy.noResultsTitle : copy.emptyTitle}</h2>
      <p>{anyFilter ? copy.noResultsBody : copy.emptyBody}</p>
      {anyFilter && <Button variant="outline" onClick={clearFilters}>{copy.clearFilters}</Button>}
    </section> : null}
    {data.length > 0 && <section aria-labelledby="results-heading" className={styles.results}>
      <div className={styles.resultsHeading}><h2 id="results-heading">{copy.catalog}</h2><p aria-live="polite">{copy.results(data.length)}</p></div>
      <div className={styles.grid}>{data.map(template => <TemplateCard key={template.id} template={template} />)}</div>
      {loadMoreError && <div className={styles.loadMoreError} role="alert"><p>{copy.loadMoreError}</p><Button variant="outline" onClick={() => void last?.refetch()}>{copy.retry}</Button></div>}
      {hasMore && !loadMoreError && <div className={styles.loadMore}><Button variant="secondary" disabled={last?.isFetching} onClick={() => {
        const cursor = latestSuccessful?.data?.meta.nextCursor;
        if (cursor && !last?.isFetching) setCursors(current => current.includes(cursor) ? current : [...current, cursor]);
      }}>{last?.isFetching ? copy.loadingMore : copy.loadMore}</Button></div>}
    </section>}
  </div></PublicShell>;
}

export function TemplateDetailScreen({ id }: { id: string }) {
  const { locale } = usePreferences();
  const { state } = useIdentity();
  const copy = templateCopy[locale];
  const detail = useTemplateDetail(id);
  const template = detail.data;
  if (detail.isPending) return <PublicShell><div className={styles.state} role="status">{copy.detailLoading}</div></PublicShell>;
  if (detail.isError) {
    const notFound = 'status' in detail.error && detail.error.status === 404;
    return <PublicShell><div className={styles.detailState}>
      <Link className={styles.back} href="/templates">← {copy.back}</Link>
      <section className={styles.state} role={notFound ? 'status' : 'alert'}>
        <h1>{notFound ? copy.notFound : copy.detailError}</h1>
        {!notFound && <Button onClick={() => void detail.refetch()}>{copy.retry}</Button>}
      </section>
    </div></PublicShell>;
  }
  if (!template) return null;
  const revision = template.publishedRevision;
  return <PublicShell><article className={styles.detail}>
    <Link className={styles.back} href="/templates">← {copy.back}</Link>
    <div className={styles.detailGrid}>
      <TemplateIllustration template={template} label={copy.illustration} labelText={copy.illustrationLabel} />
      <div className={styles.detailContent}>
        <p className={styles.eyebrow}>{copy.published} · {copy.version(revision.version)}</p>
        <CategoryLabel category={template.category} />
        <h1>{revision.name[locale]}</h1>
        <p className={styles.detailDescription}>{revision.description[locale]}</p>
        <h2>{copy.detailTitle}</h2>
        <dl className={styles.detailSpecs}>
          <div><dt>{copy.layout}</dt><dd>{copy.layouts[revision.layout.type]}</dd></div>
          <div><dt>{copy.months}</dt><dd>12</dd></div>
          <div><dt>{copy.maxPhotos}</dt><dd>4</dd></div>
          <div><dt>{copy.presets}</dt><dd>{revision.presets.map(preset => preset.name[locale]).join(' · ')}</dd></div>
          <div><dt>{copy.category}</dt><dd><CategoryLabel category={template.category} /></dd></div>
        </dl>
        <p className={styles.detailPrice}>{copy.price(revision.price.unitPriceMinor)}</p>
        <div className={styles.handoff}>
          <Link className={styles.ctaLink} href={state.phase === 'authenticated'
            ? `/account?templateId=${encodeURIComponent(template.id)}`
            : `/login?next=${encodeURIComponent(`/account?templateId=${template.id}`)}`}>
            {copy.continueCalendar}
          </Link>
          <p>{copy.handoffNote}</p>
        </div>
      </div>
    </div>
  </article></PublicShell>;
}
