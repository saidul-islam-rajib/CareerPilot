import { SourceReview, SourceStatus } from '@careerpilot/domain-ui-logic';
import { isHttpsAddress, sameAddress, secureAddress, siteName } from '../addresses';
import { ApiErrorCode, ApiErrorDetail } from '../errors';
import type { Clock, IdGenerator, SourcesApi } from '../ports';
import type { UserSource } from '../types';

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
  return {
    listSources: () => respond(sources.map((source) => ({ ...source }))),
    async addSource(input) {
      const url = secureAddress(input.url);
      if (!isHttpsAddress(url)) {
        return reject(ApiErrorCode.Validation, ApiErrorDetail.SourceUrl);
      }
      if (sources.some((source) => sameAddress(source.siteUrl, url))) {
        return reject(ApiErrorCode.Conflict, ApiErrorDetail.SourceExists);
      }
      if (sources.length >= limit) {
        return reject(ApiErrorCode.Validation, ApiErrorDetail.SourceLimit);
      }
      const source: UserSource = {
        id: ids.next('src'),
        name: input.name?.trim() || siteName(url),
        siteUrl: url,
        status: SourceStatus.Healthy,
        review: SourceReview.Pending,
        jobsFound: 0,
        addedAt: clock.now().toISOString(),
      };
      sources.unshift(source);
      return respond({ ...source });
    },
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
