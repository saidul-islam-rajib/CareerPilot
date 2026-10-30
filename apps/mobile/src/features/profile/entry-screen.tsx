import { useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { View, type KeyboardTypeOptions } from 'react-native';
import type { ProfileEntry } from '@careerpilot/api-client';
import { profileErrorKey, useAddEntry, useProfileSettings, useRemoveEntry, useRestoreEntry, useServices, useT, useUpdateEntry } from '@careerpilot/client-core';
import { ProfileFieldType } from '@careerpilot/domain-ui-logic';
import { describeEntry, emptyValues, formValues, validateEntry, type EntryErrors, type EntryValues, type FieldDefinition, type SectionDefinition } from '@careerpilot/dynamic-forms';
import { useTheme } from '@/core/theme/theme';
import { Button, ButtonVariant, Checkbox, ErrorState, Screen, Segmented, SelectField, Text, TextField, TextTone, TextVariant } from '@/ui';
import { ServerError, useLoadedProfile } from './profile-edit-screens';
import { useProfileFeedback, useRemoveWithUndo } from './profile-support';

const KEYBOARDS: Partial<Record<ProfileFieldType, KeyboardTypeOptions>> = {
  [ProfileFieldType.Email]: 'email-address',
  [ProfileFieldType.Phone]: 'phone-pad',
  [ProfileFieldType.Url]: 'url',
  [ProfileFieldType.Year]: 'number-pad',
  [ProfileFieldType.Number]: 'decimal-pad',
  [ProfileFieldType.Month]: 'numbers-and-punctuation',
  [ProfileFieldType.Date]: 'numbers-and-punctuation',
};
const HINTS: Partial<Record<ProfileFieldType, string>> = {
  [ProfileFieldType.Month]: 'profile.monthHint',
  [ProfileFieldType.Date]: 'profile.dateHint',
};
const NO_CAPITALIZE: ReadonlySet<string> = new Set([ProfileFieldType.Email, ProfileFieldType.Url]);
const TEXTAREA_LINES = 5;

function Field({ section, field, value, error, disabled, onChange }: { section: SectionDefinition; field: FieldDefinition; value: EntryValues[string]; error?: EntryErrors[string]; disabled: boolean; onChange: (value: string | boolean) => void }) {
  const t = useT();
  const theme = useTheme();
  const { optionsOf, optionLabel } = useProfileSettings();
  const { config } = useServices();
  const label = t(`profile.fields.${section.key}.${field.key}`);
  if (field.type === ProfileFieldType.Boolean) {
    return (
      <Checkbox checked={value === true} onChange={onChange} accessibilityLabel={label}>
        {label}
      </Checkbox>
    );
  }
  if (field.type === ProfileFieldType.Select && field.options) {
    const key = field.options;
    const options = optionsOf(key).map((option) => ({ value: option, label: optionLabel(key, option) }));
    if (options.length > config.ui.segmentedMaxOptions) {
      return (
        <SelectField
          label={label}
          value={String(value ?? '')}
          options={options}
          placeholder={t('common.choose')}
          onChange={onChange}
          error={error?.message}
          errorParams={error?.params}
          testID={`field-${field.key}`}
        />
      );
    }
    return (
      <View style={{ gap: theme.space.xs }}>
        <Text variant={TextVariant.Label}>{label}</Text>
        <Segmented accessibilityLabel={label} value={String(value ?? '')} onChange={onChange} options={optionsOf(key).map((option) => ({ value: option, label: optionLabel(key, option) }))} />
        {error ? (
          <Text variant={TextVariant.Caption} tone={TextTone.Danger}>
            {t(error.message, error.params)}
          </Text>
        ) : null}
      </View>
    );
  }
  const multiline = field.type === ProfileFieldType.Textarea;
  return (
    <TextField
      label={label}
      value={String(value ?? '')}
      error={error?.message}
      errorParams={error?.params}
      hint={HINTS[field.type] ? t(HINTS[field.type] ?? '') : undefined}
      keyboardType={KEYBOARDS[field.type]}
      autoCapitalize={NO_CAPITALIZE.has(field.type) ? 'none' : undefined}
      maxLength={field.maxLength}
      multiline={multiline}
      numberOfLines={multiline ? TEXTAREA_LINES : undefined}
      textAlignVertical={multiline ? 'top' : undefined}
      editable={!disabled}
      onChangeText={onChange}
    />
  );
}

function EntryForm({ section, entry }: { section: SectionDefinition; entry?: ProfileEntry }) {
  const t = useT();
  const theme = useTheme();
  const router = useRouter();
  const feedback = useProfileFeedback();
  const removeWithUndo = useRemoveWithUndo();
  const { validationContext, optionLabel } = useProfileSettings();
  const add = useAddEntry(section.key);
  const update = useUpdateEntry(section.key);
  const remove = useRemoveEntry(section.key);
  const restore = useRestoreEntry(section.key);
  const [values, setValues] = useState<EntryValues>(() => (entry ? formValues(section, entry.values) : emptyValues(section)));
  const [errors, setErrors] = useState<EntryErrors>({});
  const [attempted, setAttempted] = useState(false);
  const [serverError, setServerError] = useState<string>();
  const ongoing = section.ongoingField ? values[section.ongoingField] === true : false;

  const revalidate = (next: EntryValues) => {
    const result = validateEntry(section, next, validationContext());
    setErrors(result.ok ? {} : result.errors);
    return result;
  };
  const change = (key: string, value: string | boolean) => {
    const next = { ...values, [key]: value };
    setValues(next);
    if (attempted) {
      revalidate(next);
    }
  };
  const save = () => {
    setAttempted(true);
    setServerError(undefined);
    const result = revalidate(values);
    if (!result.ok) {
      return;
    }
    const done = {
      onSuccess: () => {
        feedback.saved();
        router.back();
      },
      onError: (failure: unknown) => setServerError(profileErrorKey(failure)),
    };
    if (entry) {
      update.mutate({ id: entry.id, values: result.values }, done);
    } else {
      add.mutate(result.values, done);
    }
  };
  const removeEntry = () => {
    if (!entry) {
      return;
    }
    const title = describeEntry(section, entry.values, optionLabel).title;
    removeWithUndo(() => remove.mutateAsync(entry.id), () => restore.mutateAsync(entry.id), title, () => router.back());
  };
  const errorCount = Object.keys(errors).length;

  return (
    <Screen footer={<Button label={t('common.save')} onPress={save} loading={add.isPending || update.isPending} fullWidth />} testID="edit-entry-screen">
      <Text variant={TextVariant.Title}>{t(`profile.sections.${section.key}.${entry ? 'edit' : 'add'}`)}</Text>
      <ServerError message={serverError} />
      {attempted && errorCount > 0 ? (
        <Text tone={TextTone.Danger} accessibilityLiveRegion="polite">
          {t('common.fixErrors', { count: errorCount })}
        </Text>
      ) : null}
      {section.fields.map((field) => (
        <Field
          key={field.key}
          section={section}
          field={field}
          value={values[field.key]}
          error={errors[field.key]}
          disabled={ongoing && field.key === section.endField}
          onChange={(value) => change(field.key, value)}
        />
      ))}
      {entry ? (
        <View style={{ paddingTop: theme.space.sm }}>
          <Button label={t('common.remove')} variant={ButtonVariant.Destructive} onPress={removeEntry} loading={remove.isPending} />
        </View>
      ) : null}
    </Screen>
  );
}

export function EntryScreen() {
  const { section: sectionKey, id } = useLocalSearchParams<{ section: string; id?: string }>();
  const { section: sectionOf } = useProfileSettings();
  const section = sectionOf(sectionKey ?? '');
  return useLoadedProfile((profile) => {
    const entry = id ? profile.sections[sectionKey ?? '']?.find((e) => e.id === id) : undefined;
    return !section || (id && !entry) ? <ErrorState /> : <EntryForm section={section} entry={entry} />;
  });
}
