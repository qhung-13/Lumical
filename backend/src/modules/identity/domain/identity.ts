/// <reference lib="es2024.string" />
export type AccountRole = 'USER' | 'ADMIN';
export type AccountStatus = 'ACTIVE' | 'DISABLED';
export interface Principal {
  id: string;
  email: string;
  role: AccountRole;
  accountStatus: AccountStatus;
}
// Internal account identity. It grants no object ownership or recipient access.
export interface ActiveAccountPrincipal { kind: 'account'; id: string; role: AccountRole; accountStatus: 'ACTIVE' }
export interface Account {
  id: string;
  normalizedEmail: string;
  passwordHash: string;
  role: AccountRole;
  status: AccountStatus;
  version: number;
}
export interface AccountSession {
  id: string;
  userId: string;
  csrfDigest: string;
  lastActivityAt: Date;
  idleExpiresAt: Date;
  absoluteExpiresAt: Date;
  revokedAt: Date | null;
}
export interface AccountStatusView { id: string; status: AccountStatus; version: number }
export class IdentityError extends Error {
  constructor(
    readonly code: string,
    readonly status: number,
    readonly messageKey: string,
    readonly field?: 'email' | 'password' | 'reason' | 'status',
    readonly currentVersion?: number,
  ) { super(code); }
}
export const unauthenticated = () => new IdentityError('UNAUTHENTICATED', 401, 'errors.unauthenticated');
export const conflict = () => new IdentityError('CONFLICT', 409, 'errors.conflict');
export const unavailable = () => new IdentityError('PROVIDER_UNAVAILABLE', 503, 'errors.unavailable');
export function invalid(field?: IdentityError['field']): never {
  throw new IdentityError('VALIDATION_FAILED', 422, 'errors.validation', field);
}
// BR-ID-003/004. Passwords are counted as Unicode code points and never transformed.
export function credentials(input: unknown): { email: string; password: string } {
  if (!input || typeof input !== 'object' || Array.isArray(input)) invalid();
  const value = input as Record<string, unknown>;
  if (Object.keys(value).some((key) => !['email', 'password'].includes(key))) invalid();
  if (typeof value.email !== 'string') invalid('email');
  if (value.email.includes('\u0000') || !value.email.isWellFormed()) invalid('email');
  const email = value.email.trim().toLowerCase();
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(email)) invalid('email');
  if (typeof value.password !== 'string') invalid('password');
  // Reject ill-formed JSON strings rather than let UTF-8 encoding replace surrogates.
  if (Array.from(value.password).some(character => character.length === 1 && character.charCodeAt(0) >= 0xd800 && character.charCodeAt(0) <= 0xdfff)) invalid('password');
  const length = Array.from(value.password).length;
  if (length < 12 || length > 128) invalid('password');
  return { email, password: value.password };
}
export function statusChange(input: unknown): { status: AccountStatus; reason: string; restoreEligibleShares: boolean } {
  if (!input || typeof input !== 'object' || Array.isArray(input)) invalid();
  const value = input as Record<string, unknown>;
  if (Object.keys(value).some((key) => !['status', 'reason', 'restoreEligibleShares'].includes(key))) invalid();
  if (value.status !== 'ACTIVE' && value.status !== 'DISABLED') invalid('status');
  // 1000 code points is a technical payload bound, not a new business-purpose rule.
  if (typeof value.reason !== 'string' || !value.reason.trim() || Array.from(value.reason).length > 1000) invalid('reason');
  if (value.reason.includes('\u0000') || !value.reason.isWellFormed()) invalid('reason');
  if (value.restoreEligibleShares !== undefined && typeof value.restoreEligibleShares !== 'boolean') invalid();
  if (value.status === 'DISABLED' && value.restoreEligibleShares === true) invalid();
  return { status: value.status, reason: value.reason.trim(), restoreEligibleShares: value.restoreEligibleShares === true };
}
export function principal(account: Account): Principal {
  return { id: account.id, email: account.normalizedEmail, role: account.role, accountStatus: account.status };
}
// Resolves the single account cookie Identity accepts out of a Cookie header. Every module that
// must turn a request into a session secret shares this rule so none of them can drift apart.
export function accountCookie(header: string | undefined, name: string): string | undefined {
  const matches = (header ?? '').split(';').map((value) => value.trim()).filter((value) => value.startsWith(`${name}=`));
  if (matches.length !== 1) return undefined;
  const value = matches[0].slice(name.length + 1);
  return /^[A-Za-z0-9_-]{43}$/.test(value) ? value : undefined;
}

export const IDLE_MS = 24 * 60 * 60 * 1000;
export const ABSOLUTE_MS = 7 * IDLE_MS;
export function activeSession(session: AccountSession, account: Account, now: Date): boolean {
  return account.status === 'ACTIVE' && !session.revokedAt && session.idleExpiresAt > now && session.absoluteExpiresAt > now;
}
