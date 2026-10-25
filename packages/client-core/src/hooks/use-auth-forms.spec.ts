import { describe, expect, it } from 'vitest';
import { ApiError, ApiErrorCode, errorCodeForStatus } from '@careerpilot/api-client';
import { Locale, catalogs } from '@careerpilot/i18n';
import { authErrorKey } from './use-auth-forms';

function hasMessage(key: string): boolean {
  return key.split('.').reduce<unknown>((node, part) => (node as Record<string, unknown> | undefined)?.[part], catalogs[Locale.English]) !== undefined;
}

describe('authErrorKey', () => {
  it.each([
    [ApiErrorCode.InvalidCredentials, 'auth.invalidCredentials'],
    [ApiErrorCode.TooManyAttempts, 'auth.tooManyAttempts'],
    [ApiErrorCode.ServiceUnavailable, 'auth.serviceUnavailable'],
    [ApiErrorCode.Server, 'common.errorBody'],
  ])('maps %s to a catalog message', (code, key) => {
    expect(authErrorKey(new ApiError(code))).toBe(key);
    expect(hasMessage(key)).toBe(true);
  });

  it('maps rate-limit and unavailable statuses', () => {
    expect(errorCodeForStatus(429)).toBe(ApiErrorCode.TooManyAttempts);
    expect(errorCodeForStatus(503)).toBe(ApiErrorCode.ServiceUnavailable);
  });
});
