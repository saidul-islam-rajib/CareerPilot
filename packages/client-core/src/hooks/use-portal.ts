import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { isApiError, type AttemptView, type AutopilotInput, type CompleteInput, type AutopilotState, type PortalAccountInput, type ResumeInput } from '@careerpilot/api-client';
import {
  AttemptState,
  HostPolicy,
  PortalAccountStatus,
  PortalFailure,
  ReadinessState,
  StatusTone,
  type StopReason,
  type Verdict,
  type WallKind,
} from '@careerpilot/domain-ui-logic';
import { useApi } from '../services/app-services';

const READINESS_POLL_MS = 3000;

export const portalKeys = {
  all: ['portal'] as const,
  autopilot: ['portal', 'autopilot'] as const,
  accounts: ['portal', 'accounts'] as const,
  attempt: (applicationId: string) => ['portal', 'attempt', applicationId] as const,
  fillPlan: (applicationId: string) => ['portal', 'fill-plan', applicationId] as const,
  readiness: (reportId: string) => ['portal', 'readiness', reportId] as const,
};

const KNOWN_FAILURES: readonly string[] = Object.values(PortalFailure);

const ATTEMPT_TONES: Record<AttemptState, StatusTone> = {
  [AttemptState.Stopped]: StatusTone.Warning,
  [AttemptState.Confirmed]: StatusTone.Success,
  [AttemptState.Uncertain]: StatusTone.Warning,
  [AttemptState.Failed]: StatusTone.Danger,
  [AttemptState.ReadinessOnly]: StatusTone.Info,
};

const HOST_TONES: Record<HostPolicy, StatusTone> = {
  [HostPolicy.Allowed]: StatusTone.Success,
  [HostPolicy.Blocked]: StatusTone.Danger,
  [HostPolicy.Review]: StatusTone.Warning,
};

export interface AutopilotDraft {
  acknowledged: boolean;
  allowAccountCreation: boolean;
  accountEmail: string;
  acceptTerms: boolean;
  acceptPrivacy: boolean;
  allowEmailVerification: boolean;
}

export function autopilotDraftOf(state: AutopilotState): AutopilotDraft {
  const { permissions } = state.settings;
  return {
    acknowledged: state.settings.enabled,
    allowAccountCreation: permissions.allowAccountCreation,
    accountEmail: permissions.accountEmail ?? '',
    acceptTerms: permissions.acceptTerms,
    acceptPrivacy: permissions.acceptPrivacy,
    allowEmailVerification: permissions.allowEmailVerification,
  };
}

export function autopilotInputOf(draft: AutopilotDraft): AutopilotInput {
  const email = draft.accountEmail.trim();
  return {
    acknowledged: draft.acknowledged,
    allowAccountCreation: draft.allowAccountCreation,
    accountEmail: email || undefined,
    acceptTerms: draft.acceptTerms,
    acceptPrivacy: draft.acceptPrivacy,
    allowEmailVerification: draft.allowEmailVerification,
  };
}

export function portalErrorKey(error: unknown, fallback: string): string {
  const detail = isApiError(error) ? error.detail : undefined;
  return detail && KNOWN_FAILURES.includes(detail) ? `portal.error.${detail}` : fallback;
}

export function stopReasonKey(reason: StopReason): string {
  return `portal.stop.${reason}`;
}

export function attemptStateKey(state: AttemptState): string {
  return `portal.attemptState.${state}`;
}

export function attemptStateTone(state: AttemptState): StatusTone {
  return ATTEMPT_TONES[state];
}

export function hostPolicyKey(policy: HostPolicy): string {
  return `portal.hostPolicy.${policy}`;
}

export function hostPolicyTone(policy: HostPolicy): StatusTone {
  return HOST_TONES[policy];
}

export function verdictKey(verdict: Verdict): string {
  return `portal.verdict.${verdict}`;
}

export function wallKey(wall: WallKind): string {
  return `portal.wall.${wall}`;
}

export function accountStatusKey(status: PortalAccountStatus): string {
  return `portal.accountStatus.${status}`;
}

export function accountNeedsAttention(status: PortalAccountStatus): boolean {
  return status === PortalAccountStatus.NeedsAttention;
}

export function portalUserStepKey(step: string): string {
  return `portal.userOnlyStep.${step}`;
}

export function attemptCanResume(attempt: AttemptView): boolean {
  return attempt.state !== AttemptState.Confirmed && !attempt.submitClicked;
}

export function attemptHasProof(attempt: AttemptView): boolean {
  return !!(attempt.confirmationText || attempt.finalUrl || attempt.evidenceKey);
}

export function usePortalAutopilot() {
  const api = useApi();
  return useQuery({ queryKey: portalKeys.autopilot, queryFn: () => api.portal.autopilot() });
}

export function usePortalAccounts() {
  const api = useApi();
  return useQuery({ queryKey: portalKeys.accounts, queryFn: () => api.portal.listAccounts() });
}

export function usePortalAttempt(applicationId: string, enabled = true) {
  const api = useApi();
  return useQuery({
    queryKey: portalKeys.attempt(applicationId),
    queryFn: () => api.portal.attempt(applicationId).catch(() => null),
    enabled,
  });
}

export function usePortalFillPlan(applicationId: string, enabled = true) {
  const api = useApi();
  return useQuery({
    queryKey: portalKeys.fillPlan(applicationId),
    queryFn: () => api.portal.fillPlan(applicationId),
    enabled,
    staleTime: 0,
    gcTime: 0,
  });
}

export function usePortalReadiness(reportId: string | undefined) {
  const api = useApi();
  return useQuery({
    queryKey: portalKeys.readiness(reportId ?? ''),
    queryFn: () => api.portal.readinessReport(reportId ?? ''),
    enabled: !!reportId,
    refetchInterval: (query) => (query.state.data?.state === ReadinessState.Pending ? READINESS_POLL_MS : false),
  });
}

export function usePortalActions() {
  const api = useApi();
  const client = useQueryClient();
  const refresh = () => client.invalidateQueries({ queryKey: portalKeys.all });
  const refreshApplications = () => {
    void refresh();
    void client.invalidateQueries({ queryKey: ['applications'] });
  };
  return {
    enable: useMutation({ mutationFn: (input: AutopilotInput) => api.portal.enableAutopilot(input), onSuccess: refresh }),
    disable: useMutation({ mutationFn: () => api.portal.disableAutopilot(), onSuccess: refresh }),
    addAccount: useMutation({ mutationFn: (input: PortalAccountInput) => api.portal.addAccount(input), onSuccess: refresh }),
    removeAccount: useMutation({ mutationFn: (id: string) => api.portal.removeAccount(id), onSuccess: refresh }),
    reveal: useMutation({ mutationFn: (id: string) => api.portal.revealAccount(id) }),
    exportAll: useMutation({ mutationFn: () => api.portal.exportAccounts() }),
    resume: useMutation({
      mutationFn: (input: { applicationId: string; body: ResumeInput }) => api.portal.resume(input.applicationId, input.body),
      onSuccess: refreshApplications,
    }),
    complete: useMutation({
      mutationFn: (input: string | { applicationId: string; body?: CompleteInput }) =>
        typeof input === 'string' ? api.portal.complete(input) : api.portal.complete(input.applicationId, input.body),
      onSuccess: refreshApplications,
    }),
    revealPassword: useMutation({ mutationFn: (applicationId: string) => api.portal.fillPassword(applicationId) }),
    evidenceLink: useMutation({ mutationFn: (applicationId: string) => api.portal.evidenceLink(applicationId) }),
    checkJob: useMutation({ mutationFn: (url: string) => api.portal.requestReadiness(url) }),
  };
}
