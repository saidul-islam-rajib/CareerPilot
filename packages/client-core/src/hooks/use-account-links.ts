import { useEffect, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import type { Session } from '@careerpilot/api-client';
import { validate, type FieldErrors, type SetPasswordInput } from '@careerpilot/validation';
import { ApiMode } from '../config/client-config';
import { usePublicConfig } from '../config/public-config';
import { queryKeys } from '../query/query-keys';
import { useApi, useServices } from '../services/app-services';
import { useSession } from '../session/session';
import { accountLinkErrorKey, useSchemas } from './use-auth-forms';

const MS_PER_SECOND = 1000;

export function useDemoLinkToken(): string | undefined {
  const { config } = useServices();
  return config.api.mode === ApiMode.InMemory ? config.api.demoLinkToken : undefined;
}

export function useLinkResend(email: string) {
  const api = useApi();
  const { clock } = useServices();
  const { config } = usePublicConfig();
  const cooldownSeconds = config.accountLinks.resendCooldownSeconds;
  const [sentAt, setSentAt] = useState(() => clock.now().getTime());
  const [now, setNow] = useState(sentAt);
  const resendIn = Math.max(0, Math.ceil(cooldownSeconds - (now - sentAt) / MS_PER_SECOND));

  useEffect(() => {
    if (resendIn <= 0) {
      return undefined;
    }
    const timer = setInterval(() => setNow(clock.now().getTime()), MS_PER_SECOND);
    return () => clearInterval(timer);
  }, [clock, resendIn]);

  const mutation = useMutation({
    mutationFn: () => api.auth.requestPasswordReset(email),
    onSuccess: () => {
      const at = clock.now().getTime();
      setSentAt(at);
      setNow(at);
    },
  });

  return {
    ttlMinutes: config.accountLinks.ttlMinutes,
    resendIn,
    resend: () => mutation.mutate(),
    resending: mutation.isPending,
    resent: mutation.isSuccess,
    error: mutation.error ? accountLinkErrorKey(mutation.error) : undefined,
  };
}

export function useAccountLink(token: string) {
  const api = useApi();
  return useQuery({
    queryKey: queryKeys.accountLink(token),
    queryFn: () => api.auth.inspectAccountLink(token),
    enabled: token.length > 0,
    retry: false,
    gcTime: 0,
  });
}

export function useSetPasswordForm(token: string) {
  const api = useApi();
  const session = useSession();
  const schemas = useSchemas();
  const { config } = usePublicConfig();
  const [values, setValues] = useState<SetPasswordInput>({ password: '', confirmPassword: '' });
  const [errors, setErrors] = useState<FieldErrors>({});
  const mutation = useMutation({
    mutationFn: (input: SetPasswordInput) => api.auth.completeAccountLink({ token, password: input.password }),
    onSuccess: (result: Session) => session.start(result),
  });
  const submit = () => {
    const result = validate(schemas.setPassword, values);
    if (!result.ok) {
      setErrors(result.errors);
      return;
    }
    setErrors({});
    mutation.mutate(result.value);
  };
  return {
    values,
    errors,
    policy: config.validationPolicy,
    setField: (field: keyof SetPasswordInput, value: string) => {
      setValues((v) => ({ ...v, [field]: value }));
      setErrors((e) => ({ ...e, [field]: undefined }));
    },
    submit,
    submitting: mutation.isPending,
    formError: mutation.error ? accountLinkErrorKey(mutation.error) : undefined,
    done: mutation.isSuccess,
  };
}
