import { QueryClient } from '@tanstack/react-query';
import { ApiError, identityApi, type Credentials, type Principal, type SessionData } from '../../api/identity';

export interface SafeBootstrap { phase: 'authenticated' | 'unauthenticated' | 'unavailable'; principal?: Principal }
export interface SessionState { phase: SafeBootstrap['phase'] | 'loading'; principal?: Principal; mutationReady: boolean }
export const privateKey = (actorId: string, resource: string) => ['private', actorId, resource] as const;

export class SessionManager {
  private token?: string;
  private epoch = 0;
  private operation = 0;
  private readonly listeners = new Set<() => void>();
  private state: SessionState;
  readonly api: ReturnType<typeof identityApi>;
  constructor(readonly queries: QueryClient, initial: SafeBootstrap, fetcher?: typeof fetch) {
    this.state = { ...initial, mutationReady: false };
    const api = identityApi({ csrf: () => this.token, epoch: () => this.epoch, unauthorized: () => this.transition({ authenticated: false }), fetcher });
    this.api = { ...api, ownAccount: async () => {
      const account = await api.ownAccount();
      if (this.state.principal && this.state.principal.id !== account.id) {
        await this.bootstrap();
        throw new ApiError('STALE_RESPONSE', 0);
      }
      return account;
    } };
  }
  getSnapshot = () => this.state;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  private publish(state: SessionState) { this.state = state; for (const listener of this.listeners) listener(); }
  private async transition(data: SessionData) {
    const epoch = ++this.epoch;
    this.token = undefined;
    // Cancel first; late responses also fail the transport's actor-epoch guard.
    await this.queries.cancelQueries({ predicate: (query) => query.queryKey[0] === 'private' });
    if (epoch !== this.epoch) return;
    this.queries.removeQueries({ predicate: (query) => query.queryKey[0] === 'private' });
    if (data.authenticated && data.principal && data.csrfToken) {
      this.token = data.csrfToken;
      this.queries.setQueryData(privateKey(data.principal.id, 'principal'), data.principal);
      this.publish({ phase: 'authenticated', principal: data.principal, mutationReady: true });
    } else this.publish({ phase: 'unauthenticated', mutationReady: false });
  }
  async bootstrap() {
    const operation = ++this.operation;
    this.publish({ phase: 'loading', mutationReady: false });
    try { const data = await this.api.bootstrap(); if (operation === this.operation) await this.transition(data); }
    catch (error) {
      if (operation !== this.operation || error instanceof ApiError && error.code === 'STALE_RESPONSE') return;
      this.token = undefined;
      if (error instanceof ApiError && error.status === 401) await this.transition({ authenticated: false });
      else this.publish({ phase: 'unavailable', mutationReady: false });
    }
  }
  async authenticate(mode: 'register' | 'login', body: Credentials, key: string) {
    const operation = ++this.operation;
    const data = mode === 'register' ? await this.api.register(body, key) : await this.api.login(body);
    if (operation !== this.operation) throw new ApiError('STALE_RESPONSE', 0);
    await this.transition(data);
  }
  async logout() {
    try { await this.api.logout(); }
    catch (error) {
      if (!(error instanceof ApiError && error.status === 401)) {
        this.token = undefined; this.publish({ phase: 'unavailable', mutationReady: false });
      }
      throw error;
    }
    ++this.operation;
    await this.transition({ authenticated: false });
  }
}
