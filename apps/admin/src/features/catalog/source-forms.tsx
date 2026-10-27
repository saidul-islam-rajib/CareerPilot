'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { SourceConnector, isApiError, type NewSource, type SourceDefaults } from '@careerpilot/api-client';
import { useT } from '@careerpilot/client-core';
import { OpportunityType, WorkArrangement, enumValues } from '@careerpilot/domain-ui-logic';
import { Button, Card, FormDialog, SelectField, TextField, useToast } from '@careerpilot/ui-web';
import { adminKeys, useAdminMutation } from '@/core/admin-queries';
import { useAdminApi } from '@/core/admin-services';

const SOURCE_ERROR_KEYS: Readonly<Record<string, string>> = {
  source_url: 'admin.sources.errors.url',
  source_connector: 'admin.sources.errors.connector',
  source_exists: 'admin.sources.errors.exists',
  country_code: 'admin.sources.errors.countryCode',
};
const ADD_FAILED = 'admin.sources.addFailed';
const REQUIRED = 'validation.required';

const EMPTY_SOURCE: NewSource = {
  name: '',
  connector: SourceConnector.Rss,
  url: '',
  defaults: { type: OpportunityType.Job, workArrangement: WorkArrangement.Remote, countryCode: '', location: '', organization: '' },
};

export function sourceErrorKey(error: unknown): string {
  return (isApiError(error) && SOURCE_ERROR_KEYS[error.detail ?? '']) || ADD_FAILED;
}

function useAddSource(onAdded: () => void) {
  const api = useAdminApi();
  const toast = useToast();
  const t = useT();
  return useAdminMutation(async (source: NewSource) => {
    const row = await api.sources.addSource(source);
    toast.show({ message: t('admin.sources.added') });
    onAdded();
    return row;
  });
}

export function AddSourceDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const t = useT();
  const [values, setValues] = useState<NewSource>(EMPTY_SOURCE);
  const [errors, setErrors] = useState<{ name?: string; url?: string }>({});
  const add = useAddSource(() => {
    onOpenChange(false);
    setValues(EMPTY_SOURCE);
  });
  const setDefault = (field: keyof SourceDefaults, value: string) => setValues((v) => ({ ...v, defaults: { ...v.defaults, [field]: value } }));
  const submit = () => {
    const missing = { name: values.name.trim() ? undefined : REQUIRED, url: values.url.trim() ? undefined : REQUIRED };
    setErrors(missing);
    if (!missing.name && !missing.url) {
      add.mutate(values);
    }
  };
  const options = (prefix: string, keys: string[]) => keys.map((value) => ({ value, label: t(`${prefix}.${value}`) }));
  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={t('admin.sources.addTitle')}
      description={t('admin.sources.addDescription')}
      submitLabel={t('admin.sources.submit')}
      submitting={add.isPending}
      error={add.error ? t(sourceErrorKey(add.error)) : undefined}
      onSubmit={submit}
    >
      <TextField label={t('admin.sources.name')} value={values.name} onChange={(e) => setValues((v) => ({ ...v, name: e.target.value }))} error={errors.name} />
      <SelectField
        label={t('admin.sources.connector')}
        options={options('admin.sources.connectors', Object.values(SourceConnector))}
        value={values.connector}
        onValueChange={(connector) => setValues((v) => ({ ...v, connector }))}
      />
      <TextField
        label={t('admin.sources.url')}
        type="url"
        inputMode="url"
        value={values.url}
        onChange={(e) => setValues((v) => ({ ...v, url: e.target.value }))}
        error={errors.url}
        hint={t('admin.sources.urlHint')}
      />
      <SelectField
        label={t('admin.sources.jobType')}
        options={options('enums.opportunity_type', enumValues(OpportunityType))}
        value={values.defaults.type}
        onValueChange={(type) => setDefault('type', type)}
      />
      <SelectField
        label={t('admin.sources.workArrangement')}
        options={options('enums.work_arrangement', enumValues(WorkArrangement))}
        value={values.defaults.workArrangement}
        onValueChange={(arrangement) => setDefault('workArrangement', arrangement)}
      />
      <TextField label={t('admin.sources.location')} value={values.defaults.location ?? ''} onChange={(e) => setDefault('location', e.target.value)} />
      <TextField label={t('admin.sources.organization')} value={values.defaults.organization ?? ''} onChange={(e) => setDefault('organization', e.target.value)} />
      <TextField
        label={t('admin.sources.countryCode')}
        value={values.defaults.countryCode ?? ''}
        onChange={(e) => setDefault('countryCode', e.target.value)}
        hint={t('admin.sources.countryHint')}
        maxLength={2}
      />
    </FormDialog>
  );
}

export function SuggestedSources() {
  const t = useT();
  const api = useAdminApi();
  const suggestions = useQuery({ queryKey: adminKeys.sourceSuggestions, queryFn: () => api.sources.suggestedSources() });
  const add = useAddSource(() => undefined);
  if (!suggestions.data?.length) {
    return null;
  }
  return (
    <Card className="gap-3 p-4">
      <div className="flex flex-col gap-1">
        <h2 className="text-base font-semibold text-foreground">{t('admin.sources.suggestionsTitle')}</h2>
        <p className="text-sm text-muted">{t('admin.sources.suggestionsBody')}</p>
      </div>
      {add.error ? (
        <p role="alert" className="rounded-control bg-danger-subtle px-3 py-2 text-sm text-danger">
          {t(sourceErrorKey(add.error))}
        </p>
      ) : null}
      <ul className="flex flex-col divide-y divide-border">
        {suggestions.data.map((source) => (
          <li key={source.url} className="flex flex-col gap-2 py-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 flex-col">
              <span className="font-medium text-foreground">{source.name}</span>
              <span className="truncate text-xs text-muted">{source.url}</span>
            </div>
            <Button
              size="sm"
              variant="outline"
              icon={Plus}
              loading={add.isPending && add.variables?.url === source.url}
              disabled={add.isPending}
              onClick={() => add.mutate(source)}
              aria-label={`${t('admin.sources.addSuggestion')}: ${source.name}`}
            >
              {t('admin.sources.addSuggestion')}
            </Button>
          </li>
        ))}
      </ul>
    </Card>
  );
}
