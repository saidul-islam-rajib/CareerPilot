'use client';

import type { PropsWithChildren } from 'react';
import { SessionStatus } from '@careerpilot/client-core';
import { SessionGate } from '@/core/session-gate';
import { AdminShell } from '@/features/shell/admin-shell';

export default function AdminLayout({ children }: PropsWithChildren) {
  return (
    <SessionGate require={SessionStatus.SignedIn}>
      <AdminShell>{children}</AdminShell>
    </SessionGate>
  );
}
