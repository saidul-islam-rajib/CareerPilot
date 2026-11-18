import { useEffect, useState } from 'react';
import { ApiErrorCode, isApiError, type Contact, type NotificationPreferences } from '@careerpilot/api-client';
import { ContactKind } from '@careerpilot/domain-ui-logic';
import { validate, type ChangePasswordInput, type FieldErrors, type NotificationsInput } from '@careerpilot/validation';
import { usePublicConfig } from '../config/public-config';
import { useSession } from '../session/session';
import { authErrorKey, useSchemas } from './use-auth-forms';
import { useProfile } from './use-profile';
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

export function digestRecipient(contacts: Contact[] | undefined, accountEmail: string | undefined): string | undefined {
  const emails = (contacts ?? []).filter((c) => c.kind === ContactKind.Email);
  return emails.find((c) => c.isPrimary)?.value ?? emails[0]?.value ?? accountEmail;
}

const NOTIFICATION_DEFAULTS: NotificationsInput = {
  digestEnabled: true,
  digestTime: '',
  quietHoursEnabled: false,
  quietStart: '',
  quietEnd: '',
  urgentOverridesQuiet: false,
};

function valuesOf(saved: NotificationPreferences): NotificationsInput {
  return {
    digestEnabled: saved.digestEnabled,
    digestTime: saved.digestTime ?? '',
    quietHoursEnabled: saved.quietHoursEnabled,
    quietStart: saved.quietStart ?? '',
    quietEnd: saved.quietEnd ?? '',
    urgentOverridesQuiet: saved.urgentOverridesQuiet,
  };
}

export function useNotificationsForm({ onSaved }: { onSaved?: () => void } = {}) {
  const schemas = useSchemas();
  const settings = useSettings();
  const profile = useProfile();
  const session = useSession();
  const { config } = usePublicConfig();
  const mutation = useUpdateNotifications();
  const saved = settings.data?.notifications;
  const [values, setValues] = useState<NotificationsInput>({ ...NOTIFICATION_DEFAULTS });
  const [errors, setErrors] = useState<FieldErrors>({});

  useEffect(() => {
    if (saved) {
      setValues(valuesOf(saved));
    }
  }, [saved]);

  const submit = () => {
    const result = validate(schemas.notifications, values);
    if (!result.ok) {
      setErrors(result.errors);
      return;
    }
    setErrors({});
    mutation.mutate(result.value, { onSuccess: () => onSaved?.() });
  };
  const setDigestTime = (digestTime: string) => {
    setValues((v) => ({ ...v, digestTime }));
    setErrors({});
  };
  return {
    settings,
    values,
    errors,
    dirty: saved !== undefined && JSON.stringify(values) !== JSON.stringify(valuesOf(saved)),
    presets: config.notifications.digestTimePresets,
    timeZone: settings.data?.timeZone ?? config.defaultTimeZone,
    recipient: digestRecipient(profile.data?.contacts, session.user?.email),
    setDigestEnabled: (digestEnabled: boolean) => setValues((v) => ({ ...v, digestEnabled })),
    setDigestTime,
    setQuietHoursEnabled: (quietHoursEnabled: boolean) => setValues((v) => ({ ...v, quietHoursEnabled })),
    setQuietStart: (quietStart: string) => setValues((v) => ({ ...v, quietStart })),
    setQuietEnd: (quietEnd: string) => setValues((v) => ({ ...v, quietEnd })),
    setUrgentOverridesQuiet: (urgentOverridesQuiet: boolean) => setValues((v) => ({ ...v, urgentOverridesQuiet })),
    submit,
    saving: mutation.isPending,
    saved: mutation.isSuccess,
    formError: mutation.error ? authErrorKey(mutation.error) : undefined,
  };
}
