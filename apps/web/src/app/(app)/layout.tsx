'use client';

import type { PropsWithChildren } from 'react';
import { SessionStatus } from '@careerpilot/client-core';
import { SessionGate } from '@/core/session-gate';
import { AppShell } from '@/features/shell/app-shell';

export default function SignedInLayout({ children }: PropsWithChildren) {
  return (
    <SessionGate require={SessionStatus.SignedIn}>
      <AppShell>{children}</AppShell>
    </SessionGate>
  );
}
