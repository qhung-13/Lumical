'use client';
import { createContext, useContext, useEffect, useState, useSyncExternalStore, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SessionManager, type SafeBootstrap } from './session-manager';
const Context = createContext<SessionManager | null>(null);
export function IdentityProvider({ initial, children }: { initial: SafeBootstrap; children: ReactNode }) {
  const [queries] = useState(() => new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 60000 } } }));
  const [manager] = useState(() => new SessionManager(queries, initial));
  useEffect(() => {
    const refresh = () => { void manager.bootstrap(); };
    refresh(); window.addEventListener('focus', refresh);
    return () => window.removeEventListener('focus', refresh);
  }, [manager]);
  return <QueryClientProvider client={queries}><Context.Provider value={manager}>{children}</Context.Provider></QueryClientProvider>;
}
export function useIdentity() {
  const manager = useContext(Context);
  if (!manager) throw new Error('Identity provider required.');
  const state = useSyncExternalStore(manager.subscribe, manager.getSnapshot, manager.getSnapshot);
  return { manager, state };
}
