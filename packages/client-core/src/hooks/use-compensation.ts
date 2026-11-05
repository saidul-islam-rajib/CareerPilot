import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '../query/query-keys';
import { useApi } from '../services/app-services';
import {
  compensationFormError,
  compensationFormOf,
  compensationRuleOf,
  type CompensationFormState,
} from './compensation-form';
import { useSettings } from './use-settings';

export function useCompensation() {
  const api = useApi();
  const client = useQueryClient();
  const settings = useSettings();
  const reference = useQuery({ queryKey: queryKeys.compensationReference, queryFn: () => api.settings.compensationReference() });
  const [draft, setDraft] = useState<Partial<CompensationFormState>>({});
  const [error, setError] = useState<string | undefined>();
  const currencies = reference.data?.currencies ?? [];
  const save = useMutation({
    mutationFn: (form: CompensationFormState) => api.settings.updateCompensation(compensationRuleOf(form)),
    onSuccess: async (updated) => {
      client.setQueryData(queryKeys.settings, updated);
      await client.invalidateQueries({ queryKey: queryKeys.dashboard });
      setDraft({});
    },
  });
  const form = { ...compensationFormOf(settings.data?.compensation, currencies[0] ?? ''), ...draft };
  return {
    settings,
    reference,
    currencies,
    form,
    error,
    dirty: Object.keys(draft).length > 0,
    saving: save.isPending,
    saved: save.isSuccess && Object.keys(draft).length === 0,
    failed: save.isError,
    change: <K extends keyof CompensationFormState>(key: K, value: CompensationFormState[K]) => {
      setDraft((current) => ({ ...current, [key]: value }));
      setError(undefined);
    },
    submit: () => {
      const invalid = compensationFormError(form);
      setError(invalid);
      if (!invalid) {
        save.mutate(form);
      }
    },
  };
}
