import { useEffect, useState } from 'react';
import { ApiErrorCode, isApiError } from '@careerpilot/api-client';
import { validate, type ChangePasswordInput, type FieldErrors, type NotificationsInput } from '@careerpilot/validation';
import { authErrorKey, useSchemas } from './use-auth-forms';
import { useChangePassword, useSettings, useUpdateNotifications } from './use-settings';

const EMPTY_PASSWORDS: ChangePasswordInput = { currentPassword: '', newPassword: '', confirmPassword: '' };
const WRONG_PASSWORD_KEY = 'settings.wrongPassword';

export function useChangePasswordForm() {
  const schemas = useSchemas();
  const mutation = useChangePassword();
  const [values, setValues] = useState<ChangePasswordInput>(EMPTY_PASSWORDS);
  const [errors, setErrors] = useState<FieldErrors>({});
  const wrongPassword = isApiError(mutation.error, ApiErrorCode.InvalidCredentials);
  const submit = () => {
    const result = validate(schemas.changePassword, values);
    if (!result.ok) {
      setErrors(result.errors);
      return;
    }
    setErrors({});
    mutation.mutate({ currentPassword: result.value.currentPassword, newPassword: result.value.newPassword }, { onSuccess: () => setValues(EMPTY_PASSWORDS) });
  };
  return {
    values,
    errors: wrongPassword ? { ...errors, currentPassword: WRONG_PASSWORD_KEY } : errors,
    setField: (field: keyof ChangePasswordInput, value: string) => {
      setValues((v) => ({ ...v, [field]: value }));
      mutation.reset();
    },
    submit,
    submitting: mutation.isPending,
    changed: mutation.isSuccess,
    formError: mutation.error && !wrongPassword ? authErrorKey(mutation.error) : undefined,
  };
}

export function useNotificationsForm() {
  const schemas = useSchemas();
  const settings = useSettings();
  const mutation = useUpdateNotifications();
  const saved = settings.data?.notifications;
  const [values, setValues] = useState<NotificationsInput>({ digestEnabled: true, digestTime: '' });
  const [errors, setErrors] = useState<FieldErrors>({});

  useEffect(() => {
    if (saved) {
      setValues({ digestEnabled: saved.digestEnabled, digestTime: saved.digestTime ?? '' });
    }
  }, [saved]);

  const submit = () => {
    const result = validate(schemas.notifications, values);
    if (!result.ok) {
      setErrors(result.errors);
      return;
    }
    setErrors({});
    mutation.mutate(result.value);
  };
  return {
    settings,
    values,
    errors,
    setDigestEnabled: (digestEnabled: boolean) => setValues((v) => ({ ...v, digestEnabled })),
    setDigestTime: (digestTime: string) => setValues((v) => ({ ...v, digestTime })),
    submit,
    saving: mutation.isPending,
    saved: mutation.isSuccess,
    formError: mutation.error ? authErrorKey(mutation.error) : undefined,
  };
}
