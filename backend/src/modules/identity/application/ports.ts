import type { TransactionContext } from '../../../platform/database/application/transactions';
import type { Account, AccountSession, AccountStatus, AccountStatusView, ActiveAccountPrincipal } from '../domain/identity';

export abstract class Clock { abstract now(): Date }
export abstract class ActiveAccounts {
  abstract withActiveAccount<T>(request: { secret?: string; csrf?: string; origin?: string }, mutation: boolean,
    work: (principal: ActiveAccountPrincipal, context: TransactionContext) => Promise<T>): Promise<T>;
}
export abstract class PasswordHash {
  abstract hash(password: string): Promise<string>;
  abstract verify(password: string, encoded: string | undefined): Promise<boolean>;
}
export abstract class IdentityPolicy {
  abstract readonly trustedProxyIPs: readonly string[];
  abstract readonly cookieName: string;
  abstract readonly secure: boolean;
  abstract assertConfigured(): void;
  abstract assertOrigin(value: string | undefined): void;
}
export abstract class Secrets {
  abstract random(): string;
  abstract digest(kind: string, value: string): string;
  abstract csrf(secret: string): string;
  abstract equal(left: string, right: string): boolean;
  abstract encrypt(value: string, binding: string): Uint8Array;
  abstract decrypt(value: Uint8Array, binding: string): string;
}
export abstract class AuthAttempts { abstract check(ip: string, email: string): void }
export interface Replay {
  requestDigest: string;
  safeResult: unknown;
  encryptedReplay: Uint8Array | null;
  replayExpiresAt: Date | null;
}
export abstract class IdentityRepository {
  abstract accountByEmail(email: string, context?: TransactionContext): Promise<Account | null>;
  abstract lockAccount(id: string, context: TransactionContext): Promise<Account | null>;
  abstract createAccount(email: string, passwordHash: string, now: Date, context: TransactionContext): Promise<Account>;
  abstract session(digest: string, context: TransactionContext): Promise<AccountSession | null>;
  abstract lockSession(id: string, context: TransactionContext): Promise<AccountSession | null>;
  abstract createSession(data: { userId: string; digest: string; csrfDigest: string; now: Date }, context: TransactionContext): Promise<void>;
  abstract touchSession(id: string, now: Date, idleExpiresAt: Date, context: TransactionContext): Promise<void>;
  abstract revokeSession(id: string, now: Date, context: TransactionContext): Promise<void>;
  abstract replay(actorId: string, operation: string, key: string, context: TransactionContext): Promise<Replay | null>;
  abstract saveReplay(data: { actorId: string; operation: string; key: string; requestDigest: string; result: AccountStatusView | { id: string }; encrypted?: Uint8Array; expiresAt?: Date; now: Date }, context: TransactionContext): Promise<void>;
  abstract changeStatus(id: string, status: AccountStatus, now: Date, restoreShares: boolean, reason: string, context: TransactionContext): Promise<AccountStatusView>;
  abstract audit(actorId: string, targetId: string, action: string, reason: string, requestId: string, now: Date, context: TransactionContext): Promise<void>;
}
