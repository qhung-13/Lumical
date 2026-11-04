'use client';
// I04-P04 — revision form shared by create (F2) and publish (F3).
// Client-side validation mirrors the backend limits for early help (F6) but the
// backend stays authoritative: server fieldErrors are merged under the matching
// field, and recoverable failures keep every entered value (F7). Nothing is sent
// before the review dialog confirms exactly what will be saved (publication
// review). Layout is frozen to the approved version 1 values.
import { useMemo, useState, type ReactNode } from 'react';
import { usePreferences } from '../../design-system/foundations/preferences-provider';
import type { Localised, TemplateCategory, TemplateLayoutType, TemplatePresetId } from '../../api/admin-templates';
import type { components } from '../../api/generated';
import { fieldErrorMessage, formatTemplateAdmin, templateAdminCopy, type TemplateAdminKey, type TemplateAdminLocale } from '../../i18n/admin-templates';
import { ModalLayer } from './modal-layer';
import { IconAlertCircle, IconCheck } from './icons';
import styles from './admin-template.module.css';

type RevisionLayout = NonNullable<components['schemas']['TemplateRevisionDto']['layout']>;

export interface RevisionDraft {
  category: TemplateCategory;
  name: Localised;
  description: Localised;
  /** Frozen approved layout — version 1 values only (contract §17). */
  layout: RevisionLayout;
  presets: { id: TemplatePresetId; name: Localised }[];
  price: { currency: 'USD'; unitPriceMinor: number };
  reason?: string;
}

export type RevisionBody = Pick<RevisionDraft, 'name' | 'description' | 'layout' | 'presets' | 'price'>;

/** Only the five keys revisionInput accepts — category/reason never ride inside the revision. */
export function toRevisionBody(draft: RevisionDraft): RevisionBody {
  const { name, description, layout, presets, price } = draft;
  return { name, description, layout, presets, price };
}

export interface RevisionFormState {
  category: TemplateCategory | '';
  nameVi: string;
  nameEn: string;
  descVi: string;
  descEn: string;
  layout: TemplateLayoutType;
  presets: TemplatePresetId[];
  price: string;
  reason: string;
}

export const initialRevisionState = (): RevisionFormState => ({
  category: '', nameVi: '', nameEn: '', descVi: '', descEn: '',
  layout: 'PHOTO_FOCUS', presets: [], price: '', reason: '',
});

const PRESET_ORDER: readonly TemplatePresetId[] = ['classic', 'minimal', 'vibrant'];
const PRESET_KEY: Record<TemplatePresetId, TemplateAdminKey> = { classic: 'presetClassic', minimal: 'presetMinimal', vibrant: 'presetVibrant' };
const CATEGORIES: readonly TemplateCategory[] = ['GENERAL', 'BIRTHDAY', 'ANNIVERSARY', 'HOLIDAY'];
const CATEGORY_KEY: Record<TemplateCategory, TemplateAdminKey> = { GENERAL: 'catGeneral', BIRTHDAY: 'catBirthday', ANNIVERSARY: 'catAnniversary', HOLIDAY: 'catHoliday' };

/** The approved default name for each preset, in both locales (contract: name is required per preset). */
export function presetDefaultName(id: TemplatePresetId): Localised {
  const key = PRESET_KEY[id];
  return { vi: templateAdminCopy.vi[key], en: templateAdminCopy.en[key] };
}

export type RevisionErrorKey =
  | 'category' | 'name.vi' | 'name.en' | 'description.vi' | 'description.en'
  | 'layout' | 'presets' | 'price' | 'reason';

export type RevisionErrors = Partial<Record<RevisionErrorKey, string>>;

/** USD text (max 2 decimals) → positive integer minor units; null when malformed. */
export function parseUsdMinor(input: string): number | null {
  const text = input.trim();
  if (!/^\d+(?:\.\d{1,2})?$/.test(text)) return null;
  const [whole, frac = ''] = text.split('.');
  const major = Number(whole);
  if (!Number.isSafeInteger(major)) return null;
  const minor = major * 100 + Number(frac.padEnd(2, '0'));
  if (!Number.isSafeInteger(minor) || minor < 1) return null;
  return minor;
}

const trimmedLength = (value: string) => Array.from(value.trim()).length;
const textError = (value: string, t: (k: TemplateAdminKey) => string): string | undefined =>
  trimmedLength(value) === 0 ? t('errRequired') : trimmedLength(value) > 500 ? t('errTextMax') : undefined;

/** Mirror of the backend revision rules (docs/API_CONTRACT.md §17) for early, local help. */
export function validateRevision(state: RevisionFormState, locale: TemplateAdminLocale, mode: 'create' | 'publish'): RevisionErrors {
  const t = (key: TemplateAdminKey) => formatTemplateAdmin(locale, key);
  const errors: RevisionErrors = {};
  if (mode === 'create' && !state.category) errors.category = t('errRequired');
  const nameVi = textError(state.nameVi, t); if (nameVi) errors['name.vi'] = nameVi;
  const nameEn = textError(state.nameEn, t); if (nameEn) errors['name.en'] = nameEn;
  const descVi = textError(state.descVi, t); if (descVi) errors['description.vi'] = descVi;
  const descEn = textError(state.descEn, t); if (descEn) errors['description.en'] = descEn;
  if (state.presets.length === 0) errors.presets = t('errPresets');
  if (parseUsdMinor(state.price) === null) errors.price = t('errPrice');
  if (trimmedLength(state.reason) > 1000) errors.reason = t('errReason');
  return errors;
}

export function toRevisionDraft(state: RevisionFormState): RevisionDraft {
  return {
    category: (state.category || 'GENERAL') as TemplateCategory,
    name: { vi: state.nameVi.trim(), en: state.nameEn.trim() },
    description: { vi: state.descVi.trim(), en: state.descEn.trim() },
    layout: { version: 1, type: state.layout, monthCount: 12, maxImagesPerMonth: 4 },
    presets: state.presets.map((id) => ({ id, name: presetDefaultName(id) })),
    price: { currency: 'USD', unitPriceMinor: parseUsdMinor(state.price) ?? 1 },
    ...(state.reason.trim() ? { reason: state.reason.trim() } : {}),
  };
}

export interface FieldError {
  readonly path: string;
  readonly messageKey: string;
}

export interface RevisionFormProps {
  readonly mode: 'create' | 'publish';
  /** 422 fieldErrors from the backend (F6) — cleared by the parent on the next attempt. */
  readonly fieldErrors?: readonly FieldError[];
  /** Conflict banner or notice rendered above the form (F5). */
  readonly notice?: ReactNode;
  readonly pending?: boolean;
  readonly onSubmit: (draft: RevisionDraft) => void;
}

const FOCUS_ORDER: RevisionErrorKey[] = [
  'category', 'name.vi', 'name.en', 'description.vi', 'description.en', 'layout', 'presets', 'price', 'reason',
];

/** Form state key → error slot (state uses `nameVi`, errors use the contract path `name.vi`). */
const STATE_TO_ERROR: Partial<Record<keyof RevisionFormState, RevisionErrorKey>> = {
  category: 'category', nameVi: 'name.vi', nameEn: 'name.en', descVi: 'description.vi',
  descEn: 'description.en', layout: 'layout', presets: 'presets', price: 'price', reason: 'reason',
};

/** Map a backend field path (e.g. `price.unitPriceMinor`) to the form's error slot. */
function formErrorKey(path: string): RevisionErrorKey | null {
  if (path === 'price' || path.startsWith('price.')) return 'price';
  if (path === 'presets' || path.startsWith('presets.')) return 'presets';
  const known: RevisionErrorKey[] = ['category', 'name.vi', 'name.en', 'description.vi', 'description.en', 'layout', 'reason'];
  return (known as string[]).includes(path) ? (path as RevisionErrorKey) : null;
}

/** Where focus goes for each invalid field (event-handler side only — no refs during render). */
const FOCUS_TARGET: Record<RevisionErrorKey, string> = {
  category: '[name="category"]',
  'name.vi': '#revision-name-vi',
  'name.en': '#revision-name-en',
  'description.vi': '#revision-desc-vi',
  'description.en': '#revision-desc-en',
  layout: '[name="layout"]',
  presets: '[name="presets"]',
  price: '#revision-price',
  reason: '#revision-reason',
};

export function RevisionForm({ mode, fieldErrors = [], notice, pending = false, onSubmit }: RevisionFormProps) {
  const { locale } = usePreferences();
  const t = (key: TemplateAdminKey) => formatTemplateAdmin(locale, key);
  const [state, setState] = useState<RevisionFormState>(initialRevisionState);
  const [clientErrors, setClientErrors] = useState<RevisionErrors>({});
  const [reviewOpen, setReviewOpen] = useState(false);
  // Server paths dismissed by editing are scoped to the fieldErrors array that
  // produced them; a new attempt (new array) re-surfaces everything.
  const [dismissed, setDismissed] = useState<{ source: readonly FieldError[]; paths: string[] }>({ source: fieldErrors, paths: [] });
  const activeDismissed = useMemo(
    () => (dismissed.source === fieldErrors ? dismissed.paths : []),
    [dismissed, fieldErrors],
  );

  // Merge the server's 422 paths into the form (F6); drop them as the user edits.
  const serverErrors = useMemo<RevisionErrors>(() => {
    const merged: RevisionErrors = {};
    for (const error of fieldErrors) {
      const key = formErrorKey(error.path);
      if (key && !activeDismissed.includes(error.path)) merged[key] = fieldErrorMessage(locale, error.path);
    }
    return merged;
  }, [fieldErrors, activeDismissed, locale]);

  const errors: RevisionErrors = { ...clientErrors, ...serverErrors };
  const errorList = Object.entries(errors).filter(([, message]) => Boolean(message)) as [RevisionErrorKey, string][];

  const update = <K extends keyof RevisionFormState>(key: K, value: RevisionFormState[K]) => {
    setState((previous) => ({ ...previous, [key]: value }));
    const errorKey = STATE_TO_ERROR[key];
    if (!errorKey) return;
    setClientErrors((previous) => {
      if (!previous[errorKey]) return previous;
      const next = { ...previous };
      delete next[errorKey];
      return next;
    });
    const affected = fieldErrors.filter((error) => formErrorKey(error.path) === errorKey).map((error) => error.path);
    if (affected.length === 0) return;
    setDismissed((previous) => ({ source: fieldErrors, paths: [...new Set([...previous.paths, ...affected])] }));
  };

  const focusFirstError = (found: RevisionErrors) => {
    const first = FOCUS_ORDER.find((key) => found[key]);
    if (first) document.querySelector<HTMLElement>(FOCUS_TARGET[first])?.focus();
  };

  const requestReview = () => {
    const found = validateRevision(state, locale, mode);
    setClientErrors(found);
    if (Object.keys(found).length > 0) { focusFirstError(found); return; }
    setReviewOpen(true);
  };

  const confirm = () => { setReviewOpen(false); onSubmit(toRevisionDraft(state)); };

  const errorId = (key: RevisionErrorKey) => `revision-${key}-error`;
  const invalid = (key: RevisionErrorKey) => Boolean(errors[key]);

  const field = (
    key: RevisionErrorKey,
    id: string,
    label: string,
    control: (aria: { id: string; 'aria-describedby'?: string; 'aria-invalid'?: boolean }) => ReactNode,
    help?: string,
  ) => (
    <div className={styles.field}>
      <label className={styles.fieldLabel} htmlFor={id}>{label}</label>
      {control({ id, 'aria-describedby': invalid(key) ? errorId(key) : undefined, 'aria-invalid': invalid(key) || undefined })}
      {help && !invalid(key) && <p className={styles.fieldHelp}>{help}</p>}
      {invalid(key) && (
        <p className={styles.fieldError} id={errorId(key)} role="alert">
          <IconAlertCircle size={16} />{errors[key]}
        </p>
      )}
    </div>
  );

  return (
    <div data-testid="revision-form">
      {notice}
      {errorList.length > 0 && (
        <div className={`${styles.banner} ${styles.bannerDanger}`} role="alert" data-testid="form-error-summary">
          <IconAlertCircle size={20} />
          <div>
            <p className={styles.bannerTitle}>{t('errSummary')}</p>
            <ul className={styles.bannerCopy}>
              {errorList.map(([key]) => <li key={key}>{errors[key]}</li>)}
            </ul>
          </div>
        </div>
      )}

      <form
        className={styles.formSections}
        noValidate
        onSubmit={(event) => { event.preventDefault(); requestReview(); }}
      >
        <section className={styles.panel} aria-labelledby="revision-content-heading">
          <h2 className={styles.panelTitle} id="revision-content-heading">{t('sectionContent')}</h2>

          {mode === 'create' && (
            <fieldset className={styles.field} style={{ border: 0, padding: 0, margin: 0 }}>
              <legend className={styles.fieldLabel}>{t('categoryLabel')} <span className={styles.fieldRequired}>({t('reasonRequired')})</span></legend>
              <p className={styles.fieldHelp}>{t('categoryHelp')}</p>
              <div className={styles.choiceGrid}>
                {CATEGORIES.map((category) => (
                  <label key={category} className={`${styles.radioCard} ${state.category === category ? styles.radioCardSelected : ''}`}>
                    <input
                      type="radio" name="category" value={category}
                      checked={state.category === category}
                      onChange={() => update('category', category)}
                      
                      aria-describedby={invalid('category') ? errorId('category') : undefined}
                    />
                    {t(CATEGORY_KEY[category])}
                    <span className={styles.cardCheck}><IconCheck size={18} /></span>
                  </label>
                ))}
              </div>
              {invalid('category') && (
                <p className={styles.fieldError} id={errorId('category')} role="alert"><IconAlertCircle size={16} />{errors.category}</p>
              )}
            </fieldset>
          )}

          <div className={styles.field}>
            <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
              <legend className={styles.fieldLabel}>{t('layoutLabel')}</legend>
              <p className={styles.fieldHelp}>{t('layoutHelp')}</p>
              <div className={styles.choiceGrid}>
                {(['PHOTO_FOCUS', 'COLLAGE'] as const).map((type) => (
                  <label key={type} className={`${styles.radioCard} ${state.layout === type ? styles.radioCardSelected : ''}`}>
                    <input
                      type="radio" name="layout" value={type}
                      checked={state.layout === type}
                      onChange={() => update('layout', type)}
                      
                    />
                    {t(type === 'PHOTO_FOCUS' ? 'layoutPhotoFocus' : 'layoutCollage')}
                    <span className={styles.cardCheck}><IconCheck size={18} /></span>
                  </label>
                ))}
              </div>
            </fieldset>
          </div>

          <div className={styles.formGrid}>
            {field('name.vi', 'revision-name-vi', `${t('nameLabel')} — ${t('langVi')}`, (aria) => (
              <input className={`${styles.input} ${invalid('name.vi') ? styles.inputInvalid : ''}`} value={state.nameVi}
                maxLength={500} onChange={(event) => update('nameVi', event.target.value)}{...aria} />
            ))}
            {field('name.en', 'revision-name-en', `${t('nameLabel')} — ${t('langEn')}`, (aria) => (
              <input className={`${styles.input} ${invalid('name.en') ? styles.inputInvalid : ''}`} value={state.nameEn}
                maxLength={500} onChange={(event) => update('nameEn', event.target.value)}{...aria} />
            ))}
            {field('description.vi', 'revision-desc-vi', `${t('descLabel')} — ${t('langVi')}`, (aria) => (
              <textarea className={`${styles.textarea} ${invalid('description.vi') ? styles.textareaInvalid : ''}`} value={state.descVi}
                maxLength={500} onChange={(event) => update('descVi', event.target.value)}{...aria} />
            ))}
            {field('description.en', 'revision-desc-en', `${t('descLabel')} — ${t('langEn')}`, (aria) => (
              <textarea className={`${styles.textarea} ${invalid('description.en') ? styles.textareaInvalid : ''}`} value={state.descEn}
                maxLength={500} onChange={(event) => update('descEn', event.target.value)}{...aria} />
            ))}
          </div>
        </section>

        <section className={styles.panel} aria-labelledby="revision-presets-heading">
          <h2 className={styles.panelTitle} id="revision-presets-heading">{t('sectionPresets')}</h2>
          <p className={styles.panelIntro}>{t('presetsHelp')}</p>
          <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
            <legend className={styles.vh}>{t('sectionPresets')}</legend>
            <div className={styles.presetGrid}>
              {PRESET_ORDER.map((id) => {
                const selected = state.presets.includes(id);
                return (
                  <label key={id} className={`${styles.presetCard} ${selected ? styles.presetCardSelected : ''}`}>
                    <input
                      type="checkbox" name="presets" value={id} checked={selected}
                      onChange={() => update('presets', selected ? state.presets.filter((item) => item !== id) : [...state.presets, id])}
                      
                      aria-describedby={invalid('presets') ? errorId('presets') : undefined}
                    />
                    {t(PRESET_KEY[id])}
                    <span className={styles.cardCheck}><IconCheck size={18} /></span>
                  </label>
                );
              })}
            </div>
            {invalid('presets') && (
              <p className={styles.fieldError} id={errorId('presets')} role="alert"><IconAlertCircle size={16} />{errors.presets}</p>
            )}
          </fieldset>
        </section>

        <section className={styles.panel} aria-labelledby="revision-price-heading">
          <h2 className={styles.panelTitle} id="revision-price-heading">{t('sectionPrice')}</h2>
          <div className={styles.priceRow}>
            {field('price', 'revision-price', t('priceLabel'), (aria) => (
              <input className={`${styles.input} ${invalid('price') ? styles.inputInvalid : ''}`} value={state.price}
                inputMode="decimal" placeholder="24.00" onChange={(event) => update('price', event.target.value)}
               {...aria} />
            ), t('priceHelp'))}
            <p className={styles.pricePreview}>
              {parseUsdMinor(state.price) !== null
                ? t('pricePreview').replace('{minor}', String(parseUsdMinor(state.price)))
                : ' '}
            </p>
          </div>

          <div className={styles.field}>
            <label className={styles.fieldLabel} htmlFor="revision-reason">
              {t('reasonLabel')} <span className={styles.fieldRequired}>({t('reasonOptional')})</span>
            </label>
            <textarea
              className={`${styles.textarea} ${invalid('reason') ? styles.textareaInvalid : ''}`} id="revision-reason"
              value={state.reason} maxLength={1000} placeholder={t('reasonPh')}
              onChange={(event) => update('reason', event.target.value)}
              
              aria-describedby={invalid('reason') ? errorId('reason') : 'revision-reason-help'}
              aria-invalid={invalid('reason') || undefined}
            />
            {!invalid('reason') && <p className={styles.fieldHelp} id="revision-reason-help">{t('reasonHelp')}</p>}
            {invalid('reason') && (
              <p className={styles.fieldError} id={errorId('reason')} role="alert"><IconAlertCircle size={16} />{errors.reason}</p>
            )}
          </div>

          <div className={styles.dialogActions}>
            <button type="submit" className={`${styles.btn} ${styles.btnPrimary}`} disabled={pending} data-testid="review-submit">
              {mode === 'create' ? t('reviewCreateTitle') : t('reviewPublishTitle')}
            </button>
          </div>
        </section>
      </form>

      <ReviewDialog
        open={reviewOpen}
        mode={mode}
        state={state}
        pending={pending}
        onCancel={() => setReviewOpen(false)}
        onConfirm={confirm}
      />
    </div>
  );
}

interface ReviewDialogProps {
  readonly open: boolean;
  readonly mode: 'create' | 'publish';
  readonly state: RevisionFormState;
  readonly pending: boolean;
  readonly onCancel: () => void;
  readonly onConfirm: () => void;
}

/** Publication review (F3): show exactly what will be sent, then confirm. */
function ReviewDialog({ open, mode, state, pending, onCancel, onConfirm }: ReviewDialogProps) {
  const { locale } = usePreferences();
  const t = (key: TemplateAdminKey) => formatTemplateAdmin(locale, key);
  const minor = parseUsdMinor(state.price);
  const rows: { label: string; value: string }[] = [
    ...(mode === 'create' && state.category ? [{ label: t('summaryCategory'), value: t(CATEGORY_KEY[state.category]) }] : []),
    { label: t('summaryLayout'), value: `${t(state.layout === 'PHOTO_FOCUS' ? 'layoutPhotoFocus' : 'layoutCollage')} · 12 · ≤4` },
    { label: t('summaryName'), value: `${state.nameVi.trim()} / ${state.nameEn.trim()}` },
    { label: t('summaryDesc'), value: `${state.descVi.trim()} / ${state.descEn.trim()}` },
    { label: t('summaryPresets'), value: state.presets.map((id) => t(PRESET_KEY[id])).join(', ') },
    { label: t('summaryPrice'), value: minor !== null ? `${(minor / 100).toFixed(2)} USD → ${minor}` : state.price },
    ...(state.reason.trim() ? [{ label: t('summaryReason'), value: state.reason.trim() }] : []),
  ];

  return (
    <ModalLayer open={open} labelledBy="review-title" describedBy="review-desc" onDismiss={pending ? () => {} : onCancel}>
      <h2 className={styles.dialogTitle} id="review-title">
        {mode === 'create' ? t('reviewCreateTitle') : t('reviewPublishTitle')}
      </h2>
      <p className={styles.dialogDesc} id="review-desc">{t('reviewDesc')}</p>
      <dl className={styles.datalist}>
        {rows.map((row) => (
          <div className={styles.datalistRow} key={row.label}>
            <dt>{row.label}</dt>
            <dd>{row.value}</dd>
          </div>
        ))}
      </dl>
      <div className={styles.dialogActions}>
        <button type="button" className={`${styles.btn} ${styles.btnSecondary}`} onClick={onCancel} disabled={pending}>
          {t('cancel')}
        </button>
        <button type="button" className={`${styles.btn} ${styles.btnPrimary}`} onClick={onConfirm} disabled={pending} data-testid="review-confirm">
          {pending ? t('saving') : mode === 'create' ? t('confirmCreate') : t('confirmPublish')}
        </button>
      </div>
    </ModalLayer>
  );
}
