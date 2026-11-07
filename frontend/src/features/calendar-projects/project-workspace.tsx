'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import { projectApi, projectListOptions, projectKeys, ProjectApiError, type ProjectCreate } from '../../api/projects';
import { templateDetailOptions, templateKeys, TemplateApiError } from '../../api/templates';
import { Button } from '../../design-system/primitives/button';
import { FormField } from '../../design-system/composites/form-field';
import { Dialog } from '../../design-system/composites/dialog';
import { PublicShell } from '../../design-system/layouts/public-shell';
import { usePreferences } from '../../design-system/foundations/preferences-provider';
import { useIdentity } from '../identity/provider';
import { IdentityScreen } from '../identity/identity-screen';
import { projectCopy } from './copy';
import { clearProjectWorkspaceDraft, readProjectWorkspaceDraft, writeProjectWorkspaceDraft, type ProjectWorkspaceDraft } from './workspace-draft';
import styles from './projects.module.css';

const graphemes = (value: string, locale: string) => [...new Intl.Segmenter(locale, { granularity: 'grapheme' }).segment(value)].length;

export function ProjectWorkspace({ templateId }: { templateId?: string }) {
  const { manager, state } = useIdentity();
  const previousActor = useRef<string | undefined>(undefined);
  const workspaceActor = state.phase === 'authenticated' ? state.principal?.id ?? 'anonymous' : 'anonymous';
  useEffect(() => {
    const clearOnIdentityBoundary = () => {
      const snapshot = manager.getSnapshot();
      if (snapshot.phase === 'unauthenticated') {
        if (previousActor.current) clearProjectWorkspaceDraft(previousActor.current);
        previousActor.current = undefined;
      } else if (snapshot.phase === 'authenticated' && snapshot.principal) {
        if (previousActor.current && previousActor.current !== snapshot.principal.id) clearProjectWorkspaceDraft(previousActor.current);
        previousActor.current = snapshot.principal.id;
      }
    };
    clearOnIdentityBoundary();
    return manager.subscribe(clearOnIdentityBoundary);
  }, [manager]);
  return <ProjectWorkspaceActor key={workspaceActor} templateId={templateId} />;
}

function ProjectWorkspaceActor({ templateId }: { templateId?: string }) {
  const { manager, state } = useIdentity();
  const { locale } = usePreferences(); const copy = projectCopy[locale]; const router = useRouter();
  const queries = useQueryClient();
  const actorId = state.principal?.id ?? 'anonymous';
  const api = useMemo(() => projectApi({ csrf: manager.csrfToken, epoch: manager.requestEpoch, unauthorized: () => manager.bootstrap() }), [manager]);
  const selectedTemplate = useQuery({ ...templateDetailOptions(templateId ?? '', undefined), enabled: Boolean(templateId && state.phase === 'authenticated' && state.mutationReady) });
  const template = selectedTemplate.data;
  const [draft, setDraft] = useState<ProjectWorkspaceDraft>(() => readProjectWorkspaceDraft(actorId));
  const draftRef = useRef(draft); const mounted = useRef(true);
  const [pending, setPending] = useState(false); const [logoutPending, setLogoutPending] = useState(false); const pendingGuard = useRef(false); const summary = useRef<HTMLDivElement>(null);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const updateDraft = (patch: Partial<ProjectWorkspaceDraft>, owner = actorId) => {
    const next = { ...draftRef.current, ...patch };
    draftRef.current = next;
    if (state.phase === 'authenticated' && owner === actorId) writeProjectWorkspaceDraft(owner, next);
    setDraft(next);
  };
  const pageQueries = useQueries({ queries: draft.cursorStack.map(cursor => projectListOptions(actorId, cursor ? { cursor } : {}, api, state.phase === 'authenticated' && state.mutationReady)) });
  const projectRows = pageQueries.flatMap(query => query.data?.data ?? []).filter((project, index, all) => all.findIndex(item => item.id === project.id) === index);
  const latest = [...pageQueries].reverse().find(query => query.data);
  const lastPage = pageQueries.at(-1);
  const selectedPreset = template?.publishedRevision.presets.some(item => item.id === draft.preset) ? draft.preset : '';
  useEffect(() => { if (draft.submitError) summary.current?.focus(); }, [draft.submitError]);
  if (state.phase !== 'authenticated') return <IdentityScreen mode="account" templateId={templateId} returnTo={`/account${templateId ? `?templateId=${encodeURIComponent(templateId)}` : ''}`} />;

  const setInput = (field: 'title' | 'recipient', value: string) => updateDraft({ [field]: value, submitError: undefined, fieldErrors: {} });
  async function logout() {
    setLogoutPending(true);
    try { await manager.logout(); router.replace('/'); }
    catch { updateDraft({ submitError: 'ERROR' }); }
    finally { setLogoutPending(false); }
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (pendingGuard.current) return;
    const existingIntent = draftRef.current.intent;
    let attempt = existingIntent;
    if (!attempt) {
      const { title, recipient, year } = draftRef.current;
      const cleanTitle = title.normalize('NFC').trim(); const cleanRecipient = recipient.normalize('NFC').trim();
      const errors: Record<string, string> = {};
      if (!cleanTitle || graphemes(cleanTitle, locale) > 80) errors.title = copy.titleError;
      if (!cleanRecipient || graphemes(cleanRecipient, locale) > 80) errors.recipientName = copy.recipientError;
      if (!Number.isInteger(year) || year < new Date().getFullYear() || year > new Date().getFullYear() + 2) errors.year = copy.yearError;
      if (!template?.publishedRevision.presets.some(item => item.id === selectedPreset)) errors.stylePresetId = copy.presetError;
      updateDraft({ fieldErrors: errors, submitError: undefined });
      if (Object.keys(errors).length) { updateDraft({ submitError: 'VALIDATION_FAILED' }); return; }
      const body: ProjectCreate = { templateId: template!.id, title: cleanTitle, recipientName: cleanRecipient, year, stylePresetId: selectedPreset };
      attempt = { body, key: crypto.randomUUID() };
    }
    const requestActor = actorId;
    pendingGuard.current = true; setPending(true);
    updateDraft({ intent: attempt, submitError: undefined });
    try {
      const project = await api.create(attempt.body, attempt.key);
      if (!mounted.current || actorId !== requestActor) return;
      await queries.invalidateQueries({ queryKey: projectKeys.lists(requestActor) });
      updateDraft({ intent: undefined, submitError: undefined }); router.push(`/projects/${encodeURIComponent(project.id)}`);
    } catch (error) {
      if (!mounted.current || actorId !== requestActor) return;
      if (error instanceof ProjectApiError) {
        if (error.code === 'TEMPLATE_UNAVAILABLE') {
          updateDraft({ intent: undefined, submitError: 'TEMPLATE_UNAVAILABLE' });
          if (template) void queries.invalidateQueries({ queryKey: templateKeys.detail(template.id) });
        }
        else if (error.fields.length) {
          const next: Record<string, string> = {};
          const byMessageKey: Record<string, string> = { 'validation.title': copy.titleError, 'validation.recipientName': copy.recipientError,
            'validation.year': copy.yearError, 'validation.stylePresetId': copy.presetError };
          for (const field of error.fields) if (['title', 'recipientName', 'year', 'stylePresetId'].includes(field.path))
            next[field.path] = byMessageKey[field.messageKey] ?? (field.path === 'title' ? copy.titleError : field.path === 'recipientName' ? copy.recipientError : field.path === 'year' ? copy.yearError : copy.presetError);
          updateDraft({ intent: undefined, fieldErrors: next, submitError: 'VALIDATION_FAILED' });
          if (template && error.fields.some(field => field.path === 'stylePresetId'))
            void queries.invalidateQueries({ queryKey: templateKeys.detail(template.id) });
        } else if (error.status === 422) updateDraft({ intent: undefined, submitError: 'ERROR' });
        else updateDraft({ submitError: error.code === 'IDEMPOTENCY_CONFLICT' || error.code === 'CONFLICT' ? 'CONFLICT' : 'ERROR' });
      } else updateDraft({ submitError: 'ERROR' });
    } finally {
      if (mounted.current && actorId === requestActor) { pendingGuard.current = false; setPending(false); }
    }
  }

  const templateNotFound = selectedTemplate.error instanceof TemplateApiError && selectedTemplate.error.status === 404;
  return <PublicShell><div className={styles.page}>
    <div className={styles.workspaceHeading}><div><p className={styles.eyebrow}>LumiCal</p><h1>{copy.title}</h1><p className={styles.intro}>{copy.intro}</p></div>
      <Button variant="outline" loading={logoutPending} loadingLabel={copy.logout} disabled={!state.mutationReady} onClick={() => void logout()}>{copy.logout}</Button></div>
    {draft.submitError === 'ERROR' && !template && <p role="alert">{copy.error}</p>}
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
            {draft.submitError && <div className={styles.summary} role="alert" tabIndex={-1} ref={summary}>{draft.submitError === 'VALIDATION_FAILED' ? copy.validation : draft.submitError === 'TEMPLATE_UNAVAILABLE' ? copy.unavailable : draft.submitError === 'CONFLICT' ? copy.conflict : copy.error}</div>}
            {draft.intent && <p role="status" className={styles.summary}>{copy.unresolvedIntent}</p>}
            <fieldset disabled={pending || !state.mutationReady} className={styles.fields}>
              <FormField disabled={Boolean(draft.intent)} name="title" required label={copy.calendarTitle} requirementLabel={copy.required} description={copy.titleHint} value={draft.title} onChange={event => setInput('title', event.target.value)} error={draft.fieldErrors.title} autoComplete="off" />
              <FormField disabled={Boolean(draft.intent)} name="recipientName" required label={copy.recipient} requirementLabel={copy.required} description={copy.recipientHint} value={draft.recipient} onChange={event => setInput('recipient', event.target.value)} error={draft.fieldErrors.recipientName} autoComplete="off" />
              <FormField disabled={Boolean(draft.intent)} name="year" required label={copy.year} requirementLabel={copy.required} type="number" min={new Date().getFullYear()} max={new Date().getFullYear() + 2} value={draft.year} onChange={event => updateDraft({ year: Number(event.target.value), submitError: undefined, fieldErrors: {} })} error={draft.fieldErrors.year} />
              <div className={styles.selectField}><label htmlFor="project-preset">{copy.preset} ({copy.required})</label><select disabled={Boolean(draft.intent)} id="project-preset" name="stylePresetId" required value={selectedPreset} onChange={event => updateDraft({ preset: event.target.value, submitError: undefined, fieldErrors: {} })} aria-invalid={Boolean(draft.fieldErrors.stylePresetId)} aria-describedby={draft.fieldErrors.stylePresetId ? 'project-preset-error' : undefined}>
                {!selectedPreset && <option value="">{copy.choosePreset}</option>}
                {template.publishedRevision.presets.map(item => <option key={item.id} value={item.id}>{item.name[locale]}</option>)}
              </select>{draft.fieldErrors.stylePresetId && <p id="project-preset-error" className={styles.fieldError}>{draft.fieldErrors.stylePresetId}</p>}</div>
            </fieldset>
            <Button type="submit" variant="primary" size="lg" disabled={pending || !state.mutationReady} loading={pending} loadingLabel={copy.creating}>{draft.intent ? copy.retryPrevious : copy.create}</Button>
          </form>
          {draft.intent && !pending && <Dialog triggerLabel={copy.startNewIntent} title={copy.startNewIntentTitle} description={copy.startNewIntentDescription}
            cancelLabel={copy.cancel} confirmLabel={copy.startNewIntentConfirm} destructive onConfirm={() => updateDraft({ intent: undefined, submitError: undefined, fieldErrors: {} })} />}
        </div>
      </section> : null : <section className={styles.panel}><p>{copy.missing}</p><Link href="/templates">{copy.catalog}</Link></section>}
    <section className={styles.list} aria-labelledby="my-projects"><h2 id="my-projects">{copy.myProjects}</h2>
      {pageQueries[0]?.isPending && projectRows.length === 0 && <p role="status">{copy.loading}</p>}
      {pageQueries[0]?.isError && projectRows.length === 0 && <div role="alert"><p>{copy.listError}</p><Button onClick={() => void pageQueries[0]?.refetch()}>{copy.retry}</Button></div>}
      {!pageQueries[0]?.isPending && !pageQueries[0]?.isError && projectRows.length === 0 && <p>{copy.empty}</p>}
      {projectRows.length > 0 && <ul className={styles.projectList}>{projectRows.map(project => <li key={project.id}><Link href={`/projects/${encodeURIComponent(project.id)}`}><strong>{project.title}</strong><span>{project.recipientName} · {project.year}</span><span>{copy.status[project.status]}</span></Link></li>)}</ul>}
      {lastPage?.isError && projectRows.length > 0 && <div role="alert"><p>{copy.listError}</p><Button onClick={() => void lastPage.refetch()}>{copy.retry}</Button></div>}
      {latest?.data?.meta.hasMore && !lastPage?.isError && <Button variant="secondary" disabled={lastPage?.isFetching} onClick={() => { const cursor = latest.data?.meta.nextCursor; if (cursor && !draft.cursorStack.includes(cursor)) updateDraft({ cursorStack: [...draft.cursorStack, cursor] }); }}>{copy.loadMore}</Button>}
    </section>
  </div></PublicShell>;
}
