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
  TrackKind,
} from '@careerpilot/domain-ui-logic';
import { isHttpsAddress, sameAddress, secureAddress } from '../addresses';
import { ApiError, ApiErrorCode, ApiErrorDetail } from '../errors';
import type { CareerPilotApi, Clock, IdGenerator } from '../ports';
import {
  AnswerSource,
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
import { createAccountLinks } from './account-links';
import { createAnswers, hasBlankAnswers } from './answers';
import { createFollowUps } from './follow-ups';
import { createJobSources } from './job-sources';
import { createProfileStore } from './profile-store';

export interface InMemoryApiOptions {
  config: PublicConfig;
  state: DemoState;
  clock: Clock;
  ids: IdGenerator;
  latencyMs: number;
  demoVerificationCode: string;
  demoLinkToken: string;
  approvalValidityDays: number;
  recentWindowDays: number;
}

const DAY_MS = 86_400_000;
const TIME_OF_DAY = /^([01]\d|2[0-3]):[0-5]\d$/;
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

const HOME_COUNTRY = 'BD';
const LEAD_TRACK_KINDS: readonly string[] = [TrackKind.BangladeshOnsite];

function orderTracks<T extends { kind: string; position: number }>(tracks: readonly T[]): T[] {
  return [...tracks]
    .sort((a, b) => Number(LEAD_TRACK_KINDS.includes(b.kind)) - Number(LEAD_TRACK_KINDS.includes(a.kind)) || a.position - b.position)
    .map((track, index) => ({ ...track, position: index + 1 }));
}

const COUNTRY_CODE = /^[A-Z]{2}$/;

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

  const followUps = createFollowUps({ applications: state.applications, config, clock, ids, respond, reject: failWith });
  const jobSources = createJobSources({ sources: state.jobSources, limit: config.jobSources.maxPerUser, clock, ids, respond, reject: failWith });
  const answers = createAnswers({ saved: state.savedAnswers, approvals: state.approvals, applications: state.applications, config, clock, ids, respond, reject: failWith });
  const accountLinks = createAccountLinks({
    accounts: state.accounts,
    config,
    demoLinkToken: options.demoLinkToken,
    ids,
    respond,
    reject: failWith,
    onSignIn: (userId) => {
      signedInId = userId;
    },
  });

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
      tasks: [],
    };
    state.applications.unshift(application);
    return application;
  };

  return {
    auth: {
      async signIn(request) {
        const account = state.accounts.find(
          (a) => !a.registered && a.user.email.toLowerCase() === request.email.trim().toLowerCase() && a.password === request.password,
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
      register: (request) => accountLinks.register(request),
      requestPasswordReset: (email) => accountLinks.requestPasswordReset(email),
      inspectAccountLink: (token) => accountLinks.inspect(token),
      completeAccountLink: (request) => accountLinks.complete(request),
      signOut: () => respond(undefined),
    },
    config: {
      getPublicConfig: () => respond(config),
    },
    dashboard: {
      async getDashboard() {
        const weekAgo = clock.now().getTime() - options.recentWindowDays * DAY_MS;
        const applied = new Set(state.applications.map((a) => a.opportunity.id));
        const favorites = new Set(state.settings.favoriteCompanies.map((c) => c.toLowerCase()));
        const tracks = orderTracks(state.settings.tracks)
          .map((track) => ({
            track,
            opportunities: (state.trackOpportunities[track.id] ?? [])
              .map(findOpportunity)
              .filter((o) => o.decision !== OpportunityDecision.Dismissed && !applied.has(o.id))
              .sort((a, b) => Number(favorites.has(b.organization.toLowerCase())) - Number(favorites.has(a.organization.toLowerCase())) || b.matchScore - a.matchScore)
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
          upcoming: followUps.upcoming(),
          homeCountry: state.profile.countryCode || HOME_COUNTRY,
          favoriteCompanies: state.settings.favoriteCompanies,
        });
      },
    },
    opportunities: {
      getOpportunity: async (id) => respond(findOpportunity(id)),
      async decide(id, decision) {
        findOpportunity(id).decision = decision;
        return respond(undefined);
      },
      async addByLink(url) {
        const address = secureAddress(url);
        if (!isHttpsAddress(address)) {
          return failWith(ApiErrorCode.Validation, ApiErrorDetail.JobUrl);
        }
        const found = state.opportunities.find((o) => sameAddress(o.source.url, address));
        if (!found) {
          return failWith(ApiErrorCode.Validation, ApiErrorDetail.JobNotFound);
        }
        found.decision = OpportunityDecision.Saved;
        return respond(found);
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
      async updateAnswer(approvalId, answerId, answer, saveForReuse = false) {
        const approval = findApproval(approvalId);
        const item = approval.materials.answers.find((a) => a.id === answerId) ?? notFound();
        item.answer = answer;
        item.source = AnswerSource.User;
        if (saveForReuse) {
          answers.saveFromApproval(item.question, answer);
        }
        return respond(approval);
      },
      async approve(id) {
        const approval = findApproval(id);
        if (approval.state !== ApprovalState.Pending) {
          return fail(ApiErrorCode.Conflict);
        }
        if (hasBlankAnswers(approval.materials.answers)) {
          return failWith(ApiErrorCode.Validation, 'unanswered_questions');
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
            .map(({ route, timeline, questions, emails, files, evidence, circular, tasks, ...summary }) => summary),
        ),
      getApplication: async (id) => respond(state.applications.find((a) => a.id === id) ?? notFound()),
      updateOutcome: followUps.updateOutcome,
      addTask: followUps.addTask,
      editTask: followUps.editTask,
      setTaskStatus: followUps.setTaskStatus,
    },
    answers: answers.api,
    sources: jobSources,
    profile: createProfileStore({ profile: state.profile, config, clock, ids, respond, reject: failWith, verificationCode: options.demoVerificationCode }),
    settings: {
      getSettings: async () => respond({ ...state.settings, tracks: orderTracks(state.settings.tracks), homeCountry: state.profile.countryCode || HOME_COUNTRY }),
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
      async updateFavoriteCompanies(companies) {
        const names = companies.map((c) => c.trim()).filter(Boolean);
        state.settings.favoriteCompanies = names.filter((name, index) => names.findIndex((other) => other.toLowerCase() === name.toLowerCase()) === index);
        return respond(state.settings);
      },
      async updateExcludedCountries(countries) {
        const codes = [...new Set(countries.map((code) => code.trim().toUpperCase()).filter(Boolean))].sort();
        if (codes.some((code) => !COUNTRY_CODE.test(code))) {
          return failWith(ApiErrorCode.Validation, ApiErrorDetail.CountryCode);
        }
        state.settings.excludedCountries = codes;
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
      async updateNotifications(changes) {
        if (changes.digestTime !== undefined && !TIME_OF_DAY.test(changes.digestTime)) {
          return failWith(ApiErrorCode.Validation, 'time');
        }
        state.settings.notifications = { ...state.settings.notifications, ...changes };
        return respond(state.settings);
      },
      requestAccountDeletion: async () => respond({ scheduledFor: addDays(config.accountDeletionGraceDays) }),
    },
  };
}
