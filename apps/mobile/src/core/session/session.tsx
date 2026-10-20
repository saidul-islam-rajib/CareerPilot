import { createContext, useCallback, useContext, useEffect, useMemo, useState, type PropsWithChildren } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { Session, UserSummary } from '@careerpilot/api-client';
import { useServices } from '../services/app-services';

export const SessionStatus = {
  Restoring: 'restoring',
  SignedOut: 'signed_out',
  SignedIn: 'signed_in',
} as const;
export type SessionStatus = (typeof SessionStatus)[keyof typeof SessionStatus];

const SESSION_KEY = 'careerpilot.session';

interface SessionValue {
  status: SessionStatus;
  user?: UserSummary;
  start(session: Session): Promise<void>;
  end(): Promise<void>;
}

const SessionContext = createContext<SessionValue | undefined>(undefined);

export function SessionProvider({ children }: PropsWithChildren) {
  const { store, tokens, api } = useServices();
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<SessionStatus>(SessionStatus.Restoring);
  const [user, setUser] = useState<UserSummary>();

  const clear = useCallback(async () => {
    tokens.token = undefined;
    setUser(undefined);
    setStatus(SessionStatus.SignedOut);
    queryClient.clear();
    await store.remove(SESSION_KEY);
  }, [queryClient, store, tokens]);

  useEffect(() => {
    tokens.onUnauthorized = () => void clear();
    let active = true;
    store
      .get(SESSION_KEY)
      .then((raw) => {
        if (!active) {
          return;
        }
        const saved = raw ? (JSON.parse(raw) as Session) : undefined;
        tokens.token = saved?.accessToken;
        setUser(saved?.user);
        setStatus(saved ? SessionStatus.SignedIn : SessionStatus.SignedOut);
      })
      .catch(() => active && setStatus(SessionStatus.SignedOut));
    return () => {
      active = false;
    };
  }, [clear, store, tokens]);

  const start = useCallback(
    async (session: Session) => {
      tokens.token = session.accessToken;
      await store.set(SESSION_KEY, JSON.stringify(session));
      setUser(session.user);
      setStatus(SessionStatus.SignedIn);
    },
    [store, tokens],
  );

  const end = useCallback(async () => {
    await api.auth.signOut().catch(() => undefined);
    await clear();
  }, [api, clear]);

  const value = useMemo(() => ({ status, user, start, end }), [status, user, start, end]);
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionValue {
  const value = useContext(SessionContext);
  if (!value) {
    throw new Error('SessionProvider is missing');
  }
  return value;
}
