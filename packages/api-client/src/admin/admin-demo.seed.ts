import {
  ActorType,
  AdminRole,
  ApplicationMode,
  ApplicationRoute,
  OpportunityStatus,
  OpportunityType,
  OutcomeStatus,
  ServiceHealth,
  SourceStatus,
  SubmissionStatus,
  UserAccountStatus,
  enumValues,
} from '@careerpilot/domain-ui-logic';
import { ThemeKey } from '@careerpilot/ui-tokens';
import type { DemoState } from '../in-memory/demo.seed';
import type {
  AdminAccount,
  AdminApplicationRow,
  AdminOpportunityRow,
  AdminSourceRow,
  AdminUserRow,
  AuditEntry,
  PlatformSettings,
  SecretMetadata,
} from './admin-types';

export interface AdminDemoAccount {
  account: AdminAccount;
  password: string;
}

export interface AdminDemoState {
  admins: AdminDemoAccount[];
  users: AdminUserRow[];
  userPhones: Record<string, string>;
  secrets: Record<string, SecretMetadata[]>;
  opportunities: AdminOpportunityRow[];
  sources: AdminSourceRow[];
  applications: AdminApplicationRow[];
  audit: AuditEntry[];
  settings: PlatformSettings;
  services: Array<{ service: string; status: ServiceHealth }>;
  notifications: { sent: number; delivered: number; failed: number };
  archivedCirculars: number;
}

const DAY_MS = 86_400_000;
const FIRST_NAMES = ['Ayesha', 'Tanvir', 'Nusrat', 'Rafiq', 'Farhana', 'Imran', 'Sadia', 'Arif', 'Mehnaz', 'Kamal', 'Priya', 'Omar', 'Lina', 'Hasan'];
const LAST_NAMES = ['Rahman', 'Hossain', 'Akter', 'Islam', 'Chowdhury', 'Karim', 'Begum', 'Uddin', 'Sultana', 'Ahmed', 'Das', 'Farooq', 'Noor', 'Mahmud'];
const COUNTRIES = ['BD', 'BD', 'BD', 'IN', 'BD', 'MY', 'BD', 'AE', 'BD', 'BD', 'NP', 'BD', 'BD', 'BD'];
const STATUS_CYCLE: UserAccountStatus[] = [
  UserAccountStatus.Active,
  UserAccountStatus.Active,
  UserAccountStatus.Active,
  UserAccountStatus.Paused,
  UserAccountStatus.Active,
  UserAccountStatus.Suspended,
  UserAccountStatus.Active,
  UserAccountStatus.PendingDeletion,
];
const COMPLETENESS = [86, 42, 95, 70, 100, 55, 88, 63];
const APPLICATIONS = [7, 2, 12, 0, 5, 1, 9, 3];

export function buildAdminDemoSeed(now: Date, userState: DemoState, accountLinkTtlMinutes: number): AdminDemoState {
  const at = (days: number) => new Date(now.getTime() + days * DAY_MS).toISOString();

  const users: AdminUserRow[] = FIRST_NAMES.map((first, i) => {
    const last = LAST_NAMES[i] ?? '';
    const pick = <T>(list: readonly T[]) => list[i % list.length] as T;
    return {
      id: i === 0 ? 'usr_demo' : `usr_${String(i + 1).padStart(3, '0')}`,
      fullName: `${first} ${last}`,
      email: i === 0 ? 'admin@sober.com' : `${first.toLowerCase()}.${last.toLowerCase()}@example.com`,
      status: pick(STATUS_CYCLE),
      country: COUNTRIES[i] ?? 'BD',
      createdAt: at(-(i * 9 + 3)),
      lastSignInAt: at(-(i % 5)),
      applicationsCount: pick(APPLICATIONS),
      automaticEnabled: i % 3 === 0,
      profileCompleteness: pick(COMPLETENESS),
    };
  });

  const opportunities: AdminOpportunityRow[] = userState.opportunities.map((o, i) => ({
    id: o.id,
    title: o.title,
    organization: o.organization,
    countryCode: o.countryCode,
    type: o.type,
    status: o.hasHardFailure ? OpportunityStatus.Active : i === 5 ? OpportunityStatus.Expired : OpportunityStatus.Active,
    discoveredAt: at(-(i + 1)),
    applicationsCount: userState.applications.filter((a) => a.opportunity.id === o.id).length,
  }));
  opportunities.push(
    { id: 'opp_flagged_fee', title: 'Data Entry (work from home, pay registration fee)', organization: 'Quick Jobs Agency', countryCode: 'BD', type: OpportunityType.Job, status: OpportunityStatus.Flagged, discoveredAt: at(-1), applicationsCount: 0 },
    { id: 'opp_duplicate', title: 'Senior Frontend Engineer', organization: 'Northwind Labs', countryCode: 'US', type: OpportunityType.Job, status: OpportunityStatus.Duplicate, discoveredAt: at(-2), applicationsCount: 0 },
  );

  const sources: AdminSourceRow[] = [
    { id: 'src_remote_board', name: 'Remote job board', status: SourceStatus.Healthy, enabled: true, lastSuccessAt: at(0), failuresLast24h: 0, opportunitiesFound: 412 },
    { id: 'src_bd_portal', name: 'Bangladesh job portal', status: SourceStatus.Healthy, enabled: true, lastSuccessAt: at(0), failuresLast24h: 1, opportunitiesFound: 1280 },
    { id: 'src_gov_notices', name: 'Government recruitment notices', status: SourceStatus.Degraded, enabled: true, lastSuccessAt: at(-1), failuresLast24h: 4, opportunitiesFound: 96 },
    { id: 'src_intl_board', name: 'International job board', status: SourceStatus.Healthy, enabled: true, lastSuccessAt: at(0), failuresLast24h: 0, opportunitiesFound: 640 },
    { id: 'src_university', name: 'University admissions pages', status: SourceStatus.Failing, enabled: true, lastSuccessAt: at(-3), failuresLast24h: 12, opportunitiesFound: 58 },
    { id: 'src_company_pages', name: 'Company career pages', status: SourceStatus.Healthy, enabled: true, lastSuccessAt: at(0), failuresLast24h: 2, opportunitiesFound: 305 },
    { id: 'src_legacy_feed', name: 'Legacy RSS feed', status: SourceStatus.Disabled, enabled: false, failuresLast24h: 0, opportunitiesFound: 0 },
  ];

  const modes = enumValues(ApplicationMode).filter((m) => m !== ApplicationMode.Off);
  const applications: AdminApplicationRow[] = userState.applications.map((a, i) => ({
    id: a.id,
    userName: users[0]?.fullName ?? '',
    opportunityTitle: a.opportunity.title,
    organization: a.opportunity.organization,
    submissionStatus: a.submissionStatus,
    outcomeStatus: a.outcomeStatus,
    route: a.route,
    mode: modes[i % modes.length] ?? ApplicationMode.ApproveEach,
    updatedAt: a.updatedAt,
  }));
  const extraStatuses = [SubmissionStatus.ApprovedQueued, SubmissionStatus.Failed, SubmissionStatus.Confirmed, SubmissionStatus.AwaitingApproval, SubmissionStatus.Confirmed, SubmissionStatus.Submitting];
  extraStatuses.forEach((status, i) => {
    const user = users[(i % (users.length - 1)) + 1];
    const opportunity = userState.opportunities[i % userState.opportunities.length];
    applications.push({
      id: `app_admin_${i + 1}`,
      userName: user?.fullName ?? '',
      opportunityTitle: opportunity?.title ?? '',
      organization: opportunity?.organization ?? '',
      submissionStatus: status,
      outcomeStatus: status === SubmissionStatus.Confirmed ? OutcomeStatus.UnderReview : OutcomeStatus.NoResponseYet,
      route: i % 2 === 0 ? ApplicationRoute.Email : ApplicationRoute.AtsPortal,
      mode: modes[(i + 1) % modes.length] ?? ApplicationMode.Automatic,
      updatedAt: at(-i),
    });
  });

  const admins: AdminDemoAccount[] = [
    { account: { id: 'adm_super', fullName: 'Super Admin', email: 'admin@sober.com', role: AdminRole.SuperAdmin, suspended: false, mfaEnabled: true, lastSignInAt: at(0) }, password: 'admin@sober.com' },
    { account: { id: 'adm_real', fullName: 'Saidul Islam Rajib', email: 'saidul.rajib.online@gmail.com', role: AdminRole.SuperAdmin, suspended: false, mfaEnabled: true, lastSignInAt: at(-2) }, password: 'Test@123#' },
    { account: { id: 'adm_support', fullName: 'Support Agent', email: 'support@sober.com', role: AdminRole.Support, suspended: false, mfaEnabled: true, lastSignInAt: at(-1) }, password: 'admin@sober.com' },
    { account: { id: 'adm_ops', fullName: 'Operations Agent', email: 'operations@sober.com', role: AdminRole.Operations, suspended: false, mfaEnabled: true, lastSignInAt: at(-4) }, password: 'admin@sober.com' },
    { account: { id: 'adm_viewer', fullName: 'Read-only Viewer', email: 'viewer@sober.com', role: AdminRole.ReadOnly, suspended: false, mfaEnabled: false }, password: 'admin@sober.com' },
  ];

  const audit: AuditEntry[] = [
    { id: 'aud_seed_1', at: at(-1), actorName: 'Super Admin', actorType: ActorType.Admin, action: 'source.disabled', target: 'Legacy RSS feed' },
    { id: 'aud_seed_2', at: at(-2), actorName: 'Support Agent', actorType: ActorType.Admin, action: 'user.viewed_sensitive', target: 'Tanvir Hossain' },
    { id: 'aud_seed_3', at: at(-3), actorName: 'System', actorType: ActorType.System, action: 'application.outcome_unknown', target: 'Lead QA Engineer · Meghna Tech' },
    { id: 'aud_seed_4', at: at(-4), actorName: 'Ayesha Rahman', actorType: ActorType.User, action: 'application.approved', target: 'Software Engineer · Bay Digital Ltd' },
  ];

  return {
    admins,
    users,
    userPhones: { usr_demo: '+8801712345678' },
    secrets: {
      usr_demo: [
        { kind: 'oauth', label: 'Gmail sending access', createdAt: at(-30), lastUsedAt: at(-6) },
        { kind: 'portal_password', label: 'Kite Commerce ATS account', createdAt: at(-4), lastUsedAt: at(-3) },
      ],
    },
    opportunities,
    sources,
    applications,
    audit,
    settings: { activeTheme: ThemeKey.Sober, emergencyStop: { active: false }, dailyApplicationCap: 10, approvalValidityDays: 3, deletionGraceDays: 14, accountLinkTtlMinutes },
    services: [
      { service: 'User API', status: ServiceHealth.Up },
      { service: 'Admin API', status: ServiceHealth.Up },
      { service: 'Workers', status: ServiceHealth.Up },
      { service: 'Discovery', status: ServiceHealth.Degraded },
      { service: 'Database backups', status: ServiceHealth.Up },
    ],
    notifications: { sent: 1840, delivered: 1796, failed: 44 },
    archivedCirculars: 2781,
  };
}
