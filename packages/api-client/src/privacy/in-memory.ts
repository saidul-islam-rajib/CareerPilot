import { ConsentKind, DeletionScope, DeletionStatus, ExportStatus, ExternalData, RetainedRecord } from '@careerpilot/domain-ui-logic';
import { ApiErrorCode } from '../errors';
import type { Clock, IdGenerator } from '../ports';
import type { PrivacyApi } from './ports';
import type { ActivityReport, ConsentEntry, ConsentOverview, ConsentRecord, DeletionPlan, DeletionView, ExportView } from './types';

const DAY_MS = 86_400_000;
const REQUIRED_KINDS: readonly ConsentKind[] = [ConsentKind.Terms, ConsentKind.Privacy];
const OPTIONAL_KINDS: readonly ConsentKind[] = [ConsentKind.Analytics, ConsentKind.PreciseLocation, ConsentKind.Marketing, ConsentKind.AiImprovement];
const RETENTION_DAYS = 365;
const TEST_DEVICE = 'Test';
const TEST_IP = '127.0.0.1';
const TEST_VERSION = '1.0';
const TEST_DOWNLOAD = 'https://files.example.test/export';
const TEST_REASON = 'Kept to protect accounts.';

export interface InMemoryPrivacyOptions {
  clock: Clock;
  ids: IdGenerator;
  respond: <T>(value: T) => Promise<T>;
  fail: (code: ApiErrorCode) => Promise<never>;
  graceDays: number;
  password: () => string;
}

export function createInMemoryPrivacy(options: InMemoryPrivacyOptions): PrivacyApi {
  const { clock, ids, respond, fail } = options;
  const exportsList: ExportView[] = [];
  const record = (kind: ConsentKind, granted: boolean): ConsentRecord => ({
    id: ids.next('cns'),
    kind,
    granted,
    version: TEST_VERSION,
    at: clock.now().toISOString(),
    ip: TEST_IP,
    device: TEST_DEVICE,
  });
  const history: ConsentRecord[] = REQUIRED_KINDS.map((kind) => record(kind, true));
  let scheduledFor: string | undefined;
  const plan = (): DeletionPlan => ({
    graceDays: options.graceDays,
    erased: Object.values(DeletionScope),
    retained: [{ record: RetainedRecord.AuditEvents, retentionDays: RETENTION_DAYS, reason: TEST_REASON }],
    external: Object.values(ExternalData),
  });
  const deletionView = (): DeletionView =>
    scheduledFor ? { status: DeletionStatus.Requested, requestedAt: clock.now().toISOString(), scheduledFor, plan: plan() } : { plan: plan() };
  const consentOverview = (): ConsentOverview => {
    const latest = (kind: ConsentKind) => [...history].reverse().find((r) => r.kind === kind);
    const current: ConsentEntry[] = [...REQUIRED_KINDS, ...OPTIONAL_KINDS].map((kind) => {
      const found = latest(kind);
      return { kind, required: REQUIRED_KINDS.includes(kind), granted: Boolean(found?.granted), version: found?.version, at: found?.at };
    });
    return { current, history: [...history].reverse() };
  };
  return {
    report: (period, date) => {
      const day = date ?? clock.now().toISOString().slice(0, 10);
      const report: ActivityReport = {
        period,
        startDate: day,
        endDate: day,
        timeZone: 'UTC',
        buckets: [],
        total: 0,
        responses: 0,
        byStatus: [],
        byTrack: [],
        byRoute: [],
        rows: [],
        upcoming: [],
      };
      return respond(report);
    },
    requestExport: (input) => {
      const view: ExportView = {
        id: ids.next('exp'),
        kind: input.kind,
        format: input.format,
        status: ExportStatus.Ready,
        requestedAt: clock.now().toISOString(),
        expiresAt: new Date(clock.now().getTime() + DAY_MS).toISOString(),
        fileName: `export.${input.format}`,
        downloadUrl: TEST_DOWNLOAD,
      };
      exportsList.unshift(view);
      return respond(view);
    },
    listExports: () => respond([...exportsList]),
    getExport: (id) => {
      const found = exportsList.find((item) => item.id === id);
      return found ? respond(found) : fail(ApiErrorCode.NotFound);
    },
    deletion: () => respond(deletionView()),
    requestDeletion: (password) => {
      if (password !== options.password()) {
        return fail(ApiErrorCode.InvalidCredentials);
      }
      scheduledFor = new Date(clock.now().getTime() + options.graceDays * DAY_MS).toISOString();
      return respond(deletionView());
    },
    cancelDeletion: () => {
      scheduledFor = undefined;
      return respond(deletionView());
    },
    consents: () => respond(consentOverview()),
    updateConsent: (kind, granted) => {
      if (!OPTIONAL_KINDS.includes(kind)) {
        return fail(ApiErrorCode.Validation);
      }
      history.push(record(kind, granted));
      return respond(consentOverview());
    },
  };
}
