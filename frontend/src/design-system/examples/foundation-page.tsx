'use client';
import Link from 'next/link';
import { useRef, useState, type FormEvent } from 'react';
import { foundationCopy } from '../../i18n/foundation';
import { usePreferences } from '../foundations/preferences-provider';
import { FoundationShell, type FoundationArea } from '../layouts/foundation-shell';
import { Button } from '../primitives/button';
import { FormField } from '../composites/form-field';
import { Dialog } from '../composites/dialog';
import styles from './foundation.module.css';

export function FoundationPage({ area }: { area: FoundationArea }) {
  const { locale } = usePreferences();
  const copy = foundationCopy[locale];
  return <FoundationShell area={area}>
    <p className={styles.eyebrow}>{copy.eyebrow}</p>
    <h1>{area === 'public' ? copy.title : area === 'form' ? copy.formTitle : copy.adminTitle}</h1>
    <p className={styles.lead}>{area === 'public' ? copy.intro : area === 'form' ? copy.formIntro : copy.adminIntro}</p>
    <p className={styles.notice}>{copy.notice}</p>
    {area === 'public' ? <>
      <p><Link className={styles.actionLink} href="/foundation/form" tabIndex={0}>{copy.explore}</Link></p>
      <section className={styles.section} aria-labelledby="material-title"><h2 id="material-title">{copy.material}</h2><p>{copy.materialBody}</p></section>
      <section className={styles.section} aria-labelledby="access-title"><h2 id="access-title">{copy.accessible}</h2><p>{copy.accessibleBody}</p></section>
      <nav className={styles.links} aria-label={copy.account}><Link href="/register" tabIndex={0}>{copy.register}</Link><Link href="/login" tabIndex={0}>{copy.login}</Link><Link href="/account" tabIndex={0}>{copy.account}</Link></nav>
      <p><a href="/api/v1/health" tabIndex={0}>{copy.health}</a></p>
    </> : area === 'form' ? <FormExample /> : <section className={`${styles.section} ${styles.adminSection}`} aria-labelledby="data-title">
      <h2 id="data-title">{copy.dataTitle}</h2>
      <table className={styles.table}><caption>{copy.dataTitle}</caption>
        <thead><tr><th scope="col">{copy.item}</th><th scope="col">{copy.description}</th><th scope="col">{copy.status}</th></tr></thead>
        <tbody>{([1, 2, 3] as const).map(number => <tr key={number}><th scope="row">{copy[`row${number}`]}</th><td>{copy[`detail${number}`]}</td><td><span className={styles.ready}>{copy.ready}</span></td></tr>)}</tbody>
      </table>
      <ul className={styles.dataList}>{([1, 2, 3] as const).map(number => <li key={number}><h3>{copy[`row${number}`]}</h3><dl>
        <dt>{copy.description}</dt><dd>{copy[`detail${number}`]}</dd><dt>{copy.status}</dt><dd className={styles.ready}>{copy.ready}</dd>
      </dl></li>)}</ul>
    </section>}
  </FoundationShell>;
}

function FormExample() {
  const { locale } = usePreferences();
  const copy = foundationCopy[locale];
  const [value, setValue] = useState('');
  const [invalid, setInvalid] = useState(false);
  const [outcome, setOutcome] = useState<'valid' | 'cleared' | 'activated'>();
  const form = useRef<HTMLFormElement>(null);
  const submit = (event: FormEvent) => {
    event.preventDefault();
    const missing = !value.trim(); setInvalid(missing); setOutcome(missing ? undefined : 'valid');
    if (missing) form.current?.querySelector('input')?.focus();
  };
  return <div className={styles.formColumn}>
    <form ref={form} onSubmit={submit} noValidate>
      <FormField label={copy.label} requirementLabel={copy.required} description={copy.help} error={invalid ? copy.error : undefined}
        name="example" required value={value} onChange={event => { setValue(event.target.value); setInvalid(false); setOutcome(undefined); }} />
      <Button type="submit" variant="primary">{copy.validate}</Button>
    </form>
    <p>{copy.sample}</p>
    <div className={styles.section}>
      <Dialog triggerLabel={copy.open} title={copy.dialogTitle} description={copy.consequence} cancelLabel={copy.cancel} confirmLabel={copy.clear} destructive
        onConfirm={() => { setValue(''); setInvalid(false); setOutcome('cleared'); }}>
        <FormField label={copy.note} requirementLabel={copy.optional} description={copy.dialogHelp} />
      </Dialog>
      <p role="status">{outcome ? copy[outcome] : ''}</p>
    </div>
    <section className={styles.section} aria-labelledby="states-title"><h2 id="states-title">{copy.states}</h2>
      <div className={styles.controls}>
        <Button disabled aria-describedby="disabled-reason">{copy.disabled}</Button>
        <Button loading loadingLabel={copy.pending}>{copy.idle}</Button>
        <Button variant="outline" onClick={() => setOutcome('activated')}>{copy.idle}</Button><Button variant="ghost" onClick={() => setOutcome('activated')}>{copy.idle}</Button>
      </div><p id="disabled-reason">{copy.disabledReason}</p>
    </section>
  </div>;
}
