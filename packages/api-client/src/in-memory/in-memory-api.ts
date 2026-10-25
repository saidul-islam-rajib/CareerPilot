import {
  ApplicationMode,
  ApprovalState,
  OpportunityDecision,
  OutcomeStatus,
  PauseDuration,
  PauseScope,
  SubmissionStatus,
  SubmissionWindowKind,
  TimelineActor,
} from '@careerpilot/domain-ui-logic';
import { ApiError, ApiErrorCode } from '../errors';
import type { CareerPilotApi, Clock, IdGenerator } from '../ports';
import {
  ApplicationFilter,
  type ApplicationRecord,
  type ApprovalDetail,
  type OpportunityDetail,
  type OpportunitySummary,
  type PauseOption,
  type PublicConfig,
  type Settings,
} from '../types';
import type { DemoState } from './demo.seed';
import { createProfileStore } from './profile-store';

export interface InMemoryApiOptions {
  config: PublicConfig;
  state: DemoState;
  clock: Clock;
  ids: IdGenerator;
  latencyMs: number;
  approvalValidityDays: number;
  recentWindowDays: number;
}

const DAY_MS = 86_400_000;
const MONTHS_PER_YEAR = 12;

const STATUS_GROUPS: Record<Exclude<ApplicationFilter, 'all'>, readonly SubmissionStatus[]> = {
  [ApplicationFilter.Active]: [
    SubmissionStatus.NotStarted,
    SubmissionStatus.Preparing,
    SubmissionStatus.AwaitingApproval,
    SubmissionStatus.ApprovedQueued,
    SubmissionStatus.Submitting,
  ],
  [ApplicationFilter.Submitted]: [SubmissionStatus.SubmittedAwaitingConfirmation, SubmissionStatus.Confirmed],
  [ApplicationFilter.Attention]: [
    SubmissionStatus.AwaitingUserInformation,
    SubmissionStatus.ManualActionRequired,
    SubmissionStatus.OutcomeUnknown,
    SubmissionStatus.Failed,
  ],
};

function clone<T>(value: T): T {
  return value === undefined ? value : (JSON.parse(JSON.stringify(value)) as T);
}

function notFound(): never {
  throw new ApiError(ApiErrorCode.NotFound);
}

function toSummary(detail: OpportunityDetail): OpportunitySummary {
  const { description, matchFactors, requirements, source, circular, route, ...summary } = detail;
  return summary;
}

export function createInMemoryApi(options: InMemoryApiOptions): CareerPilotApi {
  const state = clone(options.state);
  const { clock, ids, config } = options;
  const respond = <T>(value: T): Promise<T> =>
    new Promise((resolve) => setTimeout(() => resolve(clone(value)), options.latencyMs));
  const failWith = (code: ApiErrorCode, detail?: string): Promise<never> =>
    new Promise((_, reject) => setTimeout(() => reject(new ApiError(code, undefined, detail)), options.latencyMs));
  const fail = (code: ApiErrorCode): Promise<never> => failWith(code);
  let signedInId: string | undefined;
  const nowIso = () => clock.now().toISOString();
  const addDays = (days: number) => new Date(clock.now().getTime() + days * DAY_MS).toISOString();

  const findOpportunity = (id: string) => state.opportunities.find((o) => o.id === id) ?? notFound();
  const findApproval = (id: string) => state.approvals.find((a) => a.id === id) ?? notFound();

  const windowLabel = (settings: Settings) =>
    settings.submissionWindow.kind === SubmissionWindowKind.DailyWindow
      ? `${settings.submissionWindow.start ?? ''}–${settings.submissionWindow.end ?? ''}`
      : undefined;

  const pauseUntil = (option: PauseOption): string | undefined => {
    const amount = option.amount ?? 0;
    const date = clock.now();
    switch (option.duration) {
      case PauseDuration.Days:
        return addDays(amount);
      case PauseDuration.Months:
        date.setMonth(date.getMonth() + amount);
        return date.toISOString();
      case PauseDuration.Years:
        date.setMonth(date.getMonth() + amount * MONTHS_PER_YEAR);
        return date.toISOString();
      default:
        return undefined;
    }
  };

  const createApplication = (approval: ApprovalDetail): ApplicationRecord => {
    const detail = findOpportunity(approval.opportunity.id);
    const application: ApplicationRecord = {
      id: ids.next('app'),
      opportunity: toSummary(detail),
      submissionStatus: SubmissionStatus.ApprovedQueued,
      outcomeStatus: OutcomeStatus.NoResponseYet,
      updatedAt: nowIso(),
      route: approval.route,
      timeline: [
        { at: approval.createdAt, actor: TimelineActor.System, text: 'Application package prepared', status: SubmissionStatus.AwaitingApproval },
        { at: nowIso(), actor: TimelineActor.User, text: 'You approved the application', status: SubmissionStatus.ApprovedQueued },
      ],
      questions: clone(approval.materials.answers),
      emails: [],
      files: [{ name: `${approval.materials.cv.name}.pdf`, version: approval.materials.cv.version, sizeBytes: 0 }],
      evidence: [],
      circular: detail.circular,
    };
    state.applications.unshift(application);
    return application;
  };

  return {
    auth: {
      async signIn(request) {
        const account = state.accounts.find(
          (a) => a.user.email.toLowerCase() === request.email.trim().toLowerCase() && a.password === request.password,
        );
        state.signInEvents.unshift({
          id: ids.next('si'),
          at: nowIso(),
          ip: '127.0.0.1',
          device: 'This device',
          approximateLocation: 'Local',
          success: account !== undefined,
          current: account !== undefined,
        });
        signedInId = account?.user.id ?? signedInId;
        return account ? respond({ accessToken: ids.next('token'), user: account.user }) : fail(ApiErrorCode.InvalidCredentials);
      },
      async register(request) {
        if (!request.consent) {
          return fail(ApiErrorCode.Validation);
        }
        const email = request.email.trim().toLowerCase();
        if (state.accounts.some((a) => a.user.email.toLowerCase() === email)) {
          return fail(ApiErrorCode.EmailTaken);
        }
        const user = { id: ids.next('usr'), fullName: request.fullName.trim(), email };
        state.accounts.push({ user, password: request.password });
        signedInId = user.id;
        return respond({ accessToken: ids.next('token'), user });
      },
      requestPasswordReset: () => respond(undefined),
      signOut: () => respond(undefined),
    },
    config: {
      getPublicConfig: () => respond(config),
    },
    dashboard: {
      async getDashboard() {
        const weekAgo = clock.now().getTime() - options.recentWindowDays * DAY_MS;
        const tracks = [...state.settings.tracks]
          .sort((a, b) => a.position - b.position)
          .map((track) => ({
            track,
            opportunities: (state.trackOpportunities[track.id] ?? [])
              .map(findOpportunity)
              .filter((o) => o.decision !== OpportunityDecision.Dismissed)
              .sort((a, b) => b.matchScore - a.matchScore)
              .slice(0, track.resultCount)
              .map(toSummary),
          }));
        return respond({
          counts: {
            newMatches: tracks.reduce((sum, t) => sum + t.opportunities.length, 0),
            awaitingApproval: state.approvals.filter((a) => a.state === ApprovalState.Pending).length,
            appliedThisWeek: state.applications.filter((a) => a.appliedAt && new Date(a.appliedAt).getTime() >= weekAgo).length,
            interviews: state.applications.filter((a) => a.outcomeStatus === OutcomeStatus.Interview).length,
          },
          pause: state.settings.pause,
          lastCheckedAt: state.lastCheckedAt,
          tracks,
        });
      },
    },
    opportunities: {
      getOpportunity: async (id) => respond(findOpportunity(id)),
      async decide(id, decision) {
        findOpportunity(id).decision = decision;
        return respond(undefined);
      },
      async prepareApplication(id) {
        const existing = state.approvals.find((a) => a.opportunity.id === id && a.state === ApprovalState.Pending);
        if (existing) {
          return respond(existing);
        }
        const detail = findOpportunity(id);
        const approval: ApprovalDetail = {
          id: ids.next('apr'),
          opportunity: toSummary(detail),
          state: ApprovalState.Pending,
          createdAt: nowIso(),
          expiresAt: addDays(options.approvalValidityDays),
          route: detail.route,
          materials: {
            cv: { name: state.profile.documents[0]?.name ?? state.profile.fullName, version: state.profile.documents[0]?.version ?? 1 },
            coverLetter: `Dear ${detail.organization} team,\n\nI would like to apply for the ${detail.title} role.\n\n${state.profile.fullName}`,
            answers: [],
          },
          submissionWindowLabel: windowLabel(state.settings),
        };
        detail.decision = OpportunityDecision.Interested;
        state.approvals.unshift(approval);
        return respond(approval);
      },
    },
    approvals: {
      listApprovals: async () =>
        respond(
          state.approvals
            .filter((a) => a.state === ApprovalState.Pending)
            .sort((a, b) => a.expiresAt.localeCompare(b.expiresAt))
            .map(({ materials, route, submissionWindowLabel, ...summary }) => summary),
        ),
      getApproval: async (id) => respond({ ...findApproval(id), submissionWindowLabel: windowLabel(state.settings) }),
      async updateAnswer(approvalId, answerId, answer) {
        const approval = findApproval(approvalId);
        const item = approval.materials.answers.find((a) => a.id === answerId) ?? notFound();
        item.answer = answer;
        item.source = 'user';
        return respond(approval);
      },
      async approve(id) {
        const approval = findApproval(id);
        if (approval.state !== ApprovalState.Pending) {
          return fail(ApiErrorCode.Conflict);
        }
        approval.state = ApprovalState.Approved;
        createApplication(approval);
        return respond({ ...approval, submissionWindowLabel: windowLabel(state.settings) });
      },
      async reject(id) {
        const approval = findApproval(id);
        if (approval.state !== ApprovalState.Pending) {
          return fail(ApiErrorCode.Conflict);
        }
        approval.state = ApprovalState.Rejected;
        return respond(approval);
      },
    },
    applications: {
      listApplications: async (filter) =>
        respond(
          state.applications
            .filter((a) => filter === ApplicationFilter.All || STATUS_GROUPS[filter].includes(a.submissionStatus))
            .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
            .map(({ route, timeline, questions, emails, files, evidence, circular, ...summary }) => summary),
        ),
      getApplication: async (id) => respond(state.applications.find((a) => a.id === id) ?? notFound()),
    },
    profile: createProfileStore({ profile: state.profile, config, clock, ids, respond, reject: failWith }),
    settings: {
      getSettings: async () => respond(state.settings),
      async updateTrack(id, update) {
        const track = state.settings.tracks.find((t) => t.id === id) ?? notFound();
        const bounds = config.validationPolicy.track;
        if (update.resultCount !== undefined && (update.resultCount < bounds.minResultCount || update.resultCount > bounds.maxResultCount)) {
          return fail(ApiErrorCode.Validation);
        }
        if (update.mode !== undefined && !(Object.values(ApplicationMode) as string[]).includes(update.mode)) {
          return fail(ApiErrorCode.Validation);
        }
        Object.assign(track, update);
        return respond(track);
      },
      async pause(option) {
        state.settings.pause = { scope: PauseScope.All, startedAt: nowIso(), until: pauseUntil(option) };
        return respond(state.settings);
      },
      async resume() {
        delete state.settings.pause;
        return respond(state.settings);
      },
      async updateSubmissionWindow(window) {
        state.settings.submissionWindow = window;
        return respond(state.settings);
      },
      listSignInActivity: async () => respond([...state.signInEvents].sort((a, b) => b.at.localeCompare(a.at))),
      async changePassword(change) {
        const account = state.accounts.find((a) => a.user.id === signedInId) ?? state.accounts[0];
        if (!account || account.password !== change.currentPassword) {
          return fail(ApiErrorCode.InvalidCredentials);
        }
        const policy = config.validationPolicy.password;
        if (change.newPassword.length < policy.minLength || change.newPassword.length > policy.maxLength) {
          return failWith(ApiErrorCode.Validation, 'password');
        }
        account.password = change.newPassword;
        return respond(undefined);
      },
      requestAccountDeletion: async () => respond({ scheduledFor: addDays(config.accountDeletionGraceDays) }),
    },
  };
}
