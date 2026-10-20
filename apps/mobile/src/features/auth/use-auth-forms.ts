import { useMemo, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { ApiErrorCode, isApiError, type Session } from '@careerpilot/api-client';
import { createSchemas, validate, type FieldErrors, type RegisterInput, type SignInInput } from '@careerpilot/validation';
import { usePublicConfig } from '@/core/config/public-config';
import { useApi } from '@/core/services/app-services';
import { useSession } from '@/core/session/session';

export function useSchemas() {
  const { config } = usePublicConfig();
  return useMemo(() => createSchemas(config.validationPolicy), [config.validationPolicy]);
}

function errorKey(error: unknown): string {
  if (isApiError(error, ApiErrorCode.InvalidCredentials)) {
    return 'auth.invalidCredentials';
  }
  if (isApiError(error, ApiErrorCode.EmailTaken)) {
    return 'auth.emailTaken';
  }
  return 'common.errorBody';
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
    formError: mutation.error ? errorKey(mutation.error) : undefined,
  };
}

export function useRegisterForm() {
  const api = useApi();
  const session = useSession();
  const schemas = useSchemas();
  const { config } = usePublicConfig();
  const [values, setValues] = useState<RegisterInput>({ fullName: '', email: '', password: '', confirmPassword: '', consent: false });
  const [errors, setErrors] = useState<FieldErrors>({});
  const mutation = useMutation({
    mutationFn: (input: RegisterInput) =>
      api.auth.register({
        fullName: input.fullName,
        email: input.email,
        password: input.password,
        consent: input.consent,
        consentDocuments: { terms: config.legal.termsVersion, privacy: config.legal.privacyVersion },
      }),
    onSuccess: (result: Session) => session.start(result),
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
    formError: mutation.error ? errorKey(mutation.error) : undefined,
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
