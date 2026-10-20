'use client';

import type { PropsWithChildren } from 'react';
import { SessionStatus } from '@careerpilot/client-core';
import { SessionGate } from '@/core/session-gate';

export default function AuthLayout({ children }: PropsWithChildren) {
  return (
    <SessionGate require={SessionStatus.SignedOut}>
      <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col gap-6 px-4 py-10">{children}</main>
    </SessionGate>
  );
}
