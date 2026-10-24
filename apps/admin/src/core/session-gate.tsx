'use client';

import { useEffect, type PropsWithChildren } from 'react';
import { useRouter } from 'next/navigation';
import { SessionStatus } from '@careerpilot/client-core';
import { LoadingState } from '@careerpilot/ui-web';
import { useAdminSession } from './admin-session';
import { AdminRoutes } from './routes';

export function SessionGate({ require, children }: PropsWithChildren<{ require: typeof SessionStatus.SignedIn | typeof SessionStatus.SignedOut }>) {
  const { status } = useAdminSession();
  const router = useRouter();
  const allowed = status === require;

  useEffect(() => {
    if (status !== SessionStatus.Restoring && !allowed) {
      router.replace(require === SessionStatus.SignedIn ? AdminRoutes.signIn : AdminRoutes.dashboard);
    }
  }, [allowed, require, router, status]);

  return allowed ? <>{children}</> : <LoadingState />;
}
