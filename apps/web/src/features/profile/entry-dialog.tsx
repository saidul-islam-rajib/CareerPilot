'use client';

import { useState } from 'react';
import type { ProfileEntry } from '@careerpilot/api-client';
import { profileErrorKey, useAddEntry, useProfileSettings, useT, useUpdateEntry } from '@careerpilot/client-core';
import { ProfileFieldType } from '@careerpilot/domain-ui-logic';
import {
  emptyValues,
  fieldInputKind,
  formValues,
  validateEntry,
  type EntryErrors,
  type EntryValues,
  type FieldDefinition,
  type SectionDefinition,
} from '@careerpilot/dynamic-forms';
import { Checkbox, FormDialog, SelectField, TextAreaField, TextField, cn } from '@careerpilot/ui-web';
import { useProfileFeedback } from './profile-support';

const WIDE_TYPES: ReadonlySet<string> = new Set([ProfileFieldType.Text, ProfileFieldType.Textarea, ProfileFieldType.Url, ProfileFieldType.Select, ProfileFieldType.Boolean]);

export interface EntryDialogProps {
  section: SectionDefinition;
  entry?: ProfileEntry;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function FieldInput({
  section,
  field,
  value,
  error,
  disabled,
  onChange,
}: {
  section: SectionDefinition;
  field: FieldDefinition;
  value: EntryValues[string];
  error?: EntryErrors[string];
  disabled: boolean;
  onChange: (value: string | boolean) => void;
}) {
  const t = useT();
  const { optionsOf, optionLabel } = useProfileSettings();
  const label = t(`profile.fields.${section.key}.${field.key}`);
  const common = { label, error: error?.message, errorParams: error?.params, required: field.required };
  if (field.type === ProfileFieldType.Boolean) {
    return (
      <Checkbox checked={value === true} onChange={onChange}>
        {label}
      </Checkbox>
    );
  }
  if (field.type === ProfileFieldType.Textarea) {
    return <TextAreaField {...common} value={String(value ?? '')} maxLength={field.maxLength} onChange={(e) => onChange(e.target.value)} />;
  }
  if (field.type === ProfileFieldType.Select && field.options) {
    const key = field.options;
    return (
      <SelectField
        {...common}
        value={String(value ?? '')}
        placeholder={t('common.choose')}
        options={optionsOf(key).map((option) => ({ value: option, label: optionLabel(key, option) }))}
        onValueChange={onChange}
      />
    );
  }
  return (
    <TextField
      {...common}
      type={fieldInputKind(field.type)}
      inputMode={field.type === ProfileFieldType.Year ? 'numeric' : undefined}
      value={String(value ?? '')}
      maxLength={field.maxLength}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

export function EntryDialog({ section, entry, open, onOpenChange }: EntryDialogProps) {
  const t = useT();
  const feedback = useProfileFeedback();
  const { validationContext } = useProfileSettings();
  const add = useAddEntry(section.key);
  const update = useUpdateEntry(section.key);
  const [values, setValues] = useState<EntryValues>(() => (entry ? formValues(section, entry.values) : emptyValues(section)));
  const [errors, setErrors] = useState<EntryErrors>({});
  const [serverError, setServerError] = useState<string>();
  const [attempted, setAttempted] = useState(false);
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

  const submit = () => {
    setAttempted(true);
    setServerError(undefined);
    const result = revalidate(values);
    if (!result.ok) {
      return;
    }
    const done = {
      onSuccess: () => {
        onOpenChange(false);
        feedback.saved();
      },
      onError: (error: unknown) => setServerError(t(profileErrorKey(error))),
    };
    if (entry) {
      update.mutate({ id: entry.id, values: result.values }, done);
    } else {
      add.mutate(result.values, done);
    }
  };

  const errorCount = Object.keys(errors).length;
  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={t(`profile.sections.${section.key}.${entry ? 'edit' : 'add'}`)}
      submitLabel={t('common.save')}
      submitting={add.isPending || update.isPending}
      error={serverError ?? (attempted && errorCount > 0 ? t('common.fixErrors', { count: errorCount }) : undefined)}
      onSubmit={submit}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        {section.fields.map((field) => (
          <div key={field.key} className={cn(WIDE_TYPES.has(field.type) && 'sm:col-span-2')}>
            <FieldInput
              section={section}
              field={field}
              value={values[field.key]}
              error={errors[field.key]}
              disabled={ongoing && field.key === section.endField}
              onChange={(value) => change(field.key, value)}
            />
          </div>
        ))}
      </div>
    </FormDialog>
  );
}
