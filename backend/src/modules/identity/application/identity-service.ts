import { Inject, Injectable } from '@nestjs/common';
import { Transactions, type TransactionContext } from '../../../platform/database/application/transactions';
import { ActiveAccounts, AuthAttempts, Clock, IdentityPolicy, IdentityRepository, PasswordHash, Secrets, type Replay } from './ports';
import { IDLE_MS, IdentityError, activeSession, conflict, credentials, invalid, principal, statusChange, unauthenticated, unavailable,
  ABSOLUTE_MS, type Account, type AccountSession, type AccountStatusView, type ActiveAccountPrincipal, type Principal } from '../domain/identity';

export interface BrowserContext { secret?: string; origin?: string; csrf?: string; ip: string; requestId: string }
export interface SessionBootstrap { authenticated: boolean; principal?: Principal; csrfToken?: string }
export interface AuthResult { principal: Principal; csrfToken: string; secret: string; cookieExpiresAt: Date }

@Injectable()
export class IdentityService extends ActiveAccounts {
  constructor(@Inject(IdentityRepository) private readonly repository: IdentityRepository,
    @Inject(PasswordHash) private readonly passwords: PasswordHash,
    @Inject(Transactions) private readonly transactions: Transactions,
    @Inject(Clock) private readonly clock: Clock,
    @Inject(Secrets) private readonly secrets: Secrets,
    @Inject(IdentityPolicy) private readonly config: IdentityPolicy,
    @Inject(AuthAttempts) private readonly abuse: AuthAttempts) { super(); }
  async withActiveAccount<T>(request: { secret?: string; csrf?: string; origin?: string }, mutation: boolean,
    work: (principal: ActiveAccountPrincipal, context: TransactionContext) => Promise<T>): Promise<T> {
    if (mutation) this.config.assertOrigin(request.origin);
    this.config.assertConfigured();
    // A consuming use case owns retry of its entire workflow; nested run joins I01.
    return this.transactions.run(async (context) => {
      const active = await this.sessionIn(request.secret, context);
      if (!active) throw unauthenticated();
      if (mutation) this.csrf({ ...request, ip: '', requestId: '' }, active.session);
      return work({ kind: 'account', id: active.account.id, role: active.account.role, accountStatus: 'ACTIVE' }, context);
    });
  }

  private async atomic<T>(work: (context: TransactionContext) => Promise<T>, retryUnique = false): Promise<T> {
    this.config.assertConfigured();
    for (let attempt = 0; attempt < 3; attempt++) {
      try { return await this.transactions.run(work); }
      catch (error) {
        if (error instanceof IdentityError) throw error;
        const code = error && typeof error === 'object' && 'code' in error ? error.code : undefined;
        const metadata = error && typeof error === 'object' && 'meta' in error ? error.meta : undefined;
        const raw = metadata && typeof metadata === 'object' ? metadata as { code?: unknown; driverAdapterError?: { cause?: { originalCode?: unknown } } } : undefined;
        const sqlCode = raw?.code ?? raw?.driverAdapterError?.cause?.originalCode;
        if ((code === 'P2034' || code === 'P2010' && (sqlCode === '40001' || sqlCode === '40P01')) && attempt < 2) continue;
        if (code === 'P2002' && retryUnique && attempt < 2) continue;
        if (code === 'P2002') throw conflict();
        throw unavailable();
      }
    }
    throw unavailable();
  }
  private key(value: string | undefined): string {
    if (!value || !/^[A-Za-z0-9_-]{16,128}$/.test(value)) invalid();
    return value;
  }
  private replayMatches(replay: Replay, digest: string): void {
    if (!this.secrets.equal(replay.requestDigest, digest)) throw new IdentityError('IDEMPOTENCY_CONFLICT', 409, 'errors.idempotencyConflict');
  }
  private async sessionIn(secret: string | undefined, context: TransactionContext, touch = true): Promise<{ account: Account; session: AccountSession } | null> {
    if (!secret || !/^[A-Za-z0-9_-]{43}$/.test(secret)) return null;
    const found = await this.repository.session(this.secrets.digest('session', secret), context);
    if (!found) return null;
    const account = await this.repository.lockAccount(found.userId, context);
    const session = await this.repository.lockSession(found.id, context);
    const now = this.clock.now();
    if (!account || !session || !activeSession(session, account, now)) return null;
    // At most once per minute per session. Absolute expiry never moves.
    if (touch && now.getTime() - session.lastActivityAt.getTime() >= 60000) {
      await this.repository.touchSession(session.id, now, new Date(Math.min(now.getTime() + IDLE_MS, session.absoluteExpiresAt.getTime())), context);
    }
    return { account, session };
  }
  private csrf(browser: BrowserContext, session: AccountSession): void {
    if (!browser.csrf || !this.secrets.equal(this.secrets.digest('csrf-binding', browser.csrf), session.csrfDigest))
      throw new IdentityError('CSRF_REJECTED', 403, 'errors.csrfRejected');
  }
  private async createSession(account: Account, secret: string, context: TransactionContext): Promise<AuthResult> {
    const csrfToken = this.secrets.csrf(secret);
    const now = this.clock.now();
    await this.repository.createSession({ userId: account.id, digest: this.secrets.digest('session', secret),
      csrfDigest: this.secrets.digest('csrf-binding', csrfToken), now }, context);
    return { principal: principal(account), csrfToken, secret, cookieExpiresAt: new Date(now.getTime() + ABSOLUTE_MS) };
  }
  async register(input: unknown, key: string | undefined, browser: BrowserContext): Promise<AuthResult> {
    this.config.assertOrigin(browser.origin);
    const accepted = credentials(input); const intent = this.key(key);
    this.abuse.check(browser.ip, accepted.email);
    const requestDigest = this.secrets.digest('registration-request', JSON.stringify(accepted));
    const passwordHash = await this.passwords.hash(accepted.password);
    const secret = this.secrets.random();
    return this.atomic(async (context) => {
      const existing = await this.repository.accountByEmail(accepted.email, context);
      if (existing) {
        const account = await this.repository.lockAccount(existing.id, context);
        const replay = await this.repository.replay(existing.id, 'REGISTER_ACCOUNT', intent, context);
        if (!replay || !account || account.status !== 'ACTIVE') throw conflict();
        this.replayMatches(replay, requestDigest);
        if (!replay.encryptedReplay || !replay.replayExpiresAt || replay.replayExpiresAt <= this.clock.now()) throw conflict();
        const saved = this.secrets.decrypt(replay.encryptedReplay, `${account.id}:${intent}:${requestDigest}`);
        const active = await this.sessionIn(saved, context);
        if (!active) throw conflict();
        return { principal: principal(account), secret: saved, csrfToken: this.secrets.csrf(saved), cookieExpiresAt: active.session.absoluteExpiresAt };
      }
      const account = await this.repository.createAccount(accepted.email, passwordHash, this.clock.now(), context);
      const result = await this.createSession(account, secret, context);
      await this.repository.saveReplay({ actorId: account.id, operation: 'REGISTER_ACCOUNT', key: intent, requestDigest,
        result: { id: account.id }, encrypted: this.secrets.encrypt(secret, `${account.id}:${intent}:${requestDigest}`),
        expiresAt: new Date(this.clock.now().getTime() + IDLE_MS), now: this.clock.now() }, context);
      return result;
    }, true);
  }
  async login(input: unknown, browser: BrowserContext): Promise<AuthResult> {
    this.config.assertOrigin(browser.origin);
    const accepted = credentials(input);
    this.abuse.check(browser.ip, accepted.email);
    let account: Account | null;
    try { account = await this.repository.accountByEmail(accepted.email); } catch { throw unavailable(); }
    const valid = await this.passwords.verify(accepted.password, account?.passwordHash);
    if (!account || !valid || account.status !== 'ACTIVE') throw unauthenticated();
    const verified = account; const secret = this.secrets.random();
    return this.atomic(async (context) => {
      const current = await this.repository.lockAccount(verified.id, context);
      if (!current || current.status !== 'ACTIVE' || current.passwordHash !== verified.passwordHash) throw unauthenticated();
      if (browser.secret) {
        const previous = await this.repository.session(this.secrets.digest('session', browser.secret), context);
        if (previous) await this.repository.revokeSession(previous.id, this.clock.now(), context);
      }
      return this.createSession(current, secret, context);
    });
  }
  async bootstrap(browser: BrowserContext): Promise<SessionBootstrap> {
    return this.atomic(async (context) => {
      const active = await this.sessionIn(browser.secret, context);
      return active ? { authenticated: true, principal: principal(active.account), csrfToken: this.secrets.csrf(browser.secret!) } : { authenticated: false };
    });
  }
  async ownAccount(browser: BrowserContext): Promise<Principal> {
    return this.atomic(async (context) => {
      const active = await this.sessionIn(browser.secret, context);
      if (!active) throw unauthenticated();
      return principal(active.account);
    });
  }
  async logout(browser: BrowserContext): Promise<void> {
    this.config.assertOrigin(browser.origin);
    await this.atomic(async (context) => {
      const active = await this.sessionIn(browser.secret, context, false);
      if (!active) return;
      this.csrf(browser, active.session);
      await this.repository.revokeSession(active.session.id, this.clock.now(), context);
    });
  }
  private async admin(browser: BrowserContext, context: TransactionContext, mutation: boolean): Promise<Account> {
    const active = await this.sessionIn(browser.secret, context);
    if (!active) throw unauthenticated();
    if (mutation) this.csrf(browser, active.session);
    if (active.account.role !== 'ADMIN') throw new IdentityError('FORBIDDEN', 403, 'errors.forbidden');
    return active.account;
  }
  async accountStatus(id: string, browser: BrowserContext): Promise<AccountStatusView> {
    return this.atomic(async (context) => {
      const actor = await this.admin(browser, context, false);
      const target = await this.repository.lockAccount(id, context);
      if (!target) throw new IdentityError('NOT_FOUND', 404, 'errors.notFound');
      await this.repository.audit(actor.id, id, 'ACCOUNT_STATUS_READ', 'ACCOUNT_SECURITY_SUPPORT', browser.requestId, this.clock.now(), context);
      return { id, status: target.status, version: target.version };
    });
  }
  async changeAccountStatus(id: string, input: unknown, key: string | undefined, etag: string | undefined, browser: BrowserContext): Promise<AccountStatusView> {
    this.config.assertOrigin(browser.origin);
    const change = statusChange(input); const intent = this.key(key);
    if (!etag) throw new IdentityError('PRECONDITION_REQUIRED', 428, 'errors.preconditionRequired');
    const match = /^"([1-9][0-9]*)"$/.exec(etag);
    if (!match || !Number.isSafeInteger(Number(match[1]))) invalid();
    const expected = Number(match[1]); const operation = `ACCOUNT_STATUS:${id}`;
    const digest = this.secrets.digest('account-status-request', JSON.stringify({ ...change, expected }));
    return this.atomic(async (context) => {
      const actor = await this.admin(browser, context, true);
      const replay = await this.repository.replay(actor.id, operation, intent, context);
      if (replay) {
        this.replayMatches(replay, digest);
        const result = replay.safeResult;
        if (!result || typeof result !== 'object' || !('id' in result) || result.id !== id || !('version' in result) || typeof result.version !== 'number' || !('status' in result) || (result.status !== 'ACTIVE' && result.status !== 'DISABLED')) throw unavailable();
        return { id, version: result.version, status: result.status };
      }
      const target = await this.repository.lockAccount(id, context);
      if (!target) throw new IdentityError('NOT_FOUND', 404, 'errors.notFound');
      if (target.version !== expected) throw new IdentityError('VERSION_CONFLICT', 412, 'errors.versionConflict', undefined, target.version);
      if (target.status === change.status) throw new IdentityError('INVALID_TRANSITION', 409, 'errors.invalidTransition');
      const result = await this.repository.changeStatus(id, change.status, this.clock.now(), change.restoreEligibleShares, change.reason, context);
      await this.repository.audit(actor.id, id, change.status === 'DISABLED' ? 'ACCOUNT_DISABLED' : 'ACCOUNT_REENABLED', change.reason, browser.requestId, this.clock.now(), context);
      await this.repository.saveReplay({ actorId: actor.id, operation, key: intent, requestDigest: digest, result, now: this.clock.now() }, context);
      return result;
    });
  }
}
