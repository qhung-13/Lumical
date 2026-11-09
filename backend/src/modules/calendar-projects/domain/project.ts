/// <reference lib="es2024.string" />

// Supplied by the backend authentication boundary separately from Project request data.
export interface ProjectAccount {
  readonly kind: 'account';
  readonly id: string;
  readonly accountStatus: 'ACTIVE' | 'DISABLED';
}
export type ActiveProjectAccount = ProjectAccount & {
  readonly accountStatus: 'ACTIVE';
};

export type ProjectStatus = 'WORKING' | 'ARCHIVED';
export interface ProjectRoot {
  readonly ownerId: string;
  readonly status: ProjectStatus;
  readonly version: number;
}

type ProjectNameField = 'title' | 'recipientName';
const projectNameSegmenter = new Intl.Segmenter('und', {
  granularity: 'grapheme',
});

export interface ProjectIdentity {
  readonly year: number;
  readonly title: string;
  readonly recipientName: string;
}
export type ProjectIdentityInput = Record<keyof ProjectIdentity, unknown>;

type ProjectErrorCode =
  | 'VALIDATION_FAILED'
  | 'UNAUTHENTICATED'
  | 'TEMPLATE_UNAVAILABLE'
  | 'IDEMPOTENCY_CONFLICT'
  | 'NOT_FOUND'
  | 'INVALID_TRANSITION'
  | 'PROJECT_HAS_ORDERS'
  | 'PRECONDITION_REQUIRED'
  | 'VERSION_CONFLICT';

// The field names §9 fieldErrors must be able to point at, including the P03 list filters.
export type ProjectField =
  | ProjectNameField
  | 'year'
  | 'stylePresetId'
  | 'confirmed'
  | 'state'
  | 'cursor'
  | 'limit';

export class ProjectError extends Error {
  constructor(
    readonly code: ProjectErrorCode,
    readonly field?: ProjectField,
    readonly currentVersion?: number,
  ) {
    super(code);
  }
}

export function projectName(input: unknown, field: ProjectNameField): string {
  if (
    typeof input !== 'string' ||
    input.includes('\u0000') ||
    !input.isWellFormed()
  ) {
    throw new ProjectError('VALIDATION_FAILED', field);
  }
  const value = input.trim().normalize('NFC');
  if (
    !/[^\p{White_Space}\p{Default_Ignorable_Code_Point}\p{Cc}\p{Cf}]/u.test(
      value,
    )
  ) {
    throw new ProjectError('VALIDATION_FAILED', field);
  }

  const graphemes = projectNameSegmenter.segment(value)[Symbol.iterator]();
  for (let count = 1; !graphemes.next().done; count += 1) {
    if (count > 80) throw new ProjectError('VALIDATION_FAILED', field);
  }
  return value;
}

function assertActiveAccount(
  account: ProjectAccount | null,
): asserts account is ActiveProjectAccount {
  if (account?.kind !== 'account' || account.accountStatus !== 'ACTIVE') {
    throw new ProjectError('UNAUTHENTICATED');
  }
}

// BR-PRJ-001/002/004. The year window applies only when establishing identity.
export function newProject(
  account: ProjectAccount | null,
  input: ProjectIdentityInput,
  currentYear: number,
): ProjectIdentity & ProjectRoot {
  assertActiveAccount(account);
  const { year } = input;
  if (
    typeof year !== 'number' ||
    !Number.isInteger(year) ||
    year < 1 ||
    year > 9999 ||
    year < currentYear ||
    year > currentYear + 2
  ) {
    throw new ProjectError('VALIDATION_FAILED', 'year');
  }
  return {
    ownerId: account.id,
    status: 'WORKING',
    version: 1,
    year,
    title: projectName(input.title, 'title'),
    recipientName: projectName(input.recipientName, 'recipientName'),
  };
}

export function assertProjectOwner(
  account: ProjectAccount | null,
  project: ProjectRoot,
): void {
  assertActiveAccount(account);
  if (account.id !== project.ownerId) throw new ProjectError('NOT_FOUND');
}

type ProjectAction =
  'READ' | 'EDIT' | 'PLACE_ORDER' | 'FIRST_SHARE' | 'MANAGE_EXISTING_SHARE';

// BR-PRJ-005/007. Sharing and Orders apply their own checks after this Project gate.
export function assertProjectAction(
  account: ProjectAccount | null,
  project: ProjectRoot,
  action: ProjectAction,
): void {
  assertProjectOwner(account, project);
  if (
    project.status === 'ARCHIVED' &&
    action !== 'READ' &&
    action !== 'MANAGE_EXISTING_SHARE'
  ) {
    throw new ProjectError('INVALID_TRANSITION');
  }
}

// Only the desired Project status is decided here. Order-bound shares are managed separately.
export function projectStatusAfter(
  account: ProjectAccount | null,
  project: ProjectRoot,
  action: 'ARCHIVE' | 'RESTORE',
): ProjectStatus {
  assertProjectOwner(account, project);
  return action === 'ARCHIVE' ? 'ARCHIVED' : 'WORKING';
}

// Trusted history covers every Order ever placed, including cancelled or closed Orders.
export type ProjectOrderHistory = 'NEVER_ORDERED' | 'HAS_ORDERS';

// BR-PRJ-006 / INV-14.
export function assertProjectDeletionEligible(
  account: ProjectAccount | null,
  project: ProjectRoot,
  orderHistory: ProjectOrderHistory,
): void {
  assertProjectOwner(account, project);
  if (orderHistory !== 'NEVER_ORDERED')
    throw new ProjectError('PROJECT_HAS_ORDERS');
}

// ---------------------------------------------------------------------------
// P03: safe read projections, identity-style edits and the owner list query.
// ---------------------------------------------------------------------------

export type ProjectLayoutType = 'PHOTO_FOCUS' | 'COLLAGE';

// The frozen published layout P02 copies onto every new Project.
export interface ProjectLayout {
  readonly version: 1;
  readonly type: ProjectLayoutType;
  readonly monthCount: 12;
  readonly maxImagesPerMonth: 4;
}

// The stored columns of one owned Project, as a structural type so this module
// never depends on a persistence adapter.
export interface ProjectFacts {
  readonly id: string;
  readonly title: string;
  readonly year: number;
  readonly recipientName: string;
  readonly status: ProjectStatus;
  readonly version: number;
  readonly stylePresetId: string;
  readonly baselineNameVi: string;
  readonly baselineNameEn: string;
  readonly baselineStyle: unknown;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

// API contract §16: identity, state, baseline and version. Owner, template
// revision, price and every other internal column stay on the server.
export interface ProjectView {
  readonly id: string;
  readonly title: string;
  readonly year: number;
  readonly recipientName: string;
  readonly status: ProjectStatus;
  readonly version: number;
  readonly stylePresetId: string;
  readonly baseline: {
    readonly name: { readonly vi: string; readonly en: string };
    readonly layout: ProjectLayout;
  };
  readonly createdAt: string;
  readonly updatedAt: string;
}

const projectLayoutTypes: readonly ProjectLayoutType[] = [
  'PHOTO_FOCUS',
  'COLLAGE',
];

// P02 writes this shape from an approved revision. A row that no longer matches
// is corruption rather than a client mistake, so it fails closed as a 500
// instead of being served as if it were an approved layout.
export function projectLayout(value: unknown): ProjectLayout {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('Corrupt Project baseline layout.');
  const stored = value as Record<string, unknown>;
  if (
    stored.version !== 1 ||
    stored.monthCount !== 12 ||
    stored.maxImagesPerMonth !== 4 ||
    typeof stored.type !== 'string' ||
    !projectLayoutTypes.includes(stored.type as ProjectLayoutType)
  )
    throw new Error('Corrupt Project baseline layout.');
  return {
    version: 1,
    type: stored.type as ProjectLayoutType,
    monthCount: 12,
    maxImagesPerMonth: 4,
  };
}

export function projectView(record: ProjectFacts): ProjectView {
  return {
    id: record.id,
    title: record.title,
    year: record.year,
    recipientName: record.recipientName,
    status: record.status,
    version: record.version,
    stylePresetId: record.stylePresetId,
    baseline: {
      name: { vi: record.baselineNameVi, en: record.baselineNameEn },
      layout: projectLayout(record.baselineStyle),
    },
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

// API contract §11: a replay answers with the outcome the intent originally
// bound, so the safe body is persisted with the record and served later. A
// stored body is untrusted input — its full shape is re-checked before it can
// shape a response, exactly as the Admin template replay does.
export function storedProjectView(value: unknown): ProjectView {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('Corrupt Project creation replay.');
  const stored = value as Record<string, unknown>;
  const baseline =
    stored.baseline && typeof stored.baseline === 'object' && !Array.isArray(stored.baseline)
      ? (stored.baseline as Record<string, unknown>)
      : undefined;
  const name =
    baseline?.name && typeof baseline.name === 'object' && !Array.isArray(baseline.name)
      ? (baseline.name as Record<string, unknown>)
      : undefined;
  const nameVi = name?.vi;
  const nameEn = name?.en;
  const layout = baseline?.layout;
  if (
    typeof stored.id !== 'string' ||
    typeof stored.title !== 'string' ||
    typeof stored.recipientName !== 'string' ||
    typeof stored.stylePresetId !== 'string' ||
    typeof stored.year !== 'number' ||
    !Number.isSafeInteger(stored.year) ||
    !PROJECT_STATUSES.includes(stored.status as ProjectStatus) ||
    typeof stored.version !== 'number' ||
    !Number.isSafeInteger(stored.version) ||
    stored.version < 1 ||
    typeof stored.createdAt !== 'string' ||
    Number.isNaN(Date.parse(stored.createdAt)) ||
    typeof stored.updatedAt !== 'string' ||
    Number.isNaN(Date.parse(stored.updatedAt)) ||
    typeof nameVi !== 'string' ||
    typeof nameEn !== 'string'
  )
    throw new Error('Corrupt Project creation replay.');
  return {
    id: stored.id,
    title: stored.title,
    year: stored.year,
    recipientName: stored.recipientName,
    status: stored.status as ProjectStatus,
    version: stored.version,
    stylePresetId: stored.stylePresetId,
    baseline: {
      name: { vi: nameVi, en: nameEn },
      // An unapproved layout shape is corruption, not a client mistake.
      layout: projectLayout(layout),
    },
    createdAt: stored.createdAt,
    updatedAt: stored.updatedAt,
  };
}

// BR-PRJ-003: a Project only moves between the presets approved for the
// revision it captured at creation; a patch never invents a new id.
export function assertCapturedStylePreset(
  capturedPresets: unknown,
  stylePresetId: string,
): void {
  const approved = Array.isArray(capturedPresets) ? capturedPresets : [];
  const known = approved.some(
    (preset) =>
      !!preset &&
      typeof preset === 'object' &&
      (preset as Record<string, unknown>).id === stylePresetId,
  );
  if (!known) throw new ProjectError('VALIDATION_FAILED', 'stylePresetId');
}

// The values one identity edit may change. Year is fixed at creation and the
// baseline is never rewritten (BR-PRJ-007).
export interface ProjectIdentityPatch {
  readonly title?: string;
  readonly recipientName?: string;
  readonly stylePresetId?: string;
}

// Validation only: the caller writes the result and advances the version in the
// same locked transaction as the read that produced these facts.
export function applyProjectPatch(
  record: ProjectFacts,
  capturedPresets: unknown,
  patch: ProjectIdentityPatch,
): ProjectIdentityPatch {
  if (patch.stylePresetId !== undefined)
    assertCapturedStylePreset(capturedPresets, patch.stylePresetId);
  return {
    ...(patch.title !== undefined ? { title: patch.title } : {}),
    ...(patch.recipientName !== undefined
      ? { recipientName: patch.recipientName }
      : {}),
    ...(patch.stylePresetId !== undefined
      ? { stylePresetId: patch.stylePresetId }
      : {}),
  };
}

// API contract §7: the owner list pages by timestamp with an id tie-break,
// default limit 20 and maximum 50, so the cursor carries the ordered pair.
export interface ProjectListQuery {
  readonly state?: ProjectStatus;
  readonly after?: { readonly createdAt: Date; readonly id: string };
  readonly limit: number;
}

export function encodeProjectCursor(value: {
  createdAt: Date;
  id: string;
}): string {
  return Buffer.from(
    JSON.stringify({ createdAt: value.createdAt.toISOString(), id: value.id }),
  ).toString('base64url');
}

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// Opaque to the client but not unvalidated: it must round-trip through
// base64url so exactly one token exists per page, and its timestamp must
// survive JSON without becoming Invalid Date.
function projectCursor(
  input: unknown,
): { readonly createdAt: Date; readonly id: string } | undefined {
  if (input === undefined) return undefined;
  if (
    typeof input !== 'string' ||
    !input ||
    Buffer.from(input, 'base64url').toString('base64url') !== input
  )
    throw new ProjectError('VALIDATION_FAILED', 'cursor');
  let parsed: unknown;
  try {
    parsed = JSON.parse(Buffer.from(input, 'base64url').toString('utf8'));
  } catch {
    throw new ProjectError('VALIDATION_FAILED', 'cursor');
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed))
    throw new ProjectError('VALIDATION_FAILED', 'cursor');
  const value = parsed as Record<string, unknown>;
  if (
    Object.keys(value).length !== 2 ||
    typeof value.createdAt !== 'string' ||
    typeof value.id !== 'string' ||
    !UUID.test(value.id)
  )
    throw new ProjectError('VALIDATION_FAILED', 'cursor');
  const createdAt = new Date(value.createdAt);
  if (Number.isNaN(createdAt.getTime()))
    throw new ProjectError('VALIDATION_FAILED', 'cursor');
  return { createdAt, id: value.id };
}

export const PROJECT_STATUSES: readonly ProjectStatus[] = [
  'WORKING',
  'ARCHIVED',
];

export function projectListInput(input: unknown): ProjectListQuery {
  if (!input || typeof input !== 'object' || Array.isArray(input))
    throw new ProjectError('VALIDATION_FAILED');
  const value = input as Record<string, unknown>;
  if (
    Object.keys(value).some(
      (key) => !['state', 'cursor', 'limit'].includes(key),
    )
  )
    throw new ProjectError('VALIDATION_FAILED');
  if (
    value.state !== undefined &&
    !PROJECT_STATUSES.includes(value.state as ProjectStatus)
  )
    throw new ProjectError('VALIDATION_FAILED', 'state');
  const limit = value.limit === undefined ? 20 : value.limit;
  if (
    typeof limit !== 'number' ||
    !Number.isSafeInteger(limit) ||
    limit < 1 ||
    limit > 50
  )
    throw new ProjectError('VALIDATION_FAILED', 'limit');
  return {
    state: value.state as ProjectStatus | undefined,
    after: projectCursor(value.cursor),
    limit,
  };
}
