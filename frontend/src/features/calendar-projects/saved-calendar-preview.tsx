'use client';
import Image from 'next/image';
import { useMemo, useState } from 'react';
import type { SavedCalendarPreview, SavedPreviewMonth } from './saved-calendar-preview-model';
import { savedCalendarPreviewCopy, savedCalendarPreviewMonthNames, savedCalendarPreviewWeekdayLabels, savedCalendarPreviewWeekdays, type PublicPreviewIssueCode } from './saved-calendar-preview-copy';
import styles from './saved-calendar-preview.module.css';

function daysInMonth(year: number, month: number) { return new Date(year, month, 0).getDate(); }
function firstWeekday(year: number, month: number) { return (new Date(year, month - 1, 1).getDay() + 6) % 7; }
function PrivatePreviewImage({ src, alt, unavailable }: { src: string; alt: string; unavailable: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) return <div className={styles.photoPlaceholder} role="img" aria-label={unavailable}>{unavailable}</div>;
  return <Image src={src} alt={alt} width={800} height={600} unoptimized onError={() => setFailed(true)} />;
}
function MonthCalendar({ data, snapshot, locale }: { data: SavedPreviewMonth; snapshot: SavedCalendarPreview; locale: 'en' | 'vi' }) {
  const text = savedCalendarPreviewCopy[locale]; const monthName = savedCalendarPreviewMonthNames[locale][data.monthNumber - 1];
  const events = snapshot.events.filter(event => event.date.startsWith(`${snapshot.year}-${String(data.monthNumber).padStart(2, '0')}-`));
  const count = daysInMonth(snapshot.year, data.monthNumber); const offset = firstWeekday(snapshot.year, data.monthNumber);
  const total = Math.ceil((offset + count) / 7) * 7;
  return <article className={styles.month} aria-label={`${monthName} ${snapshot.year}`}>
    <header className={styles.monthHeader}><div><h2>{monthName}</h2><span>{snapshot.year}</span></div><span className={styles.savedCount}>{text.image(data.images.length)}</span></header>
    <div className={styles.photos} data-layout={snapshot.layout}>
      {data.images.length ? data.images.map((image, index) => image.contentPath === `/api/v1/media/${image.assetId}/content`
        ? <PrivatePreviewImage key={`${image.assetId}-${index}`} src={image.contentPath} alt={image.altText} unavailable={text.unavailablePhoto} />
        : <div key={`${image.assetId}-${index}`} className={styles.photoPlaceholder} role="img" aria-label={text.unavailablePhoto}>{text.unavailablePhoto}</div>)
        : <p className={styles.photoPlaceholder}>{text.noImage}</p>}
    </div>
    <table className={styles.calendar}><caption>{monthName} {snapshot.year}</caption><thead><tr>{savedCalendarPreviewWeekdays[locale].map((day, index) => <th key={day} scope="col" aria-label={day}>{savedCalendarPreviewWeekdayLabels[locale][index]}</th>)}</tr></thead>
      <tbody>{Array.from({ length: total / 7 }, (_, week) => <tr key={week}>{Array.from({ length: 7 }, (_, col) => {
        const day = week * 7 + col - offset + 1; if (day < 1 || day > count) return <td key={col} />;
        const date = `${snapshot.year}-${String(data.monthNumber).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        return <td key={col}><span>{day}</span>{events.filter(event => event.date === date).map(event => <span className={styles.event} key={event.id}>{event.title}</span>)}</td>;
      })}</tr>)}</tbody>
    </table>
    <p className={styles.caption}>{data.caption?.trim() || text.noCaption}</p>
    {events.length > 0 && <ul className={styles.eventList}>{events.map(event => <li key={event.id}><time dateTime={event.date}>{event.date.slice(8, 10)}</time> — {event.title}{event.note ? `: ${event.note}` : ''}</li>)}</ul>}
    {!events.length && <p className={styles.emptyEvents}>{text.noEvents}</p>}
  </article>;
}

export function SavedCalendarPreview({ snapshot, locale }: { snapshot: SavedCalendarPreview; locale: 'en' | 'vi' }) {
  const text = savedCalendarPreviewCopy[locale]; const [mode, setMode] = useState<'year' | 'month'>('year'); const [selected, setSelected] = useState(1);
  const ordered = useMemo(() => [...snapshot.months].sort((a, b) => a.monthNumber - b.monthNumber), [snapshot.months]);
  const displayed = mode === 'year' ? ordered : ordered.filter(item => item.monthNumber === selected);
  return <section className={styles.page} aria-label={text.preview}>
    <header className={styles.heading}><div><h1>{snapshot.title}</h1><p>{snapshot.recipientName} · {snapshot.year}</p><p>{text.version(snapshot.projectVersion)}</p>
      {snapshot.status === 'ARCHIVED' && <p role="status">{text.archivedReadOnly}</p>}
    </div>
      <dl><div><dt>{text.style}</dt><dd>{text.presets[snapshot.stylePresetId as keyof typeof text.presets] ?? text.customStyle}</dd></div><div><dt>{text.layout}</dt><dd>{snapshot.layout === 'PHOTO_FOCUS' ? text.photoFocus : text.collage}</dd></div></dl></header>
    <div className={styles.controls} role="group" aria-label={text.preview}>
      <button type="button" aria-pressed={mode === 'year'} onClick={() => setMode('year')}>{text.year}</button>
      <button type="button" aria-pressed={mode === 'month'} onClick={() => setMode('month')}>{text.month}</button>
    </div>
    {mode === 'month' && <nav className={styles.monthNav} aria-label={text.month}>
      {savedCalendarPreviewMonthNames[locale].map((name, index) => <button type="button" key={name} aria-pressed={selected === index + 1} onClick={() => setSelected(index + 1)}>{name}</button>)}
    </nav>}
    <div className={mode === 'year' ? styles.yearGrid : styles.singleMonth}>{displayed.map(item => <MonthCalendar key={item.monthNumber} data={item} snapshot={snapshot} locale={locale} />)}</div>
    <section className={styles.readiness} aria-labelledby="preview-readiness-title">
      <h2 id="preview-readiness-title">{text.readiness}</h2>
      <p>{text.notPermission}</p>
      {([
        { title: text.previewStatus, ready: snapshot.readiness.previewReady, issues: snapshot.readiness.issues.preview },
        { title: text.arStatus, ready: snapshot.readiness.arReady, issues: snapshot.readiness.issues.ar },
        { title: text.contentStatus, ready: snapshot.readiness.orderReady, issues: snapshot.readiness.issues.order },
      ] as const).map(section => <div className={styles.readinessGroup} key={section.title}>
        <h3>{section.title}</h3>
        <p>{section.ready ? text.projectChecksPassed : text.projectChecksRemain}</p>
        {section.issues.length > 0 && <ul>{section.issues.map(code => <li key={code}>{text.issue[code as PublicPreviewIssueCode]}</li>)}</ul>}
      </div>)}
    </section>
    <details className={styles.readable}><summary>{text.readable}</summary><ol>{ordered.map(item => <li key={item.monthNumber}><h2>{savedCalendarPreviewMonthNames[locale][item.monthNumber - 1]} {snapshot.year}</h2>
      <p>{item.caption?.trim() || text.noCaption}</p><ul>{item.images.length ? item.images.map((image, index) => <li key={`${image.assetId}-${index}`}>{image.altText || text.unavailablePhoto}</li>) : <li>{text.noImage}</li>}
        {snapshot.events.filter(event => event.date.startsWith(`${snapshot.year}-${String(item.monthNumber).padStart(2, '0')}-`)).map(event => <li key={event.id}>{event.date}: {event.title}{event.note ? ` — ${event.note}` : ''}</li>)}
      </ul></li>)}</ol></details>
  </section>;
}
