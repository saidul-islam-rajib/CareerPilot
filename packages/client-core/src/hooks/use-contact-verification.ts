import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ApiError, type Profile, type VerificationChallenge } from '@careerpilot/api-client';
import { validate, verificationCodeSchema } from '@careerpilot/validation';
import { usePublicConfig } from '../config/public-config';
import { queryKeys } from '../query/query-keys';
import { useApi, useServices } from '../services/app-services';
import { authErrorKey } from './use-auth-forms';

const MS_PER_SECOND = 1000;
const SECONDS_PER_MINUTE = 60;

const VERIFICATION_ERROR_KEYS: Readonly<Record<string, string>> = {
  code_invalid: 'verification.codeInvalid',
  code_expired: 'verification.codeExpired',
  attempts: 'verification.tooManyAttempts',
  resend_cooldown: 'verification.resendCooldown',
  send_limit: 'verification.sendLimit',
  delivery_failed: 'verification.deliveryFailed',
  sms_unavailable: 'verification.smsUnavailable',
  already_verified: 'verification.alreadyVerified',
};

export function verificationErrorKey(error: unknown): string {
  const detail = error instanceof ApiError ? error.detail : undefined;
  return (detail ? VERIFICATION_ERROR_KEYS[detail] : undefined) ?? authErrorKey(error);
}

export function useContactVerification(contactId: string, { onVerified }: { onVerified?: (profile: Profile) => void } = {}) {
  const api = useApi();
  const client = useQueryClient();
  const { clock } = useServices();
  const { config } = usePublicConfig();
  const settings = config.verification;
  const [challenge, setChallenge] = useState<VerificationChallenge>();
  const [sentAt, setSentAt] = useState<number>();
  const [now, setNow] = useState(() => clock.now().getTime());
  const [code, setCode] = useState('');
  const [error, setError] = useState<string>();

  const resendIn = challenge && sentAt !== undefined ? Math.max(0, Math.ceil(challenge.resendAfterSeconds - (now - sentAt) / MS_PER_SECOND)) : 0;

  useEffect(() => {
    if (resendIn <= 0) {
      return undefined;
    }
    const timer = setInterval(() => setNow(clock.now().getTime()), MS_PER_SECOND);
    return () => clearInterval(timer);
  }, [clock, resendIn]);

  const send = useMutation({
    mutationFn: () => api.profile.sendContactCode(contactId),
    onSuccess: (result) => {
      const at = clock.now().getTime();
      setChallenge(result);
      setSentAt(at);
      setNow(at);
      setCode('');
      setError(undefined);
    },
    onError: (failure) => setError(verificationErrorKey(failure)),
  });

  const confirm = useMutation({
    mutationFn: (value: string) => api.profile.confirmContactCode(contactId, value),
    onSuccess: (profile) => {
      client.setQueryData(queryKeys.profile, profile);
      onVerified?.(profile);
    },
    onError: (failure) => setError(verificationErrorKey(failure)),
  });

  const submit = () => {
    const result = validate(verificationCodeSchema(settings.codeLength), { code });
    if (!result.ok) {
      setError(result.errors.code);
      return;
    }
    setError(undefined);
    confirm.mutate(result.value.code);
  };

  return {
    challenge,
    code,
    setCode: (value: string) => {
      setCode(value);
      setError(undefined);
    },
    error,
    codeLength: settings.codeLength,
    expiresInMinutes: Math.round(settings.codeTtlSeconds / SECONDS_PER_MINUTE),
    resendIn,
    send: () => send.mutate(),
    sending: send.isPending,
    submit,
    confirming: confirm.isPending,
    verified: confirm.isSuccess,
  };
}
