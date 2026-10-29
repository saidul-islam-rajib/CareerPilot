'use client';

import type { PropsWithChildren } from 'react';
import { usePathname } from 'next/navigation';
import { SessionStatus } from '@careerpilot/client-core';
import { Routes } from '@/core/routes';
import { SessionGate } from '@/core/session-gate';

export default function AuthLayout({ children }: PropsWithChildren) {
  const fullWidth = usePathname() === Routes.welcome;
  return (
    <SessionGate require={SessionStatus.SignedOut}>
      {fullWidth ? children : <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col gap-6 px-4 py-10">{children}</main>}
    </SessionGate>
  );
}
