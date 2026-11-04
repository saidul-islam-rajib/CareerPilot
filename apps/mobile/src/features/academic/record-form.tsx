import { useState } from 'react';
import { View } from 'react-native';
import { academicErrorKey, useT } from '@careerpilot/client-core';
import { useTheme } from '@/core/theme/theme';
import { Button, Checkbox, SelectField, Text, TextField, TextTone } from '@/ui';

export const FieldType = { Text: 'text', Number: 'number', Date: 'date', Select: 'select', Check: 'check' } as const;
export type FieldType = (typeof FieldType)[keyof typeof FieldType];

export interface FieldSpec {
  key: string;
  label: string;
  type: FieldType;
  options?: Array<{ value: string; label: string }>;
  hint?: string;
}

export type FormValues = Record<string, string | boolean>;

export function numberOrUndefined(value: string | boolean | undefined): number | undefined {
  const parsed = typeof value === 'string' && value.trim() !== '' ? Number(value) : Number.NaN;
  return Number.isFinite(parsed) ? parsed : undefined;
}

export function textOf(value: string | boolean | undefined): string {
  return typeof value === 'string' ? value.trim() : '';
}

export function dayOrUndefined(value: string | boolean | undefined): string | undefined {
  return textOf(value) || undefined;
}

export interface RecordFormProps {
  fields: FieldSpec[];
  initial: FormValues;
  submitLabel: string;
  onSubmit: (values: FormValues) => Promise<unknown>;
}

export function RecordForm({ fields, initial, submitLabel, onSubmit }: RecordFormProps) {
  const t = useT();
  const theme = useTheme();
  const [values, setValues] = useState<FormValues>(initial);
  const [error, setError] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);
  const set = (key: string, value: string | boolean) => setValues((current) => ({ ...current, [key]: value }));

  const submit = async () => {
    setBusy(true);
    setError(undefined);
    try {
      await onSubmit(values);
      setValues(initial);
    } catch (failure) {
      setError(academicErrorKey(failure));
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={{ gap: theme.space.md }}>
      {fields.map((field) => {
        const value = values[field.key];
        if (field.type === FieldType.Check) {
          return (
            <Checkbox key={field.key} checked={value === true} onChange={(checked) => set(field.key, checked)} accessibilityLabel={field.label}>
              <Text>{field.label}</Text>
            </Checkbox>
          );
        }
        if (field.type === FieldType.Select) {
          return (
            <SelectField
              key={field.key}
              label={field.label}
              value={typeof value === 'string' ? value : ''}
              options={field.options ?? []}
              placeholder="-"
              onChange={(next) => set(field.key, next)}
            />
          );
        }
        return (
          <TextField
            key={field.key}
            label={field.label}
            hint={field.hint}
            keyboardType={field.type === FieldType.Number ? 'numeric' : 'default'}
            autoCapitalize="none"
            value={typeof value === 'string' ? value : ''}
            onChangeText={(next) => set(field.key, next)}
          />
        );
      })}
      {error ? <Text tone={TextTone.Danger}>{t(error)}</Text> : null}
      <Button label={submitLabel} loading={busy} onPress={() => void submit()} />
    </View>
  );
}
