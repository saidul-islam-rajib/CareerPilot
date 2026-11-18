import {
  AttemptState,
  HostPolicy,
  PortalAccountOrigin,
  PortalAccountStatus,
  PortalFailure,
  ReadinessState,
  StopReason,
  WallKind,
} from '@careerpilot/domain-ui-logic';
import { ApiErrorCode } from '../errors';
import type { Clock, IdGenerator } from '../ports';
import type { ApplicationRecord } from '../types';
import type { PortalAdminApi, PortalApi } from './ports';
import type { AttemptView, AutopilotState, PortalAccountView, PortalHostRecord, PortalSettings, ReadinessReport } from './types';

const SUMMARY_VERSION = 1;
const USER_ONLY_STEPS = ['captcha', 'mfa', 'identity', 'assessment', 'payment'];
const ROUTES = ['employer_portal'];

export interface InMemoryPortalApplications {
  submitted(id: string): Promise<ApplicationRecord>;
}

export interface InMemoryPortalOptions {
  clock: Clock;
  ids: IdGenerator;
  respond: <T>(value: T) => Promise<T>;
  fail: (code: ApiErrorCode, detail?: string) => Promise<never>;
  userId: () => string;
  applications: () => InMemoryPortalApplications;
}

export interface InMemoryPortal {
  user: PortalApi & { seedAttempt(view: AttemptView): void };
  admin: PortalAdminApi;
}

const emptySettings = (): PortalSettings => ({
  enabled: false,
  summaryVersion: 0,
  permissions: { allowAccountCreation: false, acceptTerms: false, acceptPrivacy: false, allowEmailVerification: false },
});

export function createInMemoryPortal(options: InMemoryPortalOptions): InMemoryPortal {
  const { clock, ids, respond, fail } = options;
  let settings = emptySettings();
  const accounts: PortalAccountView[] = [];
  const passwords = new Map<string, string>();
  const attempts = new Map<string, AttemptView>();
  const hosts = new Map<string, PortalHostRecord>();
  const reports: ReadinessReport[] = [];
  const nowIso = () => clock.now().toISOString();

  const state = (): AutopilotState => ({
    settings: structuredClone(settings),
    summary: {
      summaryVersion: SUMMARY_VERSION,
      userOnlySteps: USER_ONLY_STEPS,
      routes: ROUTES,
      ruleNames: [],
      documentNames: [],
      live: false,
      mailConnected: false,
    },
  });

  const hostOf = (url: string) => {
    try {
      return new URL(url).hostname.toLowerCase();
    } catch {
      return '';
    }
  };

  const user: InMemoryPortal['user'] = {
    autopilot: () => respond(state()),
    async enableAutopilot(input) {
      if (!input.acknowledged) {
        await fail(ApiErrorCode.Validation, PortalFailure.NotAcknowledged);
      }
      const { acknowledged: _acknowledged, ...permissions } = input;
      settings = { enabled: true, enabledAt: nowIso(), summaryVersion: SUMMARY_VERSION, permissions };
      return respond(state());
    },
    disableAutopilot() {
      settings = { ...settings, enabled: false };
      return respond(state());
    },
    listAccounts: () => respond(accounts.map((a) => ({ ...a }))),
    async addAccount(input) {
      const host = input.host.trim().toLowerCase();
      if (!host) {
        await fail(ApiErrorCode.Validation, PortalFailure.InvalidHost);
      }
      if (accounts.some((a) => a.host === host && a.email === input.email)) {
        await fail(ApiErrorCode.Conflict, PortalFailure.DuplicateAccount);
      }
      const view: PortalAccountView = {
        id: ids.next('pac'),
        host,
        employer: input.employer ?? '',
        email: input.email,
        status: PortalAccountStatus.Active,
        origin: PortalAccountOrigin.Imported,
        siteUrl: input.siteUrl ?? '',
        createdAt: nowIso(),
      };
      accounts.push(view);
      passwords.set(view.id, input.password);
      return respond({ ...view });
    },
    exportAccounts: () =>
      respond(accounts.map((a) => ({ id: a.id, host: a.host, email: a.email, password: passwords.get(a.id) ?? '' }))),
    async revealAccount(id) {
      const found = accounts.find((a) => a.id === id) ?? (await fail(ApiErrorCode.NotFound, PortalFailure.NotFound));
      return respond({ id, host: found.host, email: found.email, password: passwords.get(id) ?? '' });
    },
    async removeAccount(id) {
      if (!accounts.some((a) => a.id === id)) {
        await fail(ApiErrorCode.NotFound, PortalFailure.NotFound);
      }
      accounts.splice(
        accounts.findIndex((a) => a.id === id),
        1,
      );
      passwords.delete(id);
      await respond(true);
    },
    async attempt(applicationId) {
      const found = attempts.get(applicationId) ?? (await fail(ApiErrorCode.NotFound, PortalFailure.NotFound));
      return respond(structuredClone(found));
    },
    async resume(applicationId) {
      const found = attempts.get(applicationId) ?? (await fail(ApiErrorCode.NotFound, PortalFailure.NotFound));
      if (found.submitClicked) {
        await fail(ApiErrorCode.Validation, PortalFailure.AlreadySubmitted);
      }
      if (found.state === AttemptState.Confirmed) {
        await fail(ApiErrorCode.Validation, PortalFailure.NotResumable);
      }
      attempts.set(applicationId, { ...found, pending: [], runs: found.runs + 1, updatedAt: nowIso() });
      return options.applications().submitted(applicationId);
    },
    async complete(applicationId) {
      const record = await options.applications().submitted(applicationId);
      const found = attempts.get(applicationId);
      if (found) {
        attempts.set(applicationId, { ...found, submitClicked: true, updatedAt: nowIso() });
      }
      return record;
    },
    async fillPlan(applicationId) {
      const found = attempts.get(applicationId) ?? (await fail(ApiErrorCode.NotFound, PortalFailure.NotFound));
      const account = accounts.find((a) => a.host === found.host);
      const policy = hosts.get(found.host)?.policy ?? HostPolicy.Review;
      return respond({
        applicationId,
        officialUrl: found.officialUrl,
        host: found.host,
        hostPolicy: policy,
        assistAllowed: policy !== HostPolicy.Blocked,
        accountEmail: account?.email ?? '',
        hasPassword: !!account,
        facts: [],
        answers: [],
        coverLetter: '',
        coverLetterLabels: [],
        resumeLabels: [],
        confirmationPhrases: [],
        skipTerms: [],
        captchaSelectors: [],
        scanIntervalMs: 1500,
        excerptChars: 300,
      });
    },
    async fillPassword(applicationId) {
      const found = attempts.get(applicationId) ?? (await fail(ApiErrorCode.NotFound, PortalFailure.NotFound));
      const account = accounts.find((a) => a.host === found.host) ?? (await fail(ApiErrorCode.NotFound, PortalFailure.NotFound));
      return respond({ email: account.email, password: passwords.get(account.id) ?? '' });
    },
    async evidenceLink(applicationId) {
      const found = attempts.get(applicationId) ?? (await fail(ApiErrorCode.NotFound, PortalFailure.NotFound));
      if (!found.evidenceKey) {
        await fail(ApiErrorCode.NotFound, PortalFailure.NotFound);
      }
      return respond({ url: `memory://${found.evidenceKey}` });
    },
    requestReadiness: (url) => admin.requestReadiness(url),
    readinessReport: (reportId) => admin.readiness(options.userId(), reportId),
    seedAttempt(view) {
      attempts.set(view.applicationId, structuredClone(view));
    },
  };

  const admin: PortalAdminApi = {
    listHosts: () => respond([...hosts.values()].map((h) => ({ ...h }))),
    async decideHost(host, input) {
      const key = host.trim().toLowerCase();
      if (!key) {
        await fail(ApiErrorCode.Validation, PortalFailure.InvalidHost);
      }
      const record: PortalHostRecord = {
        host: key,
        policy: input.policy,
        note: input.note ?? '',
        configured: false,
        decidedAt: nowIso(),
      };
      hosts.set(key, record);
      return respond({ ...record });
    },
    async requestReadiness(url) {
      const host = hostOf(url);
      if (!host) {
        await fail(ApiErrorCode.Validation, PortalFailure.InvalidUrl);
      }
      const known = hosts.get(host) ?? { host, policy: HostPolicy.Review, note: '', configured: false };
      hosts.set(host, known);
      const policy = known.policy;
      const blocked = policy !== HostPolicy.Allowed;
      const report: ReadinessReport = {
        id: ids.next('prr'),
        url,
        host,
        state: ReadinessState.Done,
        requestedAt: nowIso(),
        requestedBy: options.userId(),
        finishedAt: nowIso(),
        hostPolicy: policy,
        wall: WallKind.None,
        captchaSeen: false,
        pageTitle: '',
        finalUrl: url,
        fields: [],
        mapped: 0,
        unknown: 0,
        reasons: blocked ? [policy === HostPolicy.Blocked ? StopReason.HostBlocked : StopReason.HostReview] : [],
        error: '',
      };
      reports.push(report);
      return respond(structuredClone(report));
    },
    async readiness(_userId, reportId) {
      const found = reports.find((r) => r.id === reportId) ?? (await fail(ApiErrorCode.NotFound, PortalFailure.NotFound));
      return respond(structuredClone(found));
    },
  };

  return { user, admin };
}
