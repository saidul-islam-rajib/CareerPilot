import { SourceReview, SourceStatus } from '@careerpilot/domain-ui-logic';
import { isHttpsAddress, sameAddress, secureAddress, siteName } from '../addresses';
import { ApiErrorCode, ApiErrorDetail } from '../errors';
import type { Clock, IdGenerator, SourcesApi } from '../ports';
import type { UserSource } from '../types';

const EMAIL_DOMAIN = /^[^@\s/]+@([a-z0-9-]+(?:\.[a-z0-9-]+)+)$/i;
const PERSONAL_EMAIL_DOMAINS: readonly string[] = ['gmail.com', 'yahoo.com', 'outlook.com', 'hotmail.com'];
const LETTER = /\p{L}/u;
const OTHER_SCHEME = /^(?!https?:)[a-z][a-z0-9+.-]*:\/\//i;

export interface JobSourceOptions {
  sources: UserSource[];
  limit: number;
  clock: Clock;
  ids: IdGenerator;
  respond: <T>(value: T) => Promise<T>;
  reject: (code: ApiErrorCode, detail?: string) => Promise<never>;
}

export function createJobSources(options: JobSourceOptions): SourcesApi {
  const { sources, limit, clock, ids, respond, reject } = options;
  const remember = (found: Pick<UserSource, 'name' | 'siteUrl'>) => {
    if (sources.length >= limit) {
      return reject(ApiErrorCode.Validation, ApiErrorDetail.SourceLimit);
    }
    const source: UserSource = {
      id: ids.next('src'),
      ...found,
      status: SourceStatus.Healthy,
      review: SourceReview.Pending,
      jobsFound: 0,
      addedAt: clock.now().toISOString(),
      arrangements: {},
    };
    sources.unshift(source);
    return respond({ ...source });
  };
  return {
    listSources: () => respond(sources.map((source) => ({ ...source }))),
    async addSource(input) {
      const typed = input.url.trim();
      const domain = EMAIL_DOMAIN.exec(typed)?.[1]?.toLowerCase();
      if (domain && PERSONAL_EMAIL_DOMAINS.includes(domain)) {
        return reject(ApiErrorCode.Validation, ApiErrorDetail.PersonalEmail);
      }
      const url = secureAddress(domain ?? typed);
      if ((!isHttpsAddress(url) && !LETTER.test(typed)) || OTHER_SCHEME.test(typed)) {
        return reject(ApiErrorCode.Validation, ApiErrorDetail.SourceUrl);
      }
      if (!isHttpsAddress(url)) {
        return remember({ name: input.name?.trim() || typed, siteUrl: '' });
      }
      if (sources.some((source) => sameAddress(source.siteUrl, url))) {
        return reject(ApiErrorCode.Conflict, ApiErrorDetail.SourceExists);
      }
      if (sources.length >= limit) {
        return reject(ApiErrorCode.Validation, ApiErrorDetail.SourceLimit);
      }
      return remember({ name: input.name?.trim() || siteName(url), siteUrl: url });
    },
    async listJobs(id) {
      const source = sources.find((item) => item.id === id);
      return source ? respond({ source: { ...source }, jobs: [] }) : reject(ApiErrorCode.NotFound);
    },
    saveJob: () => reject(ApiErrorCode.NotFound),
    async removeSource(id) {
      const index = sources.findIndex((source) => source.id === id);
      if (index < 0) {
        return reject(ApiErrorCode.NotFound);
      }
      sources.splice(index, 1);
      return respond(undefined);
    },
  };
}
