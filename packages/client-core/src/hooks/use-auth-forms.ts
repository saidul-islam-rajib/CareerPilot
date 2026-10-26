import { useMemo, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { ApiError, ApiErrorCode, ApiErrorDetail, isApiError, type Session } from '@careerpilot/api-client';
import { createSchemas, validate, type FieldErrors, type RegisterInput, type SignInInput } from '@careerpilot/validation';
import { usePublicConfig } from '../config/public-config';
import { useApi } from '../services/app-services';
import { useSession } from '../session/session';

export function useSchemas() {
  const { config } = usePublicConfig();
  return useMemo(() => createSchemas(config.validationPolicy), [config.validationPolicy]);
}

const AUTH_ERROR_KEYS: ReadonlyArray<[ApiErrorCode, string]> = [
  [ApiErrorCode.InvalidCredentials, 'auth.invalidCredentials'],
  [ApiErrorCode.EmailTaken, 'auth.emailTaken'],
  [ApiErrorCode.TooManyAttempts, 'auth.tooManyAttempts'],
  [ApiErrorCode.ServiceUnavailable, 'auth.serviceUnavailable'],
];
const FALLBACK_ERROR_KEY = 'common.errorBody';

export function authErrorKey(error: unknown): string {
  return AUTH_ERROR_KEYS.find(([code]) => isApiError(error, code))?.[1] ?? FALLBACK_ERROR_KEY;
}

const LINK_ERROR_KEYS: Readonly<Record<string, string>> = {
  [ApiErrorDetail.LinkInvalid]: 'accountLinks.linkInvalid',
  [ApiErrorDetail.LinkExpired]: 'accountLinks.linkExpired',
  [ApiErrorDetail.DeliveryFailed]: 'accountLinks.deliveryFailed',
};

export function accountLinkErrorKey(error: unknown): string {
  const detail = error instanceof ApiError ? error.detail : undefined;
  return (detail ? LINK_ERROR_KEYS[detail] : undefined) ?? authErrorKey(error);
}

export function useSignInForm() {
  const api = useApi();
  const session = useSession();
  const schemas = useSchemas();
  const [values, setValues] = useState<SignInInput>({ email: '', password: '' });
  const [errors, setErrors] = useState<FieldErrors>({});
  const mutation = useMutation({
    mutationFn: (input: SignInInput) => api.auth.signIn(input),
    onSuccess: (result: Session) => session.start(result),
  });
  const submit = () => {
    const result = validate(schemas.signIn, values);
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
    setField: (field: keyof SignInInput, value: string) => setValues((v) => ({ ...v, [field]: value })),
    submit,
    submitting: mutation.isPending,
    formError: mutation.error ? authErrorKey(mutation.error) : undefined,
  };
}

export function useRegisterForm() {
  const api = useApi();
  const schemas = useSchemas();
  const { config } = usePublicConfig();
  const [values, setValues] = useState<RegisterInput>({ fullName: '', email: '', consent: false });
  const [errors, setErrors] = useState<FieldErrors>({});
  const [sentTo, setSentTo] = useState<string>();
  const mutation = useMutation({
    mutationFn: (input: RegisterInput) =>
      api.auth.register({
        fullName: input.fullName,
        email: input.email,
        consent: input.consent,
        consentDocuments: { terms: config.legal.termsVersion, privacy: config.legal.privacyVersion },
      }),
    onSuccess: (_result, input) => setSentTo(input.email),
  });
  const submit = () => {
    const result = validate(schemas.register, values);
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
    setField: <K extends keyof RegisterInput>(field: K, value: RegisterInput[K]) => setValues((v) => ({ ...v, [field]: value })),
    submit,
    submitting: mutation.isPending,
    formError: mutation.error ? accountLinkErrorKey(mutation.error) : undefined,
    sentTo,
    startOver: () => {
      setSentTo(undefined);
      mutation.reset();
    },
  };
}

export function usePasswordReset() {
  const api = useApi();
  const schemas = useSchemas();
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string>();
  const mutation = useMutation({ mutationFn: (value: string) => api.auth.requestPasswordReset(value) });
  const submit = () => {
    const result = validate(schemas.forgotPassword, { email });
    if (!result.ok) {
      setError(result.errors.email);
      return;
    }
    setError(undefined);
    mutation.mutate(result.value.email);
  };
  return { email, setEmail, error, submit, submitting: mutation.isPending, sent: mutation.isSuccess };
}
