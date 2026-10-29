import type { ApplicationFilter } from '@careerpilot/api-client';

export const queryKeys = {
  config: ['config'] as const,
  dashboard: ['dashboard'] as const,
  opportunity: (id: string) => ['opportunity', id] as const,
  approvals: ['approvals'] as const,
  approval: (id: string) => ['approval', id] as const,
  applications: (filter: ApplicationFilter) => ['applications', filter] as const,
  applicationsAll: ['applications'] as const,
  application: (id: string) => ['application', id] as const,
  profile: ['profile'] as const,
  settings: ['settings'] as const,
  signInActivity: ['sign-in-activity'] as const,
  questionBank: ['question-bank'] as const,
  jobSources: ['job-sources'] as const,
  sourceJobs: (id: string) => ['job-sources', id, 'jobs'] as const,
  accountLink: (token: string) => ['account-link', token] as const,
  inbox: ['inbox'] as const,
  notifications: ['notifications'] as const,
  conversations: ['conversations'] as const,
  conversation: (id: string) => ['conversation', id] as const,
  memberSearch: (query: string) => ['member-search', query] as const,
};
