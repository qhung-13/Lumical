'use client';
import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Dialog } from '../../design-system/composites/dialog';
import { Button } from '../../design-system/primitives/button';
import { Input } from '../../design-system/primitives/input';
import { usePreferences } from '../../design-system/foundations/preferences-provider';
import { studioCopy } from '../../i18n/studio';
import { ProjectApiError, projectKeys, type ProjectApi, type ProjectMonths, type SpecialDate, type SpecialDateRevision, type SpecialDateWrite, type SpecialDatesRevision } from '../../api/projects';
import { countVisibleCharacters } from './month-editor';
import { emptySpecialDateDraft, formatCivilDate, specialDateWrite, validateSpecialDate, type SpecialDateDraft, type SpecialDateFieldErrors } from './special-date-editor';
import styles from './special-dates.module.css';

interface Props {
  actorId: string;
  projectId: string;
  projectYear: number;
  projectVersion: number;
  projectStatus: 'WORKING' | 'ARCHIVED';
  mutationReady: boolean;
  api: ProjectApi;
  events?: SpecialDatesRevision;
  loading: boolean;
  fetching: boolean;
  failed: boolean;
  onRetry: () => void;
  blocked: boolean;
  onConflict: (eventId: string | undefined, acknowledge: (reviewedVersion: number) => void) => void;
  /** G5: tells the Studio guard when this form holds input that leaving would lose. */
  onDirtyChange?: (dirty: boolean) => void;
}

interface CreateIntent { body: SpecialDateWrite; key: string; version: number }
type Operation = 'create' | 'update' | 'delete' | undefined;

function errorDetails(error: unknown): { status: number; code: string; retryable: boolean; fields: ProjectApiError['fields'] } {
  if (error instanceof ProjectApiError) return error;
  return { status: 0, code: 'PROVIDER_UNAVAILABLE', retryable: true, fields: [] };
}

export function SpecialDatesEditor({ actorId, projectId, projectYear, projectVersion, projectStatus, mutationReady,
  api, events, loading, fetching, failed, onRetry, onDirtyChange, blocked, onConflict }: Props) {
  const { locale } = usePreferences();
  const copy = studioCopy[locale].specialDates;
  const queryClient = useQueryClient();
  const formId = useId();
  const [draft, setDraft] = useState<SpecialDateDraft>(emptySpecialDateDraft);
  const [editingId, setEditingId] = useState<string>();
  const editingVersion = useRef<number | undefined>(undefined);
  const [pendingIntent, setPendingIntent] = useState<CreateIntent>();
  const [operation, setOperation] = useState<Operation>();
  const [submitted, setSubmitted] = useState(false);
  const [message, setMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [errors, setErrors] = useState<SpecialDateFieldErrors>({});
  // G5: typed or open-form input is what the Studio's leave guard must protect.
  const formDirty = Boolean(pendingIntent || editingId) ||
    draft.date !== '' || draft.title !== '' || draft.note !== '';
  useEffect(() => {
    onDirtyChange?.(formDirty);
    return () => onDirtyChange?.(false);
  }, [formDirty, onDirtyChange]);

  const versionMatches = events?.projectVersion === projectVersion;
  const readOnly = projectStatus === 'ARCHIVED' || !mutationReady;
  const canWrite = !readOnly && !blocked && !loading && !fetching && !failed && versionMatches && operation === undefined;
  const editingMissing = Boolean(editingId && versionMatches && !events?.events.some(event => event.id === editingId));
  const formLocked = !canWrite || Boolean(pendingIntent);
  const orderedEvents = [...(events?.events ?? [])].sort((left, right) => left.date.localeCompare(right.date));
  const titleCount = countVisibleCharacters(draft.title);
  const noteCount = countVisibleCharacters(draft.note);
  const visibleErrors = submitted ? validateSpecialDate(draft, projectYear) : errors;

  async function refreshProjectData() {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: projectKeys.ar(actorId, projectId), refetchType: 'active' }),
      queryClient.invalidateQueries({ queryKey: projectKeys.specialDates(actorId, projectId), refetchType: 'active' }),
      queryClient.invalidateQueries({ queryKey: projectKeys.detail(actorId, projectId), refetchType: 'active' }),
      queryClient.invalidateQueries({ queryKey: projectKeys.months(actorId, projectId), refetchType: 'active' }),
      queryClient.invalidateQueries({ queryKey: projectKeys.lists(actorId), refetchType: 'active' }),
    ]);
  }

  function commitRevision(result: SpecialDateRevision, mode: 'create' | 'update') {
    queryClient.setQueryData<SpecialDatesRevision>(projectKeys.specialDates(actorId, projectId), current => {
      if (!current || current.projectVersion !== projectVersion) return current;
      const event: SpecialDate = { id: result.id, date: result.date, title: result.title, note: result.note ?? null };
      const nextEvents = mode === 'create' ? [...current.events, event] : current.events.map(item => item.id === event.id ? event : item);
      return { events: nextEvents, projectVersion: result.projectVersion };
    });
    queryClient.setQueryData<ProjectMonths>(projectKeys.months(actorId, projectId), current => current
      ? { ...current, projectVersion: result.projectVersion } : current);
    queryClient.setQueryData(projectKeys.detail(actorId, projectId), current => current && typeof current === 'object'
      ? { ...current, version: result.projectVersion } : current);
  }

  function resetForm() {
    setDraft(emptySpecialDateDraft());
    setEditingId(undefined);
    editingVersion.current = undefined;
    setErrors({});
    setSubmitted(false);
  }

  function reviewEvent(eventId = editingId) {
    setErrorMessage(copy.versionConflict);
    onConflict(eventId, reviewedVersion => {
      if (eventId === editingId) editingVersion.current = reviewedVersion;
      setErrorMessage('');
    });
  }

  function showError(error: unknown, fallback: string, eventId = editingId) {
    const details = errorDetails(error);
    setMessage('');
    if (details.status === 412 || details.code === 'VERSION_CONFLICT') {
      reviewEvent(eventId);
      return 'conflict';
    }
    if (details.status === 409 || details.code === 'CONFLICT' || details.code === 'IDEMPOTENCY_CONFLICT') {
      setErrorMessage(copy.conflictError);
      void refreshProjectData();
      return 'known';
    }
    if (details.status === 422) {
      const fieldErrors: SpecialDateFieldErrors = {};
      for (const field of details.fields) {
        const path = field.path.split(/[.\[\]]/).filter(Boolean).at(-1);
        if (path === 'date' || path === 'title' || path === 'note') fieldErrors[path] = 'SERVER_REJECTED';
      }
      setErrors(fieldErrors);
      setSubmitted(false);
      setErrorMessage(copy.validationError);
      return 'validation';
    }
    if (details.code === 'NOT_FOUND' && eventId) {
      reviewEvent(eventId);
      return 'known';
    }
    if (details.code === 'FORBIDDEN' || details.code === 'NOT_FOUND') {
      setErrorMessage(copy.requestError);
      void refreshProjectData();
      return 'known';
    }
    setErrorMessage(fallback);
    return details.retryable || details.status >= 500 || details.status === 0 ? 'uncertain' : 'known';
  }

  async function sendCreate(intent: CreateIntent) {
    if (!canWrite) return;
    setOperation('create');
    setErrorMessage('');
    setMessage('');
    try {
      const result = await api.createSpecialDate(projectId, intent.body, intent.key, intent.version);
      commitRevision(result, 'create');
      setPendingIntent(undefined);
      resetForm();
      setMessage(copy.created);
      void refreshProjectData();
    } catch (error) {
      const outcome = showError(error, copy.saveError);
      if (outcome !== 'uncertain') setPendingIntent(undefined);
    } finally {
      setOperation(undefined);
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canWrite || pendingIntent || editingMissing) return;
    setSubmitted(true);
    setMessage('');
    setErrorMessage('');
    const validation = validateSpecialDate(draft, projectYear);
    setErrors(validation);
    if (Object.keys(validation).length) return;
    const body = specialDateWrite(draft);
    if (editingId) {
      if (editingVersion.current !== projectVersion) { reviewEvent(); return; }
      setOperation('update');
      try {
        const result = await api.updateSpecialDate(projectId, editingId, body, editingVersion.current);
        commitRevision(result, 'update');
        resetForm();
        setMessage(copy.updated);
        void refreshProjectData();
      } catch (error) { showError(error, copy.saveError); }
      finally { setOperation(undefined); }
      return;
    }
    const intent = { body, key: crypto.randomUUID(), version: projectVersion };
    setPendingIntent(intent);
    await sendCreate(intent);
  }

  async function deleteEvent(event: SpecialDate) {
    if (!canWrite) return;
    setOperation('delete');
    setMessage('');
    setErrorMessage('');
    try {
      await api.deleteSpecialDate(projectId, event.id, projectVersion);
      queryClient.setQueryData<SpecialDatesRevision>(projectKeys.specialDates(actorId, projectId), current => current
        ? { ...current, events: current.events.filter(item => item.id !== event.id) } : current);
      if (editingId === event.id) resetForm();
      setMessage(copy.deleted);
      await refreshProjectData();
    } catch (error) { showError(error, copy.deleteError, event.id); }
    finally { setOperation(undefined); }
  }

  function editEvent(event: SpecialDate) {
    setEditingId(event.id);
    editingVersion.current = projectVersion;
    setDraft({ date: event.date, title: event.title, note: event.note ?? '' });
    setErrors({});
    setSubmitted(false);
    setErrorMessage('');
    setMessage('');
  }

  function changeDraft(field: keyof SpecialDateDraft, value: string) {
    setDraft(current => ({ ...current, [field]: value }));
    setErrors(current => {
      if (submitted) return validateSpecialDate({ ...draft, [field]: value }, projectYear);
      if (current[field] !== 'SERVER_REJECTED') return current;
      const next = { ...current };
      delete next[field];
      return next;
    });
    setErrorMessage('');
    setMessage('');
  }

  return <section className={styles.panel} aria-labelledby={`${formId}-heading`}>
    <div className={styles.panelHeading}>
      <div><h2 id={`${formId}-heading`}>{copy.heading}</h2><p>{copy.description}</p></div>
    </div>
    {projectStatus === 'ARCHIVED' && <p role="status" className={styles.notice}>{copy.archived}</p>}
    {loading && <p role="status" className={styles.notice}>{copy.loading}</p>}
    {failed && <div role="alert" className={styles.notice}><p>{copy.error}</p><Button variant="secondary" onClick={onRetry}>{copy.retry}</Button></div>}
    {!loading && !failed && events && !versionMatches && <div role="alert" className={styles.notice}><p>{copy.stale}</p><Button variant="secondary" onClick={onRetry}>{copy.retry}</Button></div>}

    {events && versionMatches && <>
      <div className={styles.eventList} aria-labelledby={`${formId}-list-heading`}>
        <h3 id={`${formId}-list-heading`}>{copy.listHeading} ({orderedEvents.length})</h3>
        {orderedEvents.length === 0 ? <p className={styles.empty}>{copy.empty}</p> :
          <ol className={styles.eventItems}>
            {orderedEvents.map(event => <li key={event.id} className={styles.eventItem}>
              <article>
                <div className={styles.eventText}>
                  <time dateTime={event.date}>{formatCivilDate(event.date, locale)}</time>
                  <h4>{event.title}</h4>
                  {event.note && <p>{event.note}</p>}
                </div>
                <div className={styles.eventActions}>
                  <Button variant="secondary" disabled={!canWrite || Boolean(pendingIntent)} onClick={() => editEvent(event)}>{copy.edit}</Button>
                  <Dialog triggerLabel={copy.remove} title={copy.deleteTitle} description={copy.deleteDescription}
                    cancelLabel={copy.deleteCancel} confirmLabel={copy.deleteConfirm} destructive disabled={!canWrite || Boolean(pendingIntent)}
                    onConfirm={() => void deleteEvent(event)} />
                </div>
              </article>
            </li>)}
          </ol>}
      </div>

      <form className={styles.form} noValidate onSubmit={submit}>
        <h3>{editingId ? copy.edit : copy.add}</h3>
        {editingMissing && <div role="alert"><p>{copy.removedWhileEditing}</p>
          <Button variant="secondary" disabled={!canWrite} onClick={() => reviewEvent()}>{copy.reviewCurrent}</Button></div>}
        <div className={styles.field}>
          <label htmlFor={`${formId}-date`}>{copy.date}</label>
          <Input id={`${formId}-date`} type="date" value={draft.date} disabled={formLocked}
            aria-invalid={Boolean(visibleErrors.date)} aria-describedby={`${formId}-date-help${visibleErrors.date ? ` ${formId}-date-error` : ''}`}
            onChange={event => changeDraft('date', event.target.value)} />
          <p id={`${formId}-date-help`} className={styles.help}>{copy.dateHelp}</p>
          {visibleErrors.date && <p id={`${formId}-date-error`} className={styles.fieldError} role="alert">{visibleErrors.date === 'SERVER_REJECTED' ? copy.serverFieldError : visibleErrors.date === 'WRONG_YEAR' ? copy.wrongYear : copy.invalidDate}</p>}
        </div>
        <div className={styles.field}>
          <label htmlFor={`${formId}-title`}>{copy.title}</label>
          <Input id={`${formId}-title`} value={draft.title} disabled={formLocked} aria-invalid={Boolean(visibleErrors.title)}
            aria-describedby={`${formId}-title-help ${formId}-title-count${visibleErrors.title ? ` ${formId}-title-error` : ''}`}
            onChange={event => changeDraft('title', event.target.value)} />
          <p id={`${formId}-title-help`} className={styles.help}>{copy.titleHelp}</p>
          <p id={`${formId}-title-count`} className={styles.help} aria-live="polite">{copy.titleCount(titleCount)}</p>
          {visibleErrors.title && <p id={`${formId}-title-error`} className={styles.fieldError} role="alert">{visibleErrors.title === 'SERVER_REJECTED' ? copy.serverFieldError : visibleErrors.title === 'REQUIRED' ? copy.titleRequired : copy.titleTooLong}</p>}
        </div>
        <div className={styles.field}>
          <label htmlFor={`${formId}-note`}>{copy.note} <span>({copy.optional})</span></label>
          <textarea id={`${formId}-note`} value={draft.note} disabled={formLocked} aria-invalid={Boolean(visibleErrors.note)}
            aria-describedby={`${formId}-note-help ${formId}-note-count${visibleErrors.note ? ` ${formId}-note-error` : ''}`}
            onChange={event => changeDraft('note', event.target.value)} />
          <p id={`${formId}-note-help`} className={styles.help}>{copy.noteHelp}</p>
          <p id={`${formId}-note-count`} className={styles.help} aria-live="polite">{copy.noteCount(noteCount)}</p>
          {visibleErrors.note && <p id={`${formId}-note-error`} className={styles.fieldError} role="alert">{visibleErrors.note === 'SERVER_REJECTED' ? copy.serverFieldError : copy.noteTooLong}</p>}
        </div>
        {errorMessage && <p role="alert" className={styles.fieldError}>{errorMessage}</p>}
        {message && <p role="status" className={styles.notice}>{message}</p>}
        {pendingIntent ? <div className={styles.intentActions}>
          <p role="status" className={styles.notice}>{copy.pendingCreate}</p>
          <Button variant="primary" disabled={!canWrite} loading={operation === 'create'} loadingLabel={copy.retryCreate}
            onClick={() => void sendCreate(pendingIntent)}>{copy.retryCreate}</Button>
          <Dialog triggerLabel={copy.abandonIntent} title={copy.abandonTitle} description={copy.abandonDescription}
            cancelLabel={copy.abandonCancel} confirmLabel={copy.abandonConfirm} onConfirm={() => setPendingIntent(undefined)} />
        </div> : <div className={styles.formActions}>
          {editingId && <Button variant="secondary" disabled={operation !== undefined} onClick={resetForm}>{copy.cancelEdit}</Button>}
          <Button variant="primary" type="submit" disabled={!canWrite || editingMissing} loading={operation === 'create' || operation === 'update'}
            loadingLabel={editingId ? copy.saveEdit : copy.saveNew}>{editingId ? copy.saveEdit : copy.saveNew}</Button>
        </div>}
      </form>
    </>}
  </section>;
}
