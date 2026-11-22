'use client';
import { useEffect, useState } from 'react';
import type { ProjectApi, ProjectDetail, ProjectMonths, SpecialDatesRevision } from '../../api/projects';
import { Dialog } from '../../design-system/composites/dialog';
import { Button } from '../../design-system/primitives/button';
import { usePreferences } from '../../design-system/foundations/preferences-provider';
import { studioCopy } from '../../i18n/studio';
import styles from './studio.module.css';

export interface ConflictSnapshot {
  project: ProjectDetail;
  months: ProjectMonths;
  specialDates: SpecialDatesRevision;
}
export interface ConflictReviewRequest {
  target: { kind: 'month'; monthNumber: number } | { kind: 'specialDate'; eventId?: string } | { kind: 'style' };
  acknowledge: (snapshot: ConflictSnapshot) => void;
}

/** A temporary review snapshot, separate from all editable drafts. */
export function ProjectConflictReview({ projectId, api, request, onRefresh, onAcknowledged }: {
  projectId: string;
  api: ProjectApi;
  request: ConflictReviewRequest;
  onRefresh: (snapshot: ConflictSnapshot) => Promise<void>;
  onAcknowledged: () => void;
}) {
  const { locale } = usePreferences();
  const copy = studioCopy[locale];
  const review = copy.conflictReview;
  const [result, setResult] = useState<{ snapshot?: ConflictSnapshot; failed?: boolean }>({});
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    // Read all versioned projections. A partial/failed refresh is never reviewable.
    void Promise.all([api.detail(projectId, controller.signal), api.months(projectId, controller.signal),
      api.specialDates(projectId, controller.signal)]).then(async ([project, months, specialDates]) => {
      if (controller.signal.aborted) return;
      if (project.version !== months.projectVersion || project.version !== specialDates.projectVersion) throw new Error('Inconsistent review');
      const snapshot = { project, months, specialDates };
      await onRefresh(snapshot);
      if (!controller.signal.aborted) setResult({ snapshot });
    }).catch(() => {
      if (!controller.signal.aborted) setResult({ failed: true });
    });
    return () => controller.abort();
  }, [api, projectId, onRefresh, attempt]);

  const snapshot = result.snapshot;
  const target = request.target;
  const month = target.kind === 'month'
    ? snapshot?.months.months.find(month => month.monthNumber === target.monthNumber) : undefined;
  const events = target.kind === 'specialDate' ? snapshot?.specialDates.events.filter(event =>
    !target.eventId || event.id === target.eventId) : undefined;
  const preset = snapshot?.project.stylePresets.find(preset => preset.id === snapshot.project.stylePresetId);

  return <Dialog open dismissible={false} cancelDisabled={!snapshot} title={review.title}
    description={review.description} cancelLabel={review.acknowledge}
    onOpenChange={open => {
      if (!open && snapshot) { request.acknowledge(snapshot); onAcknowledged(); }
    }}>
    {!snapshot && !result.failed && <p role="status">{review.loading}</p>}
    {result.failed && <div role="alert"><p>{review.failed}</p><Button onClick={() => {
      setResult({}); setAttempt(value => value + 1);
    }}>{copy.retry}</Button></div>}
    {snapshot && <section className={styles.reviewContent} aria-label={review.savedContent}>
      <h3>{review.savedContent}</h3>
      <p>{review.serverVersion(snapshot.project.version)}</p>
      <p>{review.localDraft}</p>
      {month && <>
        <h4>{copy.monthNames[month.monthNumber - 1]}</h4>
        <dl><dt>{copy.caption}</dt><dd>{month.caption || copy.noCaption}</dd></dl>
        {month.images.length === 0 ? <p>{copy.editor.empty}</p> : <ol>{month.images.map((image, index) => <li key={`${image.assetId}:${index}`}>
          <dl><dt>{review.mediaId}</dt><dd>{image.assetId}</dd>
            <dt>{copy.editor.altText(index + 1)}</dt><dd>{image.altText || review.emptyAlt}</dd>
            <dt>{review.crop}</dt><dd>{copy.editor.defaultCrop}</dd></dl>
        </li>)}</ol>}
      </>}
      {events && <>
        <h4>{copy.specialDates.heading}</h4>
        {events.length === 0 ? <p>{request.target.kind === 'specialDate' && request.target.eventId ? review.eventRemoved : copy.specialDates.empty}</p>
          : events.map(event => <dl key={event.id}>
            <dt>{copy.specialDates.date}</dt><dd><time dateTime={event.date}>{event.date}</time></dd>
            <dt>{copy.specialDates.title}</dt><dd>{event.title}</dd>
            <dt>{copy.specialDates.note}</dt><dd>{event.note || review.noNote}</dd>
          </dl>)}
      </>}
      <dl><dt>{copy.preset}</dt><dd>{preset?.name[locale] ?? snapshot.project.stylePresetId} ({snapshot.project.stylePresetId})</dd></dl>
      {snapshot.project.status === 'ARCHIVED' && <p>{copy.archived}</p>}
    </section>}
  </Dialog>;
}
