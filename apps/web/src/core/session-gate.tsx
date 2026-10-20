'use client';

import { useEffect, type PropsWithChildren } from 'react';
import { useRouter } from 'next/navigation';
import { SessionStatus, useSession } from '@careerpilot/client-core';
import { LoadingState } from '@careerpilot/ui-web';
import { Routes } from './routes';

export function SessionGate({ require, children }: PropsWithChildren<{ require: typeof SessionStatus.SignedIn | typeof SessionStatus.SignedOut }>) {
  const { status } = useSession();
  const router = useRouter();
  const allowed = status === require;

  useEffect(() => {
    if (status !== SessionStatus.Restoring && !allowed) {
      router.replace(require === SessionStatus.SignedIn ? Routes.welcome : Routes.home);
    }
  }, [allowed, require, router, status]);

  return allowed ? <>{children}</> : <LoadingState />;
}
