'use client';
import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '../../design-system/primitives/button';
import { usePreferences } from '../../design-system/foundations/preferences-provider';
import { studioCopy } from '../../i18n/studio';
import { ProjectApiError, projectKeys, type ProjectApi, type ProjectDetail } from '../../api/projects';
import styles from './studio.module.css';

// P06/AC1: a curated style control. The option list is only ever the captured
// preset projection of this Project — never a hardcoded id and never free text —
// and saving is a normal conditional PATCH, so a stale version goes through the
// shared conflict review instead of overwriting anything.
interface Props {
  actorId: string;
  projectId: string;
  presets: ProjectDetail['stylePresets'];
  savedPresetId: string;
  version: number;
  projectStatus: 'WORKING' | 'ARCHIVED';
  mutationReady: boolean;
  /** True while a conflict review or a version mismatch holds every save. */
  blocked: boolean;
  api: ProjectApi;
  onDirtyChange: (dirty: boolean) => void;
  onConflict: (currentVersion?: number) => void;
}

type Status = 'idle' | 'dirty' | 'saving' | 'saved' | 'error' | 'versionConflict' | 'validation';

export function StyleEditor({ actorId, projectId, presets, savedPresetId, version, projectStatus,
  mutationReady, blocked, api, onDirtyChange, onConflict }: Props) {
  const { locale } = usePreferences();
  const copy = studioCopy[locale].style;
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState(savedPresetId);
  const [status, setStatus] = useState<Status>('idle');
  const dirty = selected !== savedPresetId;
  const readOnly = projectStatus === 'ARCHIVED' || !mutationReady;
  const fieldId = 'studio-style-preset';
  const helpId = 'studio-style-help';

  // The Studio guard needs to know about this draft; unmount never keeps it alive.
  useEffect(() => {
    onDirtyChange(dirty);
    return () => onDirtyChange(false);
  }, [dirty, onDirtyChange]);

  async function refresh() {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: projectKeys.detail(actorId, projectId), refetchType: 'active' }),
      queryClient.invalidateQueries({ queryKey: projectKeys.months(actorId, projectId), refetchType: 'active' }),
      queryClient.invalidateQueries({ queryKey: projectKeys.specialDates(actorId, projectId), refetchType: 'active' }),
      queryClient.invalidateQueries({ queryKey: projectKeys.lists(actorId), refetchType: 'active' }),
    ]);
  }

  async function save() {
    if (readOnly || blocked || !dirty || status === 'saving') return;
    setStatus('saving');
    try {
      const view = await api.patch(projectId, { stylePresetId: selected }, version);
      // Committed: merge the new core view, keeping detail-only keys, then bring
      // the child queries to the advanced Project version (G6).
      queryClient.setQueryData<ProjectDetail>(projectKeys.detail(actorId, projectId),
        current => current ? { ...current, ...view } : current);
      setStatus('saved');
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: projectKeys.months(actorId, projectId), refetchType: 'active' }),
        queryClient.invalidateQueries({ queryKey: projectKeys.specialDates(actorId, projectId), refetchType: 'active' }),
        queryClient.invalidateQueries({ queryKey: projectKeys.lists(actorId), refetchType: 'active' }),
      ]);
    } catch (error) {
      const failure = error instanceof ProjectApiError ? error : undefined;
      if (failure?.status === 412 || failure?.code === 'VERSION_CONFLICT') {
        // AC3: refresh the truth first, hand the version to the review dialog,
        // and leave `selected` untouched — the draft is never overwritten.
        setStatus('versionConflict');
        await refresh();
        onConflict(failure.currentVersion);
        return;
      }
      if (failure?.status === 422) { setStatus('validation'); return; }
      if (failure?.status === 409 || failure?.code === 'CONFLICT') {
        setStatus('error');
        await refresh();
        return;
      }
      setStatus('error');
    }
  }

  const message = status === 'saving' ? copy.saving
    : status === 'error' ? copy.saveError
      : status === 'versionConflict' ? copy.versionConflict
        : status === 'validation' ? copy.validation
          : dirty ? copy.draft
            : status === 'saved' ? copy.saved : copy.unchanged;
  const alert = status === 'error' || status === 'versionConflict' || status === 'validation';
  const disabled = readOnly || blocked || !dirty || status === 'saving';

  return <section className={styles.editorField}>
    <label htmlFor={fieldId}>{copy.heading}</label>
    <select id={fieldId} value={selected} disabled={readOnly || blocked || status === 'saving'}
      aria-describedby={helpId} onChange={event => { setSelected(event.target.value); setStatus('dirty'); }}>
      {presets.map(preset => <option key={preset.id} value={preset.id}>{locale === 'vi' ? preset.name.vi : preset.name.en}</option>)}
    </select>
    <p id={helpId} className={styles.fieldHelp}>{readOnly ? copy.archived : copy.description}</p>
    <p className={alert ? styles.editorError : styles.editorNotice} role={alert ? 'alert' : 'status'}>{message}</p>
    <Button variant="primary" disabled={disabled} loading={status === 'saving'} loadingLabel={copy.saving}
      onClick={() => void save()}>{copy.save}</Button>
  </section>;
}
