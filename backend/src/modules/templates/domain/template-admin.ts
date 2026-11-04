import {
  TEMPLATE_CATEGORIES, TEMPLATE_LAYOUT_TYPES, TEMPLATE_PRESET_IDS, TemplateCatalogValidationError,
  projectPublicTemplate, type PublicTemplateRecord, type TemplateCategory, type TemplateLayoutType, type TemplatePresetId,
} from './template-catalog';

// Written to match exactly what the I01 projection will serve, so a revision can never be stored
// in a shape the public catalog refuses to read back.
export interface RevisionLayout { version: 1; type: TemplateLayoutType; monthCount: 12; maxImagesPerMonth: 4 }
export interface RevisionPreset { id: TemplatePresetId; name: { vi: string; en: string } }

// BR-TPL-004: deactivation/archive instead of hard deletion. ARCHIVED is a state, never an erase.
export const TEMPLATE_AVAILABILITIES = ['INACTIVE', 'ACTIVE', 'ARCHIVED'] as const;
export type TemplateAvailability = (typeof TEMPLATE_AVAILABILITIES)[number];

// Authority states the three operations without declaring ARCHIVED terminal. Every off-diagonal
// pair is therefore allowed and only a no-op repeat is rejected; make ARCHIVED terminal here if
// the review decides otherwise.
const ALLOWED_TRANSITIONS: Record<TemplateAvailability, readonly TemplateAvailability[]> = {
  INACTIVE: ['ACTIVE', 'ARCHIVED'],
  ACTIVE: ['INACTIVE', 'ARCHIVED'],
  ARCHIVED: ['INACTIVE', 'ACTIVE'],
};

export function canTransition(from: TemplateAvailability, to: TemplateAvailability): boolean {
  return from !== to && ALLOWED_TRANSITIONS[from].includes(to);
}

export class TemplateAdminError extends Error {
  constructor(readonly code: string, readonly status: number, readonly messageKey: string,
    readonly field?: string, readonly currentVersion?: number) { super(code); }
}

export const unauthenticated = () => new TemplateAdminError('UNAUTHENTICATED', 401, 'errors.unauthenticated');
export const forbidden = () => new TemplateAdminError('FORBIDDEN', 403, 'errors.forbidden');
export const notFound = () => new TemplateAdminError('NOT_FOUND', 404, 'errors.notFound');
export const conflict = () => new TemplateAdminError('CONFLICT', 409, 'errors.conflict');
export const invalidTransition = () => new TemplateAdminError('INVALID_TRANSITION', 409, 'errors.invalidTransition');
export const idempotencyConflict = () => new TemplateAdminError('IDEMPOTENCY_CONFLICT', 409, 'errors.idempotencyConflict');
export const versionConflict = (currentVersion: number) =>
  new TemplateAdminError('VERSION_CONFLICT', 412, 'errors.versionConflict', undefined, currentVersion);
export const preconditionRequired = () => new TemplateAdminError('PRECONDITION_REQUIRED', 428, 'errors.preconditionRequired');
export const unavailable = () => new TemplateAdminError('PROVIDER_UNAVAILABLE', 503, 'errors.unavailable');
// BR-TPL-001/003/004: an incomplete definition must never become ACTIVE.
export const incomplete = (field?: string) => new TemplateAdminError('INCOMPLETE_DEFINITION', 422, 'errors.incompleteDefinition', field);
// The request body is well formed; the Template's stored publication is what cannot be served.
// The contract reports that as a conflict with existing state (409), not something to correct.
export const incompletePublication = () => new TemplateAdminError('INCOMPLETE_PUBLICATION', 409, 'errors.incompletePublication');
export function invalid(field?: string): never {
  throw new TemplateAdminError('VALIDATION_FAILED', 422, 'errors.validation', field);
}

export interface AdminRequestContext { secret?: string; origin?: string; csrf?: string; requestId: string }

export interface TemplateRevisionInput {
  name: { vi: string; en: string };
  description: { vi: string; en: string };
  layout: RevisionLayout;
  presets: RevisionPreset[];
  price: { currency: 'USD'; unitPriceMinor: bigint };
}

export interface TemplateAdminState {
  id: string;
  category: TemplateCategory;
  availability: TemplateAvailability;
  version: number;
  currentPublishedRevisionId: string | null;
  published: PublicTemplateRecord | null;
  // Ordering key of the Admin list only; the response projection never exposes it.
  createdAt: Date;
}

export interface TemplateAdminView {
  id: string;
  category: TemplateCategory;
  availability: TemplateAvailability;
  version: number;
  currentPublishedRevisionId: string | null;
  publishedRevision: number | null;
}

const safeIntegerMax = BigInt(Number.MAX_SAFE_INTEGER);
// Placeholder identity used only while the completeness gate runs on a not-yet-persisted draft.
const DRAFT_ID = '00000000-0000-4000-8000-000000000000';
const TEXT_MAX = 500;

function text(value: unknown, field: string, max: number): string {
  if (typeof value !== 'string') invalid(field);
  // Reject ill-formed JSON strings rather than let UTF-8 encoding replace surrogates.
  if (value.includes('\u0000') || !value.isWellFormed()) invalid(field);
  // Trim first: a value that is only whitespace must fail here, not reach the completeness gate
  // and surface as INCOMPLETE_DEFINITION with no field to correct.
  const trimmed = value.trim();
  const length = Array.from(trimmed).length;
  if (length === 0 || length > max) invalid(field);
  return trimmed;
}

function localised(value: unknown, field: string, max: number): { vi: string; en: string } {
  if (!value || typeof value !== 'object' || Array.isArray(value)) invalid(field);
  const pair = value as Record<string, unknown>;
  if (Object.keys(pair).some((key) => key !== 'vi' && key !== 'en')) invalid(field);
  return { vi: text(pair.vi, `${field}.vi`, max), en: text(pair.en, `${field}.en`, max) };
}

function layout(value: unknown, field: string): RevisionLayout {
  if (!value || typeof value !== 'object' || Array.isArray(value)) invalid(field);
  const definition = value as Record<string, unknown>;
  const type = definition.type as TemplateLayoutType;
  // Exactly the four keys the published projection accepts; nothing experimental is stored.
  if (Object.keys(definition).length !== 4 || definition.version !== 1 ||
      !TEMPLATE_LAYOUT_TYPES.includes(type) || definition.monthCount !== 12 || definition.maxImagesPerMonth !== 4) invalid(field);
  if (type === 'COLLAGE') return { version: 1, type: 'COLLAGE', monthCount: 12, maxImagesPerMonth: 4 };
  return { version: 1, type: 'PHOTO_FOCUS', monthCount: 12, maxImagesPerMonth: 4 };
}

function presets(value: unknown, field: string): RevisionPreset[] {
  if (!Array.isArray(value) || value.length === 0) invalid(field);
  const seen = new Set<string>();
  return value.map((entry: unknown) => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) invalid(field);
    const preset = entry as Record<string, unknown>;
    const id = preset.id as TemplatePresetId;
    if (Object.keys(preset).length !== 2 || typeof preset.id !== 'string' || !TEMPLATE_PRESET_IDS.includes(id)) invalid(field);
    if (seen.has(id)) invalid(field);
    seen.add(id);
    return { id, name: localised(preset.name, field, 120) };
  });
}

function price(value: unknown, field: string): { currency: 'USD'; unitPriceMinor: bigint } {
  if (!value || typeof value !== 'object' || Array.isArray(value)) invalid(field);
  const amount = value as Record<string, unknown>;
  if (Object.keys(amount).length !== 2 || amount.currency !== 'USD') invalid(`${field}.currency`);
  if (typeof amount.unitPriceMinor !== 'number' || !Number.isSafeInteger(amount.unitPriceMinor)) invalid(`${field}.unitPriceMinor`);
  const unitPriceMinor = BigInt(amount.unitPriceMinor);
  if (unitPriceMinor <= 0n || unitPriceMinor > safeIntegerMax) invalid(`${field}.unitPriceMinor`);
  return { currency: 'USD', unitPriceMinor };
}

export function revisionInput(input: unknown): TemplateRevisionInput {
  if (!input || typeof input !== 'object' || Array.isArray(input)) invalid();
  const value = input as Record<string, unknown>;
  if (Object.keys(value).some((key) => !['name', 'description', 'layout', 'presets', 'price'].includes(key))) invalid();
  return {
    name: localised(value.name, 'name', TEXT_MAX),
    description: localised(value.description, 'description', TEXT_MAX),
    layout: layout(value.layout, 'layout'),
    presets: presets(value.presets, 'presets'),
    price: price(value.price, 'price'),
  };
}

function reason(input: unknown): string {
  if (typeof input !== 'string' || !input.trim() || Array.from(input).length > 1000) invalid('reason');
  if (input.includes('\u0000') || !input.isWellFormed()) invalid('reason');
  return input.trim();
}

export function availabilityChange(input: unknown): { availability: TemplateAvailability; reason: string } {
  if (!input || typeof input !== 'object' || Array.isArray(input)) invalid();
  const value = input as Record<string, unknown>;
  if (Object.keys(value).some((key) => key !== 'availability' && key !== 'reason')) invalid();
  if (!TEMPLATE_AVAILABILITIES.includes(value.availability as TemplateAvailability)) invalid('availability');
  return { availability: value.availability as TemplateAvailability, reason: reason(value.reason) };
}

export function createInput(input: unknown): { category: TemplateCategory; revision: TemplateRevisionInput; reason: string } {
  if (!input || typeof input !== 'object' || Array.isArray(input)) invalid();
  const value = input as Record<string, unknown>;
  if (Object.keys(value).some((key) => !['category', 'revision', 'reason'].includes(key))) invalid();
  if (typeof value.category !== 'string' || !TEMPLATE_CATEGORIES.includes(value.category as TemplateCategory)) invalid('category');
  return { category: value.category as TemplateCategory, revision: revisionInput(value.revision),
    reason: value.reason === undefined ? 'Initial catalog entry' : reason(value.reason) };
}

export function publishInput(input: unknown): { revision: TemplateRevisionInput; reason: string } {
  if (!input || typeof input !== 'object' || Array.isArray(input)) invalid();
  const value = input as Record<string, unknown>;
  if (Object.keys(value).some((key) => key !== 'revision' && key !== 'reason')) invalid();
  return { revision: revisionInput(value.revision), reason: value.reason === undefined ? 'Revision published' : reason(value.reason) };
}

export function draftRecord(category: TemplateCategory, revision: TemplateRevisionInput): PublicTemplateRecord {
  return record(DRAFT_ID, category, 1, revision);
}

export function record(id: string, category: TemplateCategory, revisionNumber: number, revision: TemplateRevisionInput): PublicTemplateRecord {
  return { id, category, revision: {
    id: DRAFT_ID, templateId: id, revision: revisionNumber,
    nameVi: revision.name.vi, nameEn: revision.name.en,
    descriptionVi: revision.description.vi, descriptionEn: revision.description.en,
    layoutDefinition: revision.layout, stylePresets: storedPresets(revision.presets),
    unitPriceMinor: revision.price.unitPriceMinor, currency: revision.price.currency,
    publishedAt: new Date(0),
  } };
}

// The stored row keeps the flat { id, nameVi, nameEn } preset shape that P01's SQL completeness
// filter and projector both read. The API speaks the nested pair; writing that pair straight to
// JSONB would make every row invisible to the catalog and unprojectable on activation.
export function storedPresets(presets: readonly RevisionPreset[]): { id: TemplatePresetId; nameVi: string; nameEn: string }[] {
  return presets.map((preset) => ({ id: preset.id, nameVi: preset.name.vi, nameEn: preset.name.en }));
}

// BR-TPL-001: the read-side projector of I01 owns the definition of "complete", so activation and
// publication cannot drift from what the catalog will actually serve.
export function assertComplete(candidate: PublicTemplateRecord, field?: string): void {
  try { projectPublicTemplate(candidate); }
  catch (error) {
    if (error instanceof TemplateCatalogValidationError) throw incomplete(field);
    throw error;
  }
}

export function projectView(state: TemplateAdminState): TemplateAdminView {
  return { id: state.id, category: state.category, availability: state.availability, version: state.version,
    currentPublishedRevisionId: state.currentPublishedRevisionId,
    publishedRevision: state.published?.revision.revision ?? null };
}

// API contract §7: the Admin list pages by timestamp with an id tie-break, default limit 20 and
// maximum 50, so the cursor carries the ordered pair rather than a row offset.
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export interface AdminListQuery { state?: TemplateAvailability; after?: { createdAt: Date; id: string }; limit: number }

export function encodeAdminCursor(value: { createdAt: Date; id: string }): string {
  return Buffer.from(JSON.stringify({ createdAt: value.createdAt.toISOString(), id: value.id })).toString('base64url');
}

// A cursor is opaque to the client but not unvalidated: it must round-trip through base64url so
// exactly one token exists per page, and its timestamp must survive JSON without becoming Invalid Date.
function cursor(input: unknown): { createdAt: Date; id: string } | undefined {
  if (input === undefined) return undefined;
  if (typeof input !== 'string' || !input || Buffer.from(input, 'base64url').toString('base64url') !== input) invalid('cursor');
  let parsed: unknown;
  try { parsed = JSON.parse(Buffer.from(input, 'base64url').toString('utf8')); } catch { invalid('cursor'); }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) invalid('cursor');
  const value = parsed as Record<string, unknown>;
  if (Object.keys(value).length !== 2 || typeof value.createdAt !== 'string' || typeof value.id !== 'string' || !UUID.test(value.id)) invalid('cursor');
  const createdAt = new Date(value.createdAt);
  if (Number.isNaN(createdAt.getTime())) invalid('cursor');
  return { createdAt, id: value.id };
}

export function adminListInput(input: unknown): AdminListQuery {
  if (!input || typeof input !== 'object' || Array.isArray(input)) invalid();
  const value = input as Record<string, unknown>;
  if (Object.keys(value).some((key) => !['state', 'cursor', 'limit'].includes(key))) invalid();
  if (value.state !== undefined && !TEMPLATE_AVAILABILITIES.includes(value.state as TemplateAvailability)) invalid('state');
  const limit = value.limit === undefined ? 20 : value.limit;
  if (typeof limit !== 'number' || !Number.isSafeInteger(limit) || limit < 1 || limit > 50) invalid('limit');
  return { state: value.state as TemplateAvailability | undefined, after: cursor(value.cursor), limit };
}
