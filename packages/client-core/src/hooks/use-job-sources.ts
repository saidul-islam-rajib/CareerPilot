import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ApiErrorCode,
  ApiErrorDetail,
  isApiError,
  type NewUserSource,
  type OpportunityDetail,
  type SourceJob,
  type UserSource,
} from '@careerpilot/api-client';
import { SourceReview, WorkArrangement } from '@careerpilot/domain-ui-logic';
import { ValidationMessage, type FieldErrors } from '@careerpilot/validation';
import { usePublicConfig } from '../config/public-config';
import { queryKeys } from '../query/query-keys';
import { useApi } from '../services/app-services';

const SOURCE_ERROR_KEYS: Readonly<Record<string, string>> = {
  [ApiErrorDetail.SourceUrl]: 'sources.errors.url',
  [ApiErrorDetail.JobsNotFound]: 'sources.errors.jobsNotFound',
  [ApiErrorDetail.SourceExists]: 'sources.errors.exists',
  [ApiErrorDetail.SourceShared]: 'sources.errors.shared',
  [ApiErrorDetail.SourceLimit]: 'sources.errors.limit',
  [ApiErrorDetail.SourceDisabled]: 'sources.errors.disabled',
  [ApiErrorDetail.PersonalEmail]: 'sources.errors.personalEmail',
  [ApiErrorDetail.CompanyNotFound]: 'sources.errors.companyNotFound',
};
const SLOW_ERROR_KEY = 'sources.errors.slow';
export const ARRANGEMENT_ORDER: readonly WorkArrangement[] = [WorkArrangement.Onsite, WorkArrangement.Hybrid, WorkArrangement.Remote, WorkArrangement.NotStated];
const SOURCE_PROBLEMS: readonly string[] = ['invalid_feed', 'invalid_board', 'http_status', 'unreachable', 'unsafe_address', 'no_jobs_found'];
const FALLBACK_ERROR_KEY = 'sources.errors.generic';
const OTHER_PROBLEM = 'other';
const EMPTY_SOURCE: NewUserSource = { url: '', name: '', note: '' };

export function sourceErrorKey(error: unknown): string {
  if (isApiError(error) && error.code === ApiErrorCode.Timeout) {
    return SLOW_ERROR_KEY;
  }
  return (isApiError(error) && SOURCE_ERROR_KEYS[error.detail ?? '']) || FALLBACK_ERROR_KEY;
}

export function arrangementKey(arrangement: string): string {
  return `sources.arrangements.${arrangement}`;
}

export interface ArrangementCount {
  arrangement: WorkArrangement;
  count: number;
}

export function arrangementCounts(counts: Partial<Record<string, number>>): ArrangementCount[] {
  return ARRANGEMENT_ORDER.map((arrangement) => ({ arrangement, count: counts[arrangement] ?? 0 })).filter((entry) => entry.count > 0);
}

export function jobsIn(jobs: SourceJob[], arrangement: WorkArrangement | undefined): SourceJob[] {
  return arrangement ? jobs.filter((job) => job.workArrangement === arrangement) : jobs;
}

export function useSourceJobs(id: string) {
  const api = useApi();
  return useQuery({ queryKey: queryKeys.sourceJobs(id), queryFn: () => api.sources.listJobs(id) });
}

export function useSaveSourceJob(id: string) {
  const api = useApi();
  const client = useQueryClient();
  return useMutation({
    mutationFn: (jobId: string) => api.sources.saveJob(id, jobId),
    onSuccess: async () => {
      await Promise.all([client.invalidateQueries({ queryKey: queryKeys.sourceJobs(id) }), client.invalidateQueries({ queryKey: queryKeys.dashboard })]);
    },
  });
}

export function sourceProblemKey(problem: string): string {
  return `sources.problems.${SOURCE_PROBLEMS.includes(problem) ? problem : OTHER_PROBLEM}`;
}

export function sourceReviewKey(source: UserSource): string {
  return `sources.reviewHint.${source.review}`;
}

export function isSharedSource(source: UserSource): boolean {
  return source.review === SourceReview.Approved;
}

function useSourceRefresh() {
  const client = useQueryClient();
  return async () => {
    await client.invalidateQueries({ queryKey: queryKeys.jobSources });
    await client.invalidateQueries({ queryKey: queryKeys.dashboard });
  };
}

export function useJobSources() {
  const api = useApi();
  return useQuery({ queryKey: queryKeys.jobSources, queryFn: () => api.sources.listSources() });
}

export function useRemoveJobSource() {
  const api = useApi();
  const refresh = useSourceRefresh();
  return useMutation({ mutationFn: (id: string) => api.sources.removeSource(id), onSuccess: refresh });
}

export function useAddJobSourceForm(onAdded?: (source: UserSource) => void) {
  const api = useApi();
  const { config } = usePublicConfig();
  const refresh = useSourceRefresh();
  const [values, setValues] = useState<NewUserSource>(EMPTY_SOURCE);
  const [errors, setErrors] = useState<FieldErrors>({});
  const mutation = useMutation({
    mutationFn: (input: NewUserSource) => api.sources.addSource(input),
    onSuccess: async (source) => {
      setValues(EMPTY_SOURCE);
      await refresh();
      onAdded?.(source);
    },
  });

  const submit = () => {
    const found: FieldErrors = values.url.trim() ? {} : { url: ValidationMessage.Required };
    setErrors(found);
    if (!found.url) {
      mutation.mutate({ url: values.url.trim(), name: values.name?.trim(), note: values.note?.trim() });
    }
  };

  return {
    values,
    errors,
    nameMaxLength: config.validationPolicy.name.maxLength,
    noteMaxLength: config.validationPolicy.note.maxLength,
    maxSources: config.jobSources.maxPerUser,
    setField: (field: keyof NewUserSource, value: string) => {
      setValues((current) => ({ ...current, [field]: value }));
      setErrors((current) => ({ ...current, [field]: undefined }));
    },
    submit,
    adding: mutation.isPending,
    formError: mutation.error ? sourceErrorKey(mutation.error) : undefined,
    reset: () => mutation.reset(),
  };
}

const JOB_LINK_ERROR_KEYS: Readonly<Record<string, string>> = {
  [ApiErrorDetail.JobUrl]: 'jobLink.errors.url',
  [ApiErrorDetail.JobNotFound]: 'jobLink.errors.notFound',
};

export function jobLinkErrorKey(error: unknown): string {
  return (isApiError(error) && JOB_LINK_ERROR_KEYS[error.detail ?? '']) || 'jobLink.errors.generic';
}

export function useAddJobByLink(onAdded: (opportunity: OpportunityDetail) => void) {
  const api = useApi();
  const client = useQueryClient();
  const [url, setUrl] = useState('');
  const [error, setError] = useState<string>();
  const mutation = useMutation({
    mutationFn: (link: string) => api.opportunities.addByLink(link),
    onSuccess: async (opportunity) => {
      setUrl('');
      client.setQueryData(queryKeys.opportunity(opportunity.id), opportunity);
      await client.invalidateQueries({ queryKey: queryKeys.dashboard });
      onAdded(opportunity);
    },
  });
  return {
    url,
    error,
    setUrl: (value: string) => {
      setUrl(value);
      setError(undefined);
    },
    submit: () => {
      if (!url.trim()) {
        setError(ValidationMessage.Required);
        return;
      }
      mutation.mutate(url.trim());
    },
    adding: mutation.isPending,
    formError: mutation.error ? jobLinkErrorKey(mutation.error) : undefined,
  };
}
