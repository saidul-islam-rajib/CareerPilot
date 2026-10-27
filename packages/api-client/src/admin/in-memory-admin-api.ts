import {
  ActorType,
  OpportunityStatus,
  OutcomeStatus,
  SourceStatus,
  SubmissionStatus,
  UserAccountStatus,
} from '@careerpilot/domain-ui-logic';
import { ApiError, ApiErrorCode, ApiErrorDetail } from '../errors';
import type { Clock, IdGenerator } from '../ports';
import type { DemoState } from '../in-memory/demo.seed';
import type { CareerPilotAdminApi } from './admin-ports';
import type { AdminDemoAccount, AdminDemoState } from './admin-demo.seed';
import { SourceConnector, type AdminSourceRow, type AdminSummary, type AdminUserDetail, type CountByKey, type NewSource, type Page, type PageQuery } from './admin-types';
import { permissionsForRole } from './permissions';

export interface InMemoryAdminApiOptions {
  state: AdminDemoState;
  userState: DemoState;
  clock: Clock;
  ids: IdGenerator;
  latencyMs: number;
  recentWindowDays: number;
  chartDays: number;
  completeProfilePercent: number;
  linkTtlBounds: { min: number; max: number };
  linkToken: string;
  suggestedSources?: NewSource[];
}

const DAY_MS = 86_400_000;
const SOURCE_CONNECTORS: readonly string[] = Object.values(SourceConnector);
const HTTPS_PROTOCOL = 'https:';

function isHttpsAddress(address: string): boolean {
  try {
    const url = new URL(address.trim());
    return url.protocol === HTTPS_PROTOCOL && url.hostname.length > 0 && !url.username && !url.password;
  } catch {
    return false;
  }
}
const ISO_DATE_LENGTH = 10;

function clone<T>(value: T): T {
  return value === undefined ? value : (JSON.parse(JSON.stringify(value)) as T);
}

function countBy<T>(items: readonly T[], key: (item: T) => string): CountByKey[] {
  const counts = new Map<string, number>();
  for (const item of items) {
    counts.set(key(item), (counts.get(key(item)) ?? 0) + 1);
  }
  return [...counts.entries()].map(([k, count]) => ({ key: k, count })).sort((a, b) => b.count - a.count);
}

export function paginate<T>(items: readonly T[], query: PageQuery, searchable: (item: T) => string, status?: (item: T) => string): Page<T> {
  const search = query.search?.trim().toLowerCase() ?? '';
  const filtered = items.filter(
    (item) => (!search || searchable(item).toLowerCase().includes(search)) && (!query.status || !status || status(item) === query.status),
  );
  const start = (query.page - 1) * query.pageSize;
  return { items: filtered.slice(start, start + query.pageSize), total: filtered.length, page: query.page, pageSize: query.pageSize };
}

export function createInMemoryAdminApi(options: InMemoryAdminApiOptions): CareerPilotAdminApi {
  const state = clone(options.state);
  const userState = options.userState;
  const { clock, ids } = options;
  let currentAdmin: AdminSummary | undefined;

  const respond = <T>(value: T): Promise<T> => new Promise((resolve) => setTimeout(() => resolve(clone(value)), options.latencyMs));
  const fail = (code: ApiErrorCode, detail?: string): Promise<never> =>
    new Promise((_, reject) => setTimeout(() => reject(new ApiError(code, undefined, detail)), options.latencyMs));
  const nowIso = () => clock.now().toISOString();

  const record = (action: string, target: string) => {
    state.audit.unshift({
      id: ids.next('aud'),
      at: nowIso(),
      actorName: currentAdmin?.fullName ?? '',
      actorType: ActorType.Admin,
      action,
      target,
    });
  };

  let linkedAdminId: string | undefined;
  const findAdmin = (email: string) => state.admins.find((a) => a.account.email.toLowerCase() === email.trim().toLowerCase());
  const linkedAdmin = (token: string) => (token === options.linkToken ? state.admins.find((a) => a.account.id === linkedAdminId) : undefined);
  const startSession = (match: AdminDemoAccount) => {
    currentAdmin = { id: match.account.id, fullName: match.account.fullName, email: match.account.email, role: match.account.role };
    match.account.lastSignInAt = nowIso();
    record('admin.signed_in', match.account.email);
    return respond({ accessToken: ids.next('admin_token'), admin: currentAdmin, permissions: permissionsForRole(match.account.role) });
  };
  const sourceAdded = (address: string) => state.sources.some((s) => s.setup?.url.trim().toLowerCase() === address.trim().toLowerCase());
  const findUser = (id: string) => state.users.find((u) => u.id === id);
  const userDetail = (id: string): AdminUserDetail | undefined => {
    const user = findUser(id);
    if (!user) {
      return undefined;
    }
    return {
      ...user,
      phone: state.userPhones[id],
      tracks: id === 'usr_demo' ? userState.settings.tracks : [],
      recentApplications: state.applications.filter((a) => a.userName === user.fullName).slice(0, 5),
      signIns: id === 'usr_demo' ? userState.signInEvents : [],
      secrets: state.secrets[id] ?? [],
    };
  };

  const updateUser = (id: string, status: UserAccountStatus, action: string): Promise<AdminUserDetail> => {
    const user = findUser(id);
    if (!user) {
      return fail(ApiErrorCode.NotFound);
    }
    user.status = status;
    record(action, user.fullName);
    const detail = userDetail(id);
    return detail ? respond(detail) : fail(ApiErrorCode.NotFound);
  };

  return {
    auth: {
      async signIn(request) {
        const match = findAdmin(request.email);
        if (!match || match.account.suspended || match.password !== request.password) {
          return fail(ApiErrorCode.InvalidCredentials);
        }
        return startSession(match);
      },
      async signOut() {
        currentAdmin = undefined;
        return respond(undefined);
      },
      async requestPasswordLink(request) {
        const match = findAdmin(request.email);
        linkedAdminId = match && !match.account.suspended ? match.account.id : linkedAdminId;
        return respond(undefined);
      },
      async inspectAccountLink(token) {
        const match = linkedAdmin(token);
        return match ? respond({ fullName: match.account.fullName, email: match.account.email }) : fail(ApiErrorCode.Validation, ApiErrorDetail.LinkInvalid);
      },
      async completeAccountLink(request) {
        const match = linkedAdmin(request.token);
        if (!match) {
          return fail(ApiErrorCode.Validation, ApiErrorDetail.LinkInvalid);
        }
        match.password = request.password;
        linkedAdminId = undefined;
        return startSession(match);
      },
    },
    dashboard: {
      async getDashboard() {
        const weekAgo = clock.now().getTime() - options.recentWindowDays * DAY_MS;
        const users = state.users;
        const apps = state.applications;
        const opportunities = state.opportunities;
        const perDay = Array.from({ length: options.chartDays }, (_, i) => {
          const day = new Date(clock.now().getTime() - (options.chartDays - 1 - i) * DAY_MS).toISOString().slice(0, ISO_DATE_LENGTH);
          return { date: day, count: apps.filter((a) => a.updatedAt.slice(0, ISO_DATE_LENGTH) === day).length };
        });
        return respond({
          generatedAt: nowIso(),
          users: {
            total: users.length,
            newThisWeek: users.filter((u) => new Date(u.createdAt).getTime() >= weekAgo).length,
            active: users.filter((u) => u.status === UserAccountStatus.Active).length,
            paused: users.filter((u) => u.status === UserAccountStatus.Paused).length,
            suspended: users.filter((u) => u.status === UserAccountStatus.Suspended).length,
            pendingDeletion: users.filter((u) => u.status === UserAccountStatus.PendingDeletion).length,
            automaticEnabled: users.filter((u) => u.automaticEnabled).length,
            incompleteProfiles: users.filter((u) => u.profileCompleteness < options.completeProfilePercent).length,
          },
          applications: {
            total: apps.length,
            bySubmissionStatus: countBy(apps, (a) => a.submissionStatus),
            byOutcomeStatus: countBy(apps, (a) => a.outcomeStatus),
            byMode: countBy(apps, (a) => a.mode),
            approvalsWaiting: apps.filter((a) => a.submissionStatus === SubmissionStatus.AwaitingApproval).length,
            failures: apps.filter((a) => a.submissionStatus === SubmissionStatus.Failed).length,
            outcomeUnknown: apps.filter((a) => a.submissionStatus === SubmissionStatus.OutcomeUnknown).length,
            perDay,
          },
          opportunities: {
            discovered: opportunities.length,
            active: opportunities.filter((o) => o.status === OpportunityStatus.Active).length,
            expired: opportunities.filter((o) => o.status === OpportunityStatus.Expired).length,
            flagged: opportunities.filter((o) => o.status === OpportunityStatus.Flagged).length,
            archivedCirculars: state.archivedCirculars,
          },
          sources: {
            total: state.sources.length,
            healthy: state.sources.filter((s) => s.status === SourceStatus.Healthy).length,
            degraded: state.sources.filter((s) => s.status === SourceStatus.Degraded).length,
            failing: state.sources.filter((s) => s.status === SourceStatus.Failing).length,
            disabled: state.sources.filter((s) => s.status === SourceStatus.Disabled).length,
          },
          notifications: state.notifications,
          health: state.services,
          emergencyStop: state.settings.emergencyStop,
        });
      },
    },
    users: {
      listUsers: async (query) => respond(paginate(state.users, query, (u) => `${u.fullName} ${u.email} ${u.country}`, (u) => u.status)),
      async getUser(id) {
        const detail = userDetail(id);
        if (!detail) {
          return fail(ApiErrorCode.NotFound);
        }
        record('user.viewed_sensitive', detail.fullName);
        return respond(detail);
      },
      suspendUser: (id) => updateUser(id, UserAccountStatus.Suspended, 'user.suspended'),
      reactivateUser: (id) => updateUser(id, UserAccountStatus.Active, 'user.reactivated'),
      pauseAutomation: (id) => updateUser(id, UserAccountStatus.Paused, 'user.automation_paused'),
    },
    opportunities: {
      listOpportunities: async (query) => respond(paginate(state.opportunities, query, (o) => `${o.title} ${o.organization} ${o.countryCode}`, (o) => o.status)),
      async flagOpportunity(id) {
        const item = state.opportunities.find((o) => o.id === id);
        if (!item) {
          return fail(ApiErrorCode.NotFound);
        }
        item.status = OpportunityStatus.Flagged;
        record('opportunity.flagged', item.title);
        return respond(item);
      },
      async markExpired(id) {
        const item = state.opportunities.find((o) => o.id === id);
        if (!item) {
          return fail(ApiErrorCode.NotFound);
        }
        item.status = OpportunityStatus.Expired;
        record('opportunity.expired', item.title);
        return respond(item);
      },
    },
    sources: {
      listSources: async (query) => respond(paginate(state.sources, query, (s) => s.name, (s) => s.status)),
      suggestedSources: async () => respond((options.suggestedSources ?? []).filter((s) => !sourceAdded(s.url))),
      async addSource(source) {
        if (!SOURCE_CONNECTORS.includes(source.connector)) {
          return fail(ApiErrorCode.Validation, ApiErrorDetail.SourceConnector);
        }
        if (!isHttpsAddress(source.url)) {
          return fail(ApiErrorCode.Validation, ApiErrorDetail.SourceUrl);
        }
        if (sourceAdded(source.url)) {
          return fail(ApiErrorCode.Conflict, ApiErrorDetail.SourceExists);
        }
        const row: AdminSourceRow = {
          id: ids.next('src'),
          name: source.name.trim(),
          status: SourceStatus.Healthy,
          enabled: true,
          lastSuccessAt: nowIso(),
          failuresLast24h: 0,
          opportunitiesFound: 0,
          setup: { connector: source.connector, url: source.url.trim(), defaults: source.defaults },
        };
        state.sources.unshift(row);
        record('source.added', row.name);
        return respond(row);
      },
      async setSourceEnabled(id, enabled) {
        const source = state.sources.find((s) => s.id === id);
        if (!source) {
          return fail(ApiErrorCode.NotFound);
        }
        source.enabled = enabled;
        source.status = enabled ? SourceStatus.Healthy : SourceStatus.Disabled;
        record(enabled ? 'source.enabled' : 'source.disabled', source.name);
        return respond(source);
      },
      async runSourceCheck(id) {
        const source = state.sources.find((s) => s.id === id);
        if (!source) {
          return fail(ApiErrorCode.NotFound);
        }
        if (!source.enabled) {
          return fail(ApiErrorCode.Conflict);
        }
        source.lastSuccessAt = nowIso();
        source.failuresLast24h = 0;
        source.status = SourceStatus.Healthy;
        record('source.checked', source.name);
        return respond(source);
      },
    },
    applications: {
      listApplications: async (query) =>
        respond(paginate([...state.applications].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)), query, (a) => `${a.userName} ${a.opportunityTitle} ${a.organization}`, (a) => a.submissionStatus)),
      async cancelQueued(id) {
        const app = state.applications.find((a) => a.id === id);
        if (!app) {
          return fail(ApiErrorCode.NotFound);
        }
        if (app.submissionStatus !== SubmissionStatus.ApprovedQueued && app.submissionStatus !== SubmissionStatus.AwaitingApproval) {
          return fail(ApiErrorCode.Conflict);
        }
        app.submissionStatus = SubmissionStatus.Cancelled;
        app.outcomeStatus = OutcomeStatus.NoResponseYet;
        app.updatedAt = nowIso();
        record('application.cancelled', `${app.opportunityTitle} · ${app.userName}`);
        return respond(app);
      },
    },
    settings: {
      getSettings: async () => respond(state.settings),
      async updateSettings(update) {
        const ttl = update.accountLinkTtlMinutes;
        if (ttl !== undefined && !(Number.isInteger(ttl) && ttl >= options.linkTtlBounds.min && ttl <= options.linkTtlBounds.max)) {
          return fail(ApiErrorCode.Validation);
        }
        const changed = Object.keys(update).filter((k) => update[k as keyof typeof update] !== undefined);
        Object.assign(state.settings, Object.fromEntries(Object.entries(update).filter(([, v]) => v !== undefined)));
        record('settings.updated', changed.join(', '));
        return respond(state.settings);
      },
      async startEmergencyStop(request) {
        state.settings.emergencyStop = { active: true, scope: request.scope, target: request.target, reason: request.reason, since: nowIso() };
        record('emergency_stop.started', request.reason);
        return respond(state.settings);
      },
      async endEmergencyStop() {
        state.settings.emergencyStop = { active: false };
        record('emergency_stop.ended', '');
        return respond(state.settings);
      },
    },
    audit: {
      listAudit: async (query) => respond(paginate(state.audit, query, (e) => `${e.actorName} ${e.action} ${e.target}`, (e) => e.actorType)),
    },
    admins: {
      listAdmins: async () => respond(state.admins.map((a) => a.account)),
      async setRole(id, role) {
        const admin = state.admins.find((a) => a.account.id === id);
        if (!admin) {
          return fail(ApiErrorCode.NotFound);
        }
        admin.account.role = role;
        record('admin.role_changed', `${admin.account.email} → ${role}`);
        return respond(admin.account);
      },
      async setSuspended(id, suspended) {
        const admin = state.admins.find((a) => a.account.id === id);
        if (!admin) {
          return fail(ApiErrorCode.NotFound);
        }
        if (admin.account.id === currentAdmin?.id) {
          return fail(ApiErrorCode.Conflict);
        }
        admin.account.suspended = suspended;
        record(suspended ? 'admin.suspended' : 'admin.reactivated', admin.account.email);
        return respond(admin.account);
      },
    },
  };
}

