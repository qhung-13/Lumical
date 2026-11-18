'use client';
import Link from 'next/link';
import type { PublicTemplate, TemplateCategory } from '../../api/templates';
import { usePreferences } from '../../design-system/foundations/preferences-provider';
import { templateCopy } from '../../i18n/templates';
import { CalendarMockup } from './calendar-mockup';
import styles from './templates.module.css';

export function CategoryLabel({ category }: { category: TemplateCategory }) {
  const { locale } = usePreferences();
  return <span className={styles.category}>{templateCopy[locale].categories[category]}</span>;
}

export function TemplateIllustration({ template, label, labelText }: { template: PublicTemplate; label: string; labelText: string }) {
  const { locale } = usePreferences();
  return <div className={styles.illustration}>
    <div className={styles.mockup} role="img" aria-label={label}><CalendarMockup locale={locale} layout={template.publishedRevision.layout.type} /></div>
    <p className={styles.illustrationBadge}>{labelText}</p>
  </div>;
}

export function TemplateCard({ template }: { template: PublicTemplate }) {
  const { locale } = usePreferences();
  const copy = templateCopy[locale];
  const revision = template.publishedRevision;
  return <article className={styles.card}>
    <Link className={styles.cardLink} href={`/templates/${encodeURIComponent(template.id)}`} tabIndex={0}
      aria-label={`${copy.open}: ${revision.name[locale]}`}>
      <TemplateIllustration template={template} label={copy.illustration} labelText={copy.illustrationLabel} />
      <div className={styles.cardContent}>
        <CategoryLabel category={template.category} />
        <h3 className={styles.cardTitle}>{revision.name[locale]}</h3>
        <p>{revision.description[locale]}</p>
        <dl className={styles.specs}>
          <div><dt>{copy.layout}</dt><dd>{copy.layouts[revision.layout.type]}</dd></div>
          <div><dt>{copy.presets}</dt><dd>{revision.presets.map(preset => preset.name[locale]).join(' · ')}</dd></div>
        </dl>
        <span className={styles.price}>{copy.price(revision.price.unitPriceMinor)}</span>
        <span className={styles.cardAction}>{copy.open}<span aria-hidden="true"> →</span></span>
      </div>
    </Link>
  </article>;
}
