import type { ReactNode } from 'react';
import type { PublicTemplate } from '../../api/templates';
import styles from './calendar-mockup.module.css';

export function CalendarMockup({ locale, layout = 'PHOTO_FOCUS', photo }: {
  locale: 'en' | 'vi';
  layout?: PublicTemplate['publishedRevision']['layout']['type'];
  photo?: ReactNode;
}) {
  const month = locale === 'vi' ? 'Tháng Hai' : 'February';
  const weekdays = locale === 'vi' ? ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'] : ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

  return <div className={styles.stand} data-layout={layout}>
    <div className={styles.sheet}>
      {photo ? <div className={styles.photo}>{photo}</div> : <div className={styles.art} aria-hidden="true"><span /><i /><i /></div>}
      <div className={styles.print} aria-hidden="true">
        <span className={styles.month}>{month}</span>
        <div className={styles.weekdays}>{weekdays.map(day => <span key={day}>{day}</span>)}</div>
        <div className={styles.days}>{Array.from({ length: 28 }, (_, day) => <span key={day} data-day={day + 1} />)}</div>
      </div>
    </div>
  </div>;
}
