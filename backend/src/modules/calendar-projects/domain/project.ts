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
  | 'NOT_FOUND'
  | 'INVALID_TRANSITION'
  | 'PROJECT_HAS_ORDERS'
  | 'PRECONDITION_REQUIRED'
  | 'VERSION_CONFLICT';

export class ProjectError extends Error {
  constructor(
    readonly code: ProjectErrorCode,
    readonly field?: ProjectNameField | 'year' | 'stylePresetId' | 'confirmed',
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
