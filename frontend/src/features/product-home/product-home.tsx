'use client';
import Image from 'next/image';
import Link from 'next/link';
import { useTemplateList } from '../../api/templates';
import { usePreferences } from '../../design-system/foundations/preferences-provider';
import { ActionLink } from '../../design-system/primitives/action-link';
import { Button } from '../../design-system/primitives/button';
import { productCopy } from '../../i18n/product';
import { templateCopy } from '../../i18n/templates';
import { CalendarMockup } from '../templates/calendar-mockup';
import styles from './product-home.module.css';

const previewQuery = { limit: 3 };

function PublishedDesigns() {
  const { locale } = usePreferences();
  const copy = productCopy[locale];
  const templates = templateCopy[locale];
  const { data, isPending, isError, isFetching, refetch } = useTemplateList(previewQuery);
  const designs = data?.data ?? [];

  return <section className={styles.collection} aria-labelledby="home-designs">
    <div className={`${styles.container} ${styles.showcase}`}>
      <div>
        <p className={styles.eyebrow}>{copy.collection}</p>
        <h2 id="home-designs">{copy.designs}</h2>
        <p className={styles.lead}>{copy.designIntro}</p>
        <Link className={styles.textLink} href="/templates">{copy.allDesigns} <span aria-hidden="true">→</span></Link>
      </div>
      <div>
        {isPending && <p role="status">{templates.loading}</p>}
        {isError && <div className={styles.state}>
          <p role="alert">{templates.errorTitle}</p>
          <Button loading={isFetching} loadingLabel={templates.loading} onClick={() => void refetch()}>{templates.retry}</Button>
        </div>}
        {!isError && !isPending && designs.length === 0 && <p role="status">{templates.emptyTitle}. {templates.emptyBody}</p>}
        {designs.length > 0 && <div className={styles.designs}>
          {designs.map(template => <Link key={template.id} className={styles.tile} href={`/templates/${encodeURIComponent(template.id)}`}
            tabIndex={0} aria-label={`${templates.open}: ${template.publishedRevision.name[locale]}`}>
            <div className={styles.tileStage}><CalendarMockup locale={locale} layout={template.publishedRevision.layout.type} /></div>
            <div className={styles.tileText}><strong>{template.publishedRevision.name[locale]}</strong><small>{templates.illustrationLabel}</small></div>
          </Link>)}
        </div>}
      </div>
    </div>
  </section>;
}

export function ProductHome() {
  const { locale } = usePreferences();
  const copy = productCopy[locale];
  const [opening, accent] = copy.title.split(', ');
  return <>
    <section className={styles.hero} aria-labelledby="home-title">
      <div className={`${styles.container} ${styles.heroGrid}`}>
        <div className={styles.intro}>
          <span className={styles.pill}><span aria-hidden="true">✦</span> {copy.utility}</span>
          <h1 id="home-title" className={styles.title}>{opening}, <span>{accent}</span></h1>
          <p>{copy.intro}</p>
          <div className={styles.actions}>
            <ActionLink href="/templates">{copy.browse} <span aria-hidden="true"> →</span></ActionLink>
            <Link className={styles.secondary} href="#home-start">{copy.footerSteps}</Link>
          </div>
          <ul className={styles.highlights}>
            {copy.highlights.map(item => <li key={item}><span aria-hidden="true">✓</span> {item}</li>)}
          </ul>
        </div>
        <figure className={styles.viewfinder}>
          <figcaption className={styles.frameLabel}><strong>{copy.sampleFrame}</strong><span>{copy.sampleCaption}</span></figcaption>
          <div className={styles.scene}>
            <CalendarMockup locale={locale} photo={<Image src="/calendar-family-sample.webp" alt={copy.sampleAlt} width={980} height={735} preload />} />
          </div>
          <p>{copy.sampleNote}</p>
        </figure>
      </div>
    </section>
    <div className={styles.factStrip}><dl className={`${styles.container} ${styles.facts}`}>
      {copy.facts.map(({ value, label }) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}
    </dl></div>
    <PublishedDesigns />
    <section id="home-start" className={styles.journey} aria-labelledby="home-start-title">
      <div className={styles.container}>
        <h2 id="home-start-title">{copy.start}</h2>
        <ol className={styles.steps} role="list">
          {copy.steps.map(({ title, body }, index) => <li key={title}>
            <span className={styles.stepIndex} aria-hidden="true">{index + 1}</span>
            <div><h3>{title}</h3><p>{body}</p></div>
          </li>)}
        </ol>
      </div>
    </section>
    <section id="home-faq" className={styles.faq} aria-labelledby="home-faq-title">
      <div className={`${styles.container} ${styles.faqGrid}`}>
        <h2 id="home-faq-title">{copy.faq}</h2>
        <div className={styles.faqPanel}>{copy.questions.map(({ question, answer }) => <details key={question}><summary>{question}</summary><p>{answer}</p></details>)}</div>
      </div>
    </section>
    <section className={styles.closing} aria-labelledby="home-closing">
      <div className={styles.container}><div className={styles.closingGrid}>
        <div><h2 id="home-closing">{copy.closing}</h2><p>{copy.closingNote}</p></div>
        <ActionLink href="/templates">{copy.closingAction} <span aria-hidden="true"> →</span></ActionLink>
      </div></div>
    </section>
  </>;
}
