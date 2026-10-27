'use client';

import { SessionStatus } from '@careerpilot/client-core';
import { SessionGate } from '@/core/session-gate';
import { ForgotPasswordPage } from '@/features/auth/forgot-password-page';

export default function ForgotPasswordRoute() {
  return (
    <SessionGate require={SessionStatus.SignedOut}>
      <ForgotPasswordPage />
    </SessionGate>
  );
}
