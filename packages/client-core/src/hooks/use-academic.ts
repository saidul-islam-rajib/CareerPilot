import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  isApiError,
  type AcademicApi,
  type AcademicWarning,
  type DashboardSummary,
  type Exam,
  type OpportunitySummary,
} from '@careerpilot/api-client';
import { AcademicFailure } from '@careerpilot/domain-ui-logic';
import { queryKeys } from '../query/query-keys';
import { useApi } from '../services/app-services';

const GENERIC_ERROR_KEY = 'academic.errors.generic';
const ERROR_KEYS: Readonly<Record<string, string>> = Object.fromEntries(
  Object.values(AcademicFailure).map((failure) => [failure, `academic.errors.${failure}`]),
);

export function academicErrorKey(error: unknown): string {
  return (isApiError(error) && ERROR_KEYS[error.detail ?? '']) || GENERIC_ERROR_KEY;
}

export function warningKey(warning: AcademicWarning): string {
  return `academic.warnings.${warning.kind}`;
}

export function examsExpiringFirst(exams: Exam[]): Exam[] {
  return [...exams].sort((a, b) => (a.expiresOn ?? '9999').localeCompare(b.expiresOn ?? '9999'));
}

const STUDY_TYPES: readonly string[] = ['masters', 'phd', 'scholarship', 'internship'];

export function studyOpportunities(dashboard: DashboardSummary | undefined, tracked: readonly string[]): OpportunitySummary[] {
  const seen = new Set<string>(tracked);
  const found: OpportunitySummary[] = [];
  for (const digest of dashboard?.tracks ?? []) {
    for (const opportunity of digest.opportunities) {
      if (STUDY_TYPES.includes(opportunity.type) && !seen.has(opportunity.id)) {
        seen.add(opportunity.id);
        found.push(opportunity);
      }
    }
  }
  return found;
}

export function useAcademicReference() {
  const api = useApi();
  return useQuery({
    queryKey: queryKeys.academicReference,
    queryFn: () => api.academic.reference(),
    staleTime: Infinity,
  });
}

export function useAcademicOverview() {
  const api = useApi();
  return useQuery({
    queryKey: queryKeys.academicOverview,
    queryFn: () => api.academic.overview(),
  });
}

export function usePrograms() {
  const api = useApi();
  return useQuery({
    queryKey: queryKeys.academicPrograms,
    queryFn: () => api.academic.listPrograms(),
  });
}

export function useProgram(id: string) {
  const api = useApi();
  return useQuery({
    queryKey: queryKeys.academicProgram(id),
    queryFn: () => api.academic.getProgram(id),
  });
}

export function useProgramPlan(id: string) {
  const api = useApi();
  return useQuery({
    queryKey: queryKeys.academicPlan(id),
    queryFn: () => api.academic.plan(id),
  });
}

export function useOfferComparison() {
  const api = useApi();
  return useQuery({
    queryKey: queryKeys.academicOffers,
    queryFn: () => api.academic.compareOffers(),
  });
}

export function useExams() {
  const api = useApi();
  return useQuery({
    queryKey: queryKeys.academicExams,
    queryFn: () => api.academic.listExams(),
  });
}

export function useCredentials() {
  const api = useApi();
  return useQuery({
    queryKey: queryKeys.academicCredentials,
    queryFn: () => api.academic.listCredentials(),
  });
}

export function useReferees() {
  const api = useApi();
  return useQuery({
    queryKey: queryKeys.academicReferees,
    queryFn: () => api.academic.listReferees(),
  });
}

export function useRecommendations(programId?: string) {
  const api = useApi();
  return useQuery({
    queryKey: queryKeys.academicRecommendations(programId),
    queryFn: () => api.academic.listRecommendations(programId),
  });
}

export function useOutreach() {
  const api = useApi();
  return useQuery({
    queryKey: queryKeys.academicOutreach,
    queryFn: () => api.academic.listOutreach(),
  });
}

export function useOutreachSettings() {
  const api = useApi();
  return useQuery({
    queryKey: queryKeys.academicSettings,
    queryFn: () => api.academic.getSettings(),
  });
}

function useAcademicMutation<TArgs, TResult>(run: (api: AcademicApi, args: TArgs) => Promise<TResult>) {
  const client = useQueryClient();
  const api = useApi();
  return useMutation({
    mutationFn: (args: TArgs) => run(api.academic, args),
    onSuccess: () => client.invalidateQueries({ queryKey: queryKeys.academic }),
  });
}

export function useAcademicActions() {
  return {
    createProgram: useAcademicMutation((api, input: Parameters<AcademicApi['createProgram']>[0]) => api.createProgram(input)),
    fromOpportunity: useAcademicMutation((api, id: string) => api.createProgramFromOpportunity(id)),
    updateProgram: useAcademicMutation((api, a: { id: string; input: Parameters<AcademicApi['updateProgram']>[1] }) =>
      api.updateProgram(a.id, a.input),
    ),
    removeProgram: useAcademicMutation((api, id: string) => api.removeProgram(id)),
    recordAction: useAcademicMutation((api, a: { id: string; action: Parameters<AcademicApi['recordAction']>[1] }) =>
      api.recordAction(a.id, a.action, true),
    ),
    generateChecklist: useAcademicMutation((api, id: string) => api.generateChecklist(id)),
    createExam: useAcademicMutation((api, input: Parameters<AcademicApi['createExam']>[0]) => api.createExam(input)),
    removeExam: useAcademicMutation((api, id: string) => api.removeExam(id)),
    createCredential: useAcademicMutation((api, input: Parameters<AcademicApi['createCredential']>[0]) => api.createCredential(input)),
    removeCredential: useAcademicMutation((api, id: string) => api.removeCredential(id)),
    createReferee: useAcademicMutation((api, input: Parameters<AcademicApi['createReferee']>[0]) => api.createReferee(input)),
    setConsent: useAcademicMutation((api, a: { id: string; confirmed: boolean }) => api.setRefereeConsent(a.id, a.confirmed)),
    removeReferee: useAcademicMutation((api, id: string) => api.removeReferee(id)),
    createRecommendation: useAcademicMutation((api, input: Parameters<AcademicApi['createRecommendation']>[0]) => api.createRecommendation(input)),
    setRecommendationStatus: useAcademicMutation(
      (
        api,
        a: {
          id: string;
          change: Parameters<AcademicApi['setRecommendationStatus']>[1];
        },
      ) => api.setRecommendationStatus(a.id, a.change),
    ),
    removeRecommendation: useAcademicMutation((api, id: string) => api.removeRecommendation(id)),
    draftOutreach: useAcademicMutation((api, input: Parameters<AcademicApi['draftOutreach']>[0]) => api.draftOutreach(input)),
    updateOutreach: useAcademicMutation((api, a: { id: string; input: Parameters<AcademicApi['updateOutreach']>[1] }) =>
      api.updateOutreach(a.id, a.input),
    ),
    markSent: useAcademicMutation((api, id: string) => api.markOutreachSent(id)),
    recordReply: useAcademicMutation(
      (
        api,
        a: {
          id: string;
          outcome: Parameters<AcademicApi['recordOutreachReply']>[1];
        },
      ) => api.recordOutreachReply(a.id, a.outcome),
    ),
    removeOutreach: useAcademicMutation((api, id: string) => api.removeOutreach(id)),
    updateSettings: useAcademicMutation((api, settings: Parameters<AcademicApi['updateSettings']>[0]) => api.updateSettings(settings)),
  };
}
