import { describe, expect, it } from 'vitest';
import { ApiError, ApiErrorCode } from '@careerpilot/api-client';
import { backoffDelay, isRetryable, retryPolicy } from './query-client';

describe('query retry policy', () => {
  it('retries only network, timeout, and server errors', () => {
    expect(isRetryable(new ApiError(ApiErrorCode.Network))).toBe(true);
    expect(isRetryable(new ApiError(ApiErrorCode.ServiceUnavailable, 503))).toBe(true);
    expect(isRetryable(new ApiError(ApiErrorCode.Unauthorized, 401))).toBe(false);
    expect(isRetryable(new ApiError(ApiErrorCode.Validation, 422))).toBe(false);
    expect(isRetryable(new Error('bug'))).toBe(false);
  });

  it('stops after the configured number of retries', () => {
    const retry = retryPolicy(3);
    const offline = new ApiError(ApiErrorCode.Network);
    expect([0, 1, 2, 3].map((count) => retry(count, offline))).toEqual([true, true, true, false]);
  });

  it('backs off exponentially up to a ceiling', () => {
    const delay = backoffDelay(1000, 8000);
    expect([0, 1, 2, 3, 4].map(delay)).toEqual([1000, 2000, 4000, 8000, 8000]);
  });
});
