'use client';

import { SessionStatus } from '@careerpilot/client-core';
import { SessionGate } from '@/core/session-gate';
import { SignInPage } from '@/features/auth/sign-in-page';

export default function SignInRoute() {
  return (
    <SessionGate require={SessionStatus.SignedOut}>
      <SignInPage />
    </SessionGate>
  );
}
