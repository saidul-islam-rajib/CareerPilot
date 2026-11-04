import {
  CircularPhase,
  CircularStatus,
  Eligibility,
  EvidenceSource,
  FeeStatus,
  FeeUrgency,
  GovApplicationStatus,
  GovStage,
  GuideActor,
  GuideStepKind,
  StageStatus,
  type SecretKind,
} from '@careerpilot/domain-ui-logic';
import { ApiErrorCode, ApiErrorDetail } from '../errors';
import type { Clock, IdGenerator } from '../ports';
import type { UploadSource } from '../types';
import type { GovernmentAdminApi, GovernmentApi } from './ports';
import {
  emptyCircularContent,
  type ApplicantCopy,
  type Circular,
  type CircularContent,
  type CircularFilters,
  type CircularSummary,
  type CircularView,
  type FeeChange,
  type GovApplication,
  type GovHoliday,
  type GovPost,
  type GovReference,
  type GuideStep,
  type PostEligibility,
  type SecretValues,
  type StageInput,
} from './types';

const FIRST_VERSION = 1;
const MEMORY_FILE = 'memory://file';
const CURRENCY = 'BDT';
const SUBMITTED_STATES: GovApplicationStatus[] = [GovApplicationStatus.Submitted, GovApplicationStatus.Confirmed];
const GUIDE_STEPS: { kind: GuideStepKind; actor: GuideActor }[] = [
  { kind: GuideStepKind.CheckEligibility, actor: GuideActor.System },
  { kind: GuideStepKind.PreparePhotoSignature, actor: GuideActor.User },
];

export interface GovernmentStore {
  circulars: Circular[];
  holidays: GovHoliday[];
  applications: GovApplication[];
  secrets: Record<string, SecretValues>;
}

export function createGovernmentStore(): GovernmentStore {
  return { circulars: [], holidays: [], applications: [], secrets: {} };
}

export interface InMemoryGovernmentOptions {
  clock: Clock;
  ids: IdGenerator;
  respond: <T>(value: T) => Promise<T>;
  fail: (code: ApiErrorCode, detail?: string) => Promise<never>;
  store?: GovernmentStore;
  reference?: GovReference;
}

export const EMPTY_REFERENCE: GovReference = {
  currency: CURRENCY,
  timeZone: 'Asia/Dhaka',
  grades: [],
  holidays: [],
  recurringHolidays: [],
  weekendDays: [],
  officeStart: '',
  officeEnd: '',
  relaxationSuggestions: [],
  defaultMaxAge: 0,
  copyTypes: [],
  copyMaxBytes: 0,
};

function copyOf<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export interface InMemoryGovernmentUser extends GovernmentApi {
  seedPublished(content: CircularContent): Promise<Circular>;
}

export function createInMemoryGovernment(options: InMemoryGovernmentOptions): { user: InMemoryGovernmentUser; admin: GovernmentAdminApi } {
  const { clock, ids, respond, fail } = options;
  const store = options.store ?? createGovernmentStore();
  const reference = (): GovReference => ({ ...(options.reference ?? EMPTY_REFERENCE), holidays: copyOf(store.holidays) });
  const today = () => clock.now().toISOString().slice(0, 10);
  const circularOf = (id: string): Circular => store.circulars.find((c) => c.id === id) ?? unknownCircular();
  const unknownCircular = (): never => {
    throw new Error(ApiErrorCode.NotFound);
  };
  const find = async <T>(items: T[], match: (item: T) => boolean): Promise<T> => items.find(match) ?? fail(ApiErrorCode.NotFound);
  const applicationOf = (id: string) => find(store.applications, (a) => a.id === id);
  const phaseOf = (c: Circular): CircularPhase => {
    if (c.opensOn && c.opensOn > today()) {
      return CircularPhase.Upcoming;
    }
    return c.closesOn && c.closesOn < today() ? CircularPhase.Closed : CircularPhase.Open;
  };
  const eligibilityOf = (post: GovPost): PostEligibility => ({ postId: post.id, overall: Eligibility.Unknown, criteria: [], quotas: [] });
  const matchesFilters = (post: GovPost, filters: CircularFilters) =>
    (!filters.grades?.length || (post.grade !== undefined && filters.grades.includes(post.grade))) &&
    (filters.gradeMin === undefined || (post.grade !== undefined && post.grade >= filters.gradeMin)) &&
    (filters.gradeMax === undefined || (post.grade !== undefined && post.grade <= filters.gradeMax)) &&
    (!filters.location || post.location.toLowerCase().includes(filters.location.toLowerCase()));

  const summaries = (filters: CircularFilters = {}): CircularSummary[] =>
    store.circulars
      .filter((c) => c.status === CircularStatus.Published)
      .filter((c) => !filters.phase || phaseOf(c) === filters.phase)
      .filter((c) => !filters.authority || c.authority.toLowerCase().includes(filters.authority.toLowerCase()))
      .map((c) => ({ circular: c, posts: c.posts.filter((p) => matchesFilters(p, filters)) }))
      .filter(({ posts }) => posts.length > 0)
      .map(({ circular, posts }) => ({
        id: circular.id,
        title: circular.title,
        authority: circular.authority,
        closesOn: circular.closesOn,
        phase: phaseOf(circular),
        amended: circular.versions.length > 1,
        vacancies: posts.reduce((sum, p) => sum + (p.vacancies ?? 0), 0),
        posts: posts.map((p) => ({
          id: p.id,
          title: p.title,
          grade: p.grade,
          payMin: p.payMin,
          payMax: p.payMax,
          vacancies: p.vacancies,
          location: p.location,
          eligibility: Eligibility.Unknown,
        })),
      }));

  const view = (id: string): CircularView => {
    const circular = circularOf(id);
    return {
      circular,
      phase: phaseOf(circular),
      amended: circular.versions.length > 1,
      grades: [...new Set(circular.posts.flatMap((p) => (p.grade === undefined ? [] : [p.grade])))].sort((a, b) => a - b),
      posts: circular.posts.map(eligibilityOf),
    };
  };

  const urgencyOf = (app: GovApplication): FeeUrgency => {
    const open = app.fee.status === FeeStatus.Due || app.fee.status === FeeStatus.Unconfirmed;
    if (!open || !app.fee.paymentDeadline) {
      return FeeUrgency.None;
    }
    return app.fee.paymentDeadline < clock.now().toISOString() ? FeeUrgency.Overdue : FeeUrgency.Ok;
  };

  const save = (app: GovApplication): GovApplication => {
    const fresh = { ...app, feeUrgency: urgencyOf(app) };
    store.applications = store.applications.map((a) => (a.id === app.id ? fresh : a));
    return fresh;
  };

  const base: GovernmentApi = {
    reference: () => respond(reference()),
    listCirculars: (filters) => respond(summaries(filters)),
    async getCircular(id) {
      await find(
        store.circulars.filter((c) => c.status === CircularStatus.Published),
        (c) => c.id === id,
      );
      return respond(view(id));
    },
    async getCircularVersion(id, version) {
      const circular = await find(store.circulars, (c) => c.id === id);
      return respond(await find(circular.versions, (v) => v.version === version));
    },
    listApplications: () => respond(store.applications),
    async getApplication(id) {
      return respond(await applicationOf(id));
    },
    async startApplication(circularId, postIds) {
      const circular = await find(store.circulars, (c) => c.id === circularId && c.status === CircularStatus.Published);
      if (!postIds.length || postIds.some((id) => !circular.posts.some((p) => p.id === id))) {
        return fail(ApiErrorCode.Validation);
      }
      if (store.applications.some((a) => a.circularId === circularId)) {
        return fail(ApiErrorCode.Conflict);
      }
      const amount = circular.fee?.amount;
      const app: GovApplication = {
        id: ids.next('gap'),
        circularId,
        circularTitle: circular.title,
        authority: circular.authority,
        circularVersion: circular.version,
        postIds,
        postTitles: circular.posts.filter((p) => postIds.includes(p.id)).map((p) => p.title),
        status: GovApplicationStatus.Preparing,
        fee: { amount, currency: CURRENCY, status: amount ? FeeStatus.Due : FeeStatus.NotRequired, method: circular.fee?.method, evidenceNote: '' },
        feeUrgency: FeeUrgency.None,
        stages: circular.closesOn
          ? [
              {
                id: ids.next('stg'),
                stage: GovStage.Application,
                status: StageStatus.Scheduled,
                on: circular.closesOn,
                venue: '',
                note: '',
                noticeUrl: circular.noticeUrl,
                source: EvidenceSource.OfficialNotice,
              },
            ]
          : [],
        copies: [],
        secretsPresent: [],
        closesOn: circular.closesOn,
        applyUrl: circular.applyUrl,
      };
      store.applications = [...store.applications, app];
      return respond(app);
    },
    async withdrawApplication(id) {
      await applicationOf(id);
      store.applications = store.applications.filter((a) => a.id !== id);
      return respond(undefined);
    },
    async markSubmitted(id) {
      const app = await applicationOf(id);
      if (app.status !== GovApplicationStatus.Preparing) {
        return fail(ApiErrorCode.Conflict);
      }
      const window = circularOf(app.circularId).fee?.windowHours;
      const deadline = window ? new Date(clock.now().getTime() + window * 3_600_000).toISOString() : undefined;
      const fee = app.fee.status === FeeStatus.Due && deadline ? { ...app.fee, paymentDeadline: deadline } : app.fee;
      return respond(save({ ...app, status: GovApplicationStatus.Submitted, submittedAt: clock.now().toISOString(), fee }));
    },
    async confirmApplication(id) {
      const app = await applicationOf(id);
      if (app.status !== GovApplicationStatus.Submitted) {
        return fail(ApiErrorCode.Conflict);
      }
      if (!app.copies.length && !app.secretsPresent.includes('application_id' as SecretKind)) {
        return failWithEvidence();
      }
      return respond(save({ ...app, status: GovApplicationStatus.Confirmed }));
    },
    async updateFee(id, change: FeeChange) {
      const app = await applicationOf(id);
      const note = change.evidenceNote?.trim() ?? app.fee.evidenceNote;
      const hasReference = change.transactionId?.trim() || app.secretsPresent.includes('transaction_id' as SecretKind);
      if (change.status === FeeStatus.Paid && !note && !hasReference) {
        return failWithEvidence();
      }
      const paid = change.status === FeeStatus.Paid;
      const fee = {
        ...app.fee,
        status: change.status ?? app.fee.status,
        method: change.method ?? app.fee.method,
        paymentDeadline: change.paymentDeadline ?? app.fee.paymentDeadline,
        evidenceNote: note,
        confirmedAt: paid ? clock.now().toISOString() : change.status ? undefined : app.fee.confirmedAt,
      };
      const secretsPresent = change.transactionId?.trim() && !hasReferenceOf(app) ? [...app.secretsPresent, 'transaction_id' as SecretKind] : app.secretsPresent;
      return respond(save({ ...app, fee, secretsPresent }));
    },
    async addStage(id, stage) {
      const app = await applicationOf(id);
      return respond(save({ ...app, stages: [...app.stages, stageRecord(ids.next('stg'), stage)] }));
    },
    async updateStage(id, stageId, stage) {
      const app = await applicationOf(id);
      await find(app.stages, (s) => s.id === stageId);
      return respond(save({ ...app, stages: app.stages.map((s) => (s.id === stageId ? stageRecord(stageId, stage) : s)) }));
    },
    async removeStage(id, stageId) {
      const app = await applicationOf(id);
      return respond(save({ ...app, stages: app.stages.filter((s) => s.id !== stageId) }));
    },
    async addCopy(id, file: UploadSource) {
      const app = await applicationOf(id);
      const copy: ApplicantCopy = {
        id: ids.next('cpy'),
        fileName: file.name,
        contentType: file.type,
        sizeBytes: file.size,
        uploadedAt: clock.now().toISOString(),
        url: MEMORY_FILE,
      };
      return respond(save({ ...app, copies: [...app.copies, copy] }));
    },
    async removeCopy(id, copyId) {
      const app = await applicationOf(id);
      return respond(save({ ...app, copies: app.copies.filter((c) => c.id !== copyId) }));
    },
    async setSecrets(id, values) {
      const app = await applicationOf(id);
      const merged = { ...store.secrets[id], ...values };
      for (const key of Object.keys(merged) as SecretKind[]) {
        if (!merged[key]?.trim()) {
          delete merged[key];
        }
      }
      store.secrets[id] = merged;
      return respond(save({ ...app, secretsPresent: Object.keys(merged).sort() as SecretKind[] }));
    },
    async revealSecrets(id) {
      await applicationOf(id);
      return respond(store.secrets[id] ?? {});
    },
    async guide(id) {
      const app = await applicationOf(id);
      const submitted = SUBMITTED_STATES.includes(app.status);
      const steps: GuideStep[] = GUIDE_STEPS.map((step) => ({ ...step, done: false, link: '' }));
      return respond([
        ...steps,
        { kind: GuideStepKind.OpenOfficialSite, actor: GuideActor.User, done: submitted, link: app.applyUrl },
        { kind: GuideStepKind.SubmitForm, actor: GuideActor.User, done: submitted, link: '' },
      ]);
    },
    upcoming: () => respond([]),
  };

  const hasReferenceOf = (app: GovApplication) => app.secretsPresent.includes('transaction_id' as SecretKind);
  const failWithEvidence = () => fail(ApiErrorCode.Validation, ApiErrorDetail.EvidenceRequired);

  const stageRecord = (id: string, input: StageInput) => ({
    id,
    stage: input.stage,
    status: input.status,
    on: input.on,
    time: input.time,
    venue: input.venue ?? '',
    note: input.note ?? '',
    noticeUrl: input.noticeUrl ?? '',
    source: input.source ?? EvidenceSource.UserEntry,
  });

  const circularFrom = (id: string, content: CircularContent, previous?: Circular): Circular => ({
    ...content,
    posts: content.posts.map((p) => ({ ...p, id: p.id || ids.next('post') })),
    id,
    status: previous?.status ?? CircularStatus.Draft,
    version: previous?.version ?? FIRST_VERSION,
    fingerprint: ids.next('fp'),
    capturedAt: clock.now().toISOString(),
    liveRemoved: previous?.liveRemoved ?? false,
    versions: previous?.versions ?? [],
  });
  const replaceCircular = (next: Circular): Circular => {
    store.circulars = store.circulars.map((c) => (c.id === next.id ? next : c));
    return next;
  };

  const admin: GovernmentAdminApi = {
    reference: () => respond(reference()),
    listCirculars: () => respond(store.circulars),
    async getCircular(id) {
      return respond(await find(store.circulars, (c) => c.id === id));
    },
    async createCircular(content) {
      const created = circularFrom(ids.next('circ'), content);
      store.circulars = [...store.circulars, created];
      return respond(created);
    },
    async updateCircular(id, content) {
      const previous = await find(store.circulars, (c) => c.id === id);
      const next = circularFrom(id, content, previous);
      if (previous.status === CircularStatus.Published) {
        next.version = previous.version + 1;
        next.versions = [...previous.versions, { version: next.version, fingerprint: next.fingerprint, capturedAt: next.capturedAt, changed: [], snapshot: content }];
      }
      return respond(replaceCircular(next));
    },
    async publishCircular(id) {
      const previous = await find(store.circulars, (c) => c.id === id);
      if (!previous.posts.length) {
        return fail(ApiErrorCode.Validation);
      }
      const versions = previous.versions.length
        ? previous.versions
        : [{ version: previous.version, fingerprint: previous.fingerprint, capturedAt: previous.capturedAt, changed: [], snapshot: previous }];
      return respond(replaceCircular({ ...previous, status: CircularStatus.Published, versions }));
    },
    async withdrawCircular(id) {
      const previous = await find(store.circulars, (c) => c.id === id);
      return respond(replaceCircular({ ...previous, status: CircularStatus.Withdrawn }));
    },
    async setLiveRemoved(id, removed) {
      const previous = await find(store.circulars, (c) => c.id === id);
      return respond(replaceCircular({ ...previous, liveRemoved: removed }));
    },
    async addNotice(id, notice) {
      const previous = await find(store.circulars, (c) => c.id === id);
      return respond(replaceCircular({ ...previous, notices: [...previous.notices, { ...notice, id: ids.next('ntc') }] }));
    },
    async removeCircular(id) {
      await find(store.circulars, (c) => c.id === id);
      store.circulars = store.circulars.filter((c) => c.id !== id);
      return respond(undefined);
    },
    async importFromLink(url) {
      const host = new URL(url).hostname;
      return respond({ content: { ...emptyCircularContent(), title: host, authority: host, sourceUrl: url, noticeUrl: url, applyUrl: url }, needsReview: true });
    },
    listHolidays: () => respond(store.holidays),
    async addHoliday(on, name) {
      if (!name.trim()) {
        return fail(ApiErrorCode.Validation);
      }
      const holiday = { id: ids.next('hol'), on, name: name.trim() };
      store.holidays = [...store.holidays, holiday].sort((a, b) => a.on.localeCompare(b.on));
      return respond(holiday);
    },
    async removeHoliday(id) {
      await find(store.holidays, (h) => h.id === id);
      store.holidays = store.holidays.filter((h) => h.id !== id);
      return respond(undefined);
    },
  };

  const user: InMemoryGovernmentUser = {
    ...base,
    async seedPublished(content) {
      const created = await admin.createCircular(content);
      return admin.publishCircular(created.id);
    },
  };
  return { user, admin };
}
