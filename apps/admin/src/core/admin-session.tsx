'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type PropsWithChildren } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { can, type AdminPermission, type AdminSession, type AdminSummary } from '@careerpilot/api-client';
import { SessionStatus } from '@careerpilot/client-core';
import type { AdminArea, PermissionAction } from '@careerpilot/domain-ui-logic';
import { useAdminServices } from './admin-services';

const SESSION_KEY = 'careerpilot.admin.session';
const MS_PER_MINUTE = 60_000;
const ACTIVITY_EVENTS = ['pointerdown', 'keydown'] as const;

interface AdminSessionValue {
  status: SessionStatus;
  admin?: AdminSummary;
  permissions: AdminPermission[];
  start(session: AdminSession): Promise<void>;
  end(): Promise<void>;
}

const AdminSessionContext = createContext<AdminSessionValue | undefined>(undefined);

export function AdminSessionProvider({ children }: PropsWithChildren) {
  const { store, tokens, api, config } = useAdminServices();
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<SessionStatus>(SessionStatus.Restoring);
  const [session, setSession] = useState<AdminSession>();

  const clear = useCallback(async () => {
    tokens.token = undefined;
    setSession(undefined);
    setStatus(SessionStatus.SignedOut);
    queryClient.removeQueries({ predicate: (q) => q.queryKey[0] === 'admin' });
    await store.remove(SESSION_KEY);
  }, [queryClient, store, tokens]);

  useEffect(() => {
    tokens.onUnauthorized = () => void clear();
    let active = true;
    void store.get(SESSION_KEY).then((raw) => {
      if (!active) {
        return;
      }
      const saved = raw ? (JSON.parse(raw) as AdminSession) : undefined;
      tokens.token = saved?.accessToken;
      setSession(saved);
      setStatus(saved ? SessionStatus.SignedIn : SessionStatus.SignedOut);
    });
    return () => {
      active = false;
    };
  }, [clear, store, tokens]);

  useEffect(() => {
    if (status !== SessionStatus.SignedIn) {
      return undefined;
    }
    const timeoutMs = config.admin.sessionTimeoutMinutes * MS_PER_MINUTE;
    let timer = setTimeout(() => void clear(), timeoutMs);
    const reset = () => {
      clearTimeout(timer);
      timer = setTimeout(() => void clear(), timeoutMs);
    };
    ACTIVITY_EVENTS.forEach((event) => window.addEventListener(event, reset));
    return () => {
      clearTimeout(timer);
      ACTIVITY_EVENTS.forEach((event) => window.removeEventListener(event, reset));
    };
  }, [clear, config.admin.sessionTimeoutMinutes, status]);

  const start = useCallback(
    async (next: AdminSession) => {
      tokens.token = next.accessToken;
      await store.set(SESSION_KEY, JSON.stringify(next));
      setSession(next);
      setStatus(SessionStatus.SignedIn);
    },
    [store, tokens],
  );

  const end = useCallback(async () => {
    await api.auth.signOut().catch(() => undefined);
    await clear();
  }, [api, clear]);

  const value = useMemo(() => ({ status, admin: session?.admin, permissions: session?.permissions ?? [], start, end }), [end, session, start, status]);
  return <AdminSessionContext.Provider value={value}>{children}</AdminSessionContext.Provider>;
}

export function useAdminSession(): AdminSessionValue {
  const value = useContext(AdminSessionContext);
  if (!value) {
    throw new Error('AdminSessionProvider is missing');
  }
  return value;
}

export function useCan(area: AdminArea, action: PermissionAction): boolean {
  return can(useAdminSession().permissions, area, action);
}
