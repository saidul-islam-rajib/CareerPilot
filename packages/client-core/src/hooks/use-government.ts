import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  CircularFilters,
  FeeChange,
  GovApplication,
  PostEligibility,
  SecretValues,
  StageInput,
  UploadSource,
} from '@careerpilot/api-client';
import { DayKind, Eligibility, FeeStatus, FeeUrgency, GovApplicationStatus } from '@careerpilot/domain-ui-logic';
import { useApi } from '../services/app-services';

export const governmentKeys = {
  reference: ['government', 'reference'] as const,
  circulars: (filters: CircularFilters) => ['government', 'circulars', filters] as const,
  circularsAll: ['government', 'circulars'] as const,
  circular: (id: string) => ['government', 'circular', id] as const,
  applications: ['government', 'applications'] as const,
  application: (id: string) => ['government', 'application', id] as const,
  guide: (id: string) => ['government', 'guide', id] as const,
  upcoming: ['government', 'upcoming'] as const,
};

export function enumLabelKey(enumKey: string, value: string): string {
  return `enums.${enumKey}.${value}`;
}

export function eligibilityKey(outcome: Eligibility): string {
  return `government.eligibility.${outcome}`;
}

export function reasonKey(reason: string): string {
  return `government.reason.${reason}`;
}

export function dayNoteKey(kind: DayKind): string | undefined {
  return kind === DayKind.Working ? undefined : `government.day.${kind}`;
}

export function urgencyKey(urgency: FeeUrgency): string | undefined {
  return urgency === FeeUrgency.None ? undefined : `government.urgency.${urgency}`;
}

export function eligibilityOfPost(posts: PostEligibility[], postId: string): PostEligibility | undefined {
  return posts.find((post) => post.postId === postId);
}

export function canMarkSubmitted(application: GovApplication): boolean {
  return application.status === GovApplicationStatus.Preparing;
}

export function feeNeedsAction(application: GovApplication): boolean {
  return application.fee.status === FeeStatus.Due || application.fee.status === FeeStatus.Unconfirmed;
}

export function moveItem<T>(items: readonly T[], from: number, to: number): T[] {
  const next = [...items];
  const [moved] = next.splice(from, 1);
  if (moved === undefined || to < 0 || to > next.length) {
    return [...items];
  }
  next.splice(to, 0, moved);
  return next;
}

export function useGovernmentReference() {
  const api = useApi();
  return useQuery({ queryKey: governmentKeys.reference, queryFn: () => api.government.reference() });
}

export function useCirculars(filters: CircularFilters = {}) {
  const api = useApi();
  return useQuery({ queryKey: governmentKeys.circulars(filters), queryFn: () => api.government.listCirculars(filters) });
}

export function useCircular(id: string) {
  const api = useApi();
  return useQuery({ queryKey: governmentKeys.circular(id), queryFn: () => api.government.getCircular(id) });
}

export function useGovApplications() {
  const api = useApi();
  return useQuery({ queryKey: governmentKeys.applications, queryFn: () => api.government.listApplications() });
}

export function useGovApplication(id: string) {
  const api = useApi();
  return useQuery({ queryKey: governmentKeys.application(id), queryFn: () => api.government.getApplication(id) });
}

export function useGovGuide(id: string) {
  const api = useApi();
  return useQuery({ queryKey: governmentKeys.guide(id), queryFn: () => api.government.guide(id) });
}

export function useGovUpcoming() {
  const api = useApi();
  return useQuery({ queryKey: governmentKeys.upcoming, queryFn: () => api.government.upcoming() });
}

function useRefreshAfter() {
  const client = useQueryClient();
  return async (application?: GovApplication) => {
    if (application) {
      client.setQueryData(governmentKeys.application(application.id), application);
    }
    await Promise.all([
      client.invalidateQueries({ queryKey: governmentKeys.applications }),
      client.invalidateQueries({ queryKey: governmentKeys.upcoming }),
      application ? client.invalidateQueries({ queryKey: governmentKeys.guide(application.id) }) : undefined,
    ]);
  };
}

export function useStartGovApplication() {
  const api = useApi();
  const refresh = useRefreshAfter();
  return useMutation({
    mutationFn: (input: { circularId: string; postIds: string[] }) => api.government.startApplication(input.circularId, input.postIds),
    onSuccess: refresh,
  });
}

export function useWithdrawGovApplication() {
  const api = useApi();
  const refresh = useRefreshAfter();
  return useMutation({ mutationFn: (id: string) => api.government.withdrawApplication(id), onSuccess: () => refresh() });
}

export function useGovApplicationActions(id: string) {
  const api = useApi();
  const refresh = useRefreshAfter();
  const options = { onSuccess: refresh };
  return {
    submitted: useMutation({ mutationFn: () => api.government.markSubmitted(id), ...options }),
    confirm: useMutation({ mutationFn: () => api.government.confirmApplication(id), ...options }),
    fee: useMutation({ mutationFn: (change: FeeChange) => api.government.updateFee(id, change), ...options }),
    addStage: useMutation({ mutationFn: (stage: StageInput) => api.government.addStage(id, stage), ...options }),
    updateStage: useMutation({
      mutationFn: (input: { stageId: string; stage: StageInput }) => api.government.updateStage(id, input.stageId, input.stage),
      ...options,
    }),
    removeStage: useMutation({ mutationFn: (stageId: string) => api.government.removeStage(id, stageId), ...options }),
    addCopy: useMutation({ mutationFn: (file: UploadSource) => api.government.addCopy(id, file), ...options }),
    removeCopy: useMutation({ mutationFn: (copyId: string) => api.government.removeCopy(id, copyId), ...options }),
    setSecrets: useMutation({ mutationFn: (values: SecretValues) => api.government.setSecrets(id, values), ...options }),
    reveal: useMutation({ mutationFn: () => api.government.revealSecrets(id) }),
  };
}
