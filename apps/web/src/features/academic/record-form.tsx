'use client';

import { useState } from 'react';
import { academicErrorKey, useT } from '@careerpilot/client-core';
import { Button, Checkbox, SelectField, TextField } from '@careerpilot/ui-web';

export const FieldType = {
  Text: 'text',
  Number: 'number',
  Date: 'date',
  Select: 'select',
  Check: 'check',
  Area: 'area',
} as const;
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
  onDone?: () => void;
}

export function RecordForm({ fields, initial, submitLabel, onSubmit, onDone }: RecordFormProps) {
  const t = useT();
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
      onDone?.();
    } catch (failure) {
      setError(academicErrorKey(failure));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form
      className="grid gap-3 md:grid-cols-2"
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
    >
      {fields.map((field) => {
        const value = values[field.key];
        if (field.type === FieldType.Check) {
          return (
            <div key={field.key} className="md:col-span-2">
              <Checkbox checked={value === true} onChange={(checked) => set(field.key, checked)}>
                {field.label}
              </Checkbox>
            </div>
          );
        }
        if (field.type === FieldType.Select) {
          return (
            <SelectField
              key={field.key}
              label={field.label}
              hint={field.hint}
              value={typeof value === 'string' ? value : ''}
              options={field.options ?? []}
              onValueChange={(next) => set(field.key, next)}
            />
          );
        }
        return (
          <div key={field.key} className={field.type === FieldType.Area ? 'md:col-span-2' : undefined}>
            <TextField
              label={field.label}
              hint={field.hint}
              type={field.type === FieldType.Area ? 'text' : field.type}
              value={typeof value === 'string' ? value : ''}
              onChange={(event) => set(field.key, event.target.value)}
            />
          </div>
        );
      })}
      {error ? (
        <p role="alert" className="text-sm text-danger md:col-span-2">
          {t(error)}
        </p>
      ) : null}
      <div className="md:col-span-2">
        <Button type="submit" loading={busy}>
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}
