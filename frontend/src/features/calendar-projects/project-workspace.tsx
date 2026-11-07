'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import { projectApi, projectListOptions, projectKeys, ProjectApiError, type ProjectCreate } from '../../api/projects';
import { templateDetailOptions, templateKeys, TemplateApiError } from '../../api/templates';
import { Button } from '../../design-system/primitives/button';
import { FormField } from '../../design-system/composites/form-field';
import { PublicShell } from '../../design-system/layouts/public-shell';
import { usePreferences } from '../../design-system/foundations/preferences-provider';
import { useIdentity } from '../identity/provider';
import { IdentityScreen } from '../identity/identity-screen';
import { projectCopy } from './copy';
import styles from './projects.module.css';

const graphemes = (value: string, locale: string) => [...new Intl.Segmenter(locale, { granularity: 'grapheme' }).segment(value)].length;

export function ProjectWorkspace({ templateId }: { templateId?: string }) {
  const { manager, state } = useIdentity();
  const { locale } = usePreferences(); const copy = projectCopy[locale]; const router = useRouter();
  const queries = useQueryClient();
  const actorId = state.principal?.id ?? 'anonymous';
  const api = useMemo(() => projectApi({ csrf: manager.csrfToken, epoch: manager.requestEpoch, unauthorized: () => manager.bootstrap() }), [manager]);
  const selectedTemplate = useQuery({ ...templateDetailOptions(templateId ?? '', undefined), enabled: Boolean(templateId && state.phase === 'authenticated' && state.mutationReady) });
  const template = selectedTemplate.data;
  const [title, setTitle] = useState(''); const [recipient, setRecipient] = useState('');
  const [year, setYear] = useState(new Date().getFullYear()); const [preset, setPreset] = useState('');
  const [submitError, setSubmitError] = useState<string>(); const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [pending, setPending] = useState(false); const [logoutPending, setLogoutPending] = useState(false); const [cursorStack, setCursorStack] = useState<(string | null)[]>([null]);
  const intent = useRef<{ body: string; key: string } | undefined>(undefined); const pendingGuard = useRef(false); const summary = useRef<HTMLDivElement>(null);
  const pageQueries = useQueries({ queries: cursorStack.map(cursor => projectListOptions(actorId, cursor ? { cursor } : {}, api, state.phase === 'authenticated' && state.mutationReady)) });
  const projectRows = pageQueries.flatMap(query => query.data?.data ?? []).filter((project, index, all) => all.findIndex(item => item.id === project.id) === index);
  const latest = [...pageQueries].reverse().find(query => query.data);
  const lastPage = pageQueries.at(-1);
  const selectedPreset = template?.publishedRevision.presets.some(item => item.id === preset) ? preset : template?.publishedRevision.presets[0]?.id ?? '';
  useEffect(() => { if (submitError) summary.current?.focus(); }, [submitError]);
  if (state.phase !== 'authenticated') return <IdentityScreen mode="account" templateId={templateId} returnTo={`/account${templateId ? `?templateId=${encodeURIComponent(templateId)}` : ''}`} />;

  const setInput = (setter: (value: string) => void) => (value: string) => { setter(value); setSubmitError(undefined); setFieldErrors({}); };
  async function logout() {
    setLogoutPending(true);
    try { await manager.logout(); router.replace('/'); }
    catch { setSubmitError('ERROR'); }
    finally { setLogoutPending(false); }
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (pendingGuard.current) return;
    const cleanTitle = title.normalize('NFC').trim(); const cleanRecipient = recipient.normalize('NFC').trim();
    const errors: Record<string, string> = {};
    if (!cleanTitle || graphemes(cleanTitle, locale) > 80) errors.title = copy.titleError;
    if (!cleanRecipient || graphemes(cleanRecipient, locale) > 80) errors.recipientName = copy.recipientError;
    if (!Number.isInteger(year) || year < new Date().getFullYear() || year > new Date().getFullYear() + 2) errors.year = copy.yearError;
    if (!template?.publishedRevision.presets.some(item => item.id === selectedPreset)) errors.stylePresetId = copy.presetError;
    setFieldErrors(errors); setSubmitError(undefined); if (Object.keys(errors).length) { setSubmitError('VALIDATION_FAILED'); return; }
    const body: ProjectCreate = { templateId: template!.id, title: cleanTitle, recipientName: cleanRecipient, year, stylePresetId: selectedPreset };
    const serialized = JSON.stringify(body);
    if (intent.current?.body !== serialized) intent.current = { body: serialized, key: crypto.randomUUID() };
    pendingGuard.current = true; setPending(true);
    try {
      const project = await api.create(body, intent.current.key);
      await queries.invalidateQueries({ queryKey: projectKeys.lists(actorId) });
      intent.current = undefined; router.push(`/projects/${encodeURIComponent(project.id)}`);
    } catch (error) {
      if (error instanceof ProjectApiError) {
        if (error.code === 'TEMPLATE_UNAVAILABLE' || error.status === 409) setSubmitError('TEMPLATE_UNAVAILABLE');
        else if (error.fields.length) {
          const next: Record<string, string> = {};
          const byMessageKey: Record<string, string> = { 'validation.title': copy.titleError, 'validation.recipientName': copy.recipientError,
            'validation.year': copy.yearError, 'validation.stylePresetId': copy.presetError };
          for (const field of error.fields) if (['title', 'recipientName', 'year', 'stylePresetId'].includes(field.path))
            next[field.path] = byMessageKey[field.messageKey] ?? (field.path === 'title' ? copy.titleError : field.path === 'recipientName' ? copy.recipientError : field.path === 'year' ? copy.yearError : copy.presetError);
          setFieldErrors(next); setSubmitError('VALIDATION_FAILED');
          if (template && error.fields.some(field => field.path === 'stylePresetId'))
            void queries.invalidateQueries({ queryKey: templateKeys.detail(template.id) });
        } else setSubmitError(error.code === 'IDEMPOTENCY_CONFLICT' || error.code === 'CONFLICT' ? 'CONFLICT' : 'ERROR');
      } else setSubmitError('ERROR');
    } finally { pendingGuard.current = false; setPending(false); }
  }

  const templateNotFound = selectedTemplate.error instanceof TemplateApiError && selectedTemplate.error.status === 404;
  return <PublicShell><div className={styles.page}>
    <div className={styles.workspaceHeading}><div><p className={styles.eyebrow}>LumiCal</p><h1>{copy.title}</h1><p className={styles.intro}>{copy.intro}</p></div>
      <Button variant="outline" loading={logoutPending} loadingLabel={copy.logout} disabled={!state.mutationReady} onClick={() => void logout()}>{copy.logout}</Button></div>
    {submitError === 'ERROR' && !template && <p role="alert">{copy.error}</p>}
    {templateId ? selectedTemplate.isPending ? <section className={styles.panel} role="status">{copy.loadingTemplate}</section> : templateNotFound ?
      <section className={styles.panel} role="alert"><p>{copy.missing}</p><Link href="/templates">{copy.catalog}</Link></section> : selectedTemplate.isError ?
      <section className={styles.panel} role="alert"><p>{copy.error}</p><Button onClick={() => void selectedTemplate.refetch()}>{copy.retry}</Button></section> : template ?
      <section className={styles.composition} aria-label={copy.template}>
        <div className={styles.preview} data-layout={template.publishedRevision.layout.type}>
          <div className={styles.paper}><span>{template.publishedRevision.name[locale]}</span><div aria-hidden="true">{Array.from({ length: 12 }, (_, index) => <i key={index} />)}</div></div>
        </div>
        <div className={styles.panel}><p className={styles.eyebrow}>{copy.template} · {template.publishedRevision.name[locale]}</p><p>{template.publishedRevision.description[locale]}</p>
          <Link href="/templates">{copy.change}</Link>
          <form onSubmit={event => void submit(event)} noValidate>
            {submitError && <div className={styles.summary} role="alert" tabIndex={-1} ref={summary}>{submitError === 'VALIDATION_FAILED' ? copy.validation : submitError === 'TEMPLATE_UNAVAILABLE' ? copy.unavailable : submitError === 'CONFLICT' ? copy.conflict : copy.error}</div>}
            <fieldset disabled={pending || !state.mutationReady} className={styles.fields}>
              <FormField name="title" required label={copy.calendarTitle} requirementLabel={copy.required} description={copy.titleHint} value={title} onChange={event => setInput(setTitle)(event.target.value)} error={fieldErrors.title} autoComplete="off" />
              <FormField name="recipientName" required label={copy.recipient} requirementLabel={copy.required} description={copy.recipientHint} value={recipient} onChange={event => setInput(setRecipient)(event.target.value)} error={fieldErrors.recipientName} autoComplete="off" />
              <FormField name="year" required label={copy.year} requirementLabel={copy.required} type="number" min={new Date().getFullYear()} max={new Date().getFullYear() + 2} value={year} onChange={event => { setYear(Number(event.target.value)); setSubmitError(undefined); setFieldErrors({}); }} error={fieldErrors.year} />
              <div className={styles.selectField}><label htmlFor="project-preset">{copy.preset} ({copy.required})</label><select id="project-preset" name="stylePresetId" required value={selectedPreset} onChange={event => { setPreset(event.target.value); setSubmitError(undefined); setFieldErrors({}); }} aria-invalid={Boolean(fieldErrors.stylePresetId)} aria-describedby={fieldErrors.stylePresetId ? 'project-preset-error' : undefined}>
                {template.publishedRevision.presets.map(item => <option key={item.id} value={item.id}>{item.name[locale]}</option>)}
              </select>{fieldErrors.stylePresetId && <p id="project-preset-error" className={styles.fieldError}>{fieldErrors.stylePresetId}</p>}</div>
              <Button type="submit" variant="primary" size="lg" loading={pending} loadingLabel={copy.creating}>{copy.create}</Button>
            </fieldset>
          </form>
        </div>
      </section> : null : <section className={styles.panel}><p>{copy.missing}</p><Link href="/templates">{copy.catalog}</Link></section>}
    <section className={styles.list} aria-labelledby="my-projects"><h2 id="my-projects">{copy.myProjects}</h2>
      {pageQueries[0]?.isPending && projectRows.length === 0 && <p role="status">{copy.loading}</p>}
      {pageQueries[0]?.isError && projectRows.length === 0 && <div role="alert"><p>{copy.listError}</p><Button onClick={() => void pageQueries[0]?.refetch()}>{copy.retry}</Button></div>}
      {!pageQueries[0]?.isPending && !pageQueries[0]?.isError && projectRows.length === 0 && <p>{copy.empty}</p>}
      {projectRows.length > 0 && <ul className={styles.projectList}>{projectRows.map(project => <li key={project.id}><Link href={`/projects/${encodeURIComponent(project.id)}`}><strong>{project.title}</strong><span>{project.recipientName} · {project.year}</span><span>{copy.status[project.status]}</span></Link></li>)}</ul>}
      {lastPage?.isError && projectRows.length > 0 && <div role="alert"><p>{copy.listError}</p><Button onClick={() => void lastPage.refetch()}>{copy.retry}</Button></div>}
      {latest?.data?.meta.hasMore && !lastPage?.isError && <Button variant="secondary" disabled={lastPage?.isFetching} onClick={() => { const cursor = latest.data?.meta.nextCursor; if (cursor && !cursorStack.includes(cursor)) setCursorStack(current => [...current, cursor]); }}>{copy.loadMore}</Button>}
    </section>
  </div></PublicShell>;
}
