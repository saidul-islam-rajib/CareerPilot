import { describe, expect, it } from 'vitest';
import { ApiError, ApiErrorCode, ApiErrorDetail } from '@careerpilot/api-client';
import { sourceCheckErrorKey } from './catalog-pages';

describe('sourceCheckErrorKey', () => {
  it('explains sources without a connector', () => {
    expect(sourceCheckErrorKey(new ApiError(ApiErrorCode.Conflict, 409, ApiErrorDetail.SourceNotConfigured))).toBe('admin.sources.notConfigured');
  });

  it('falls back to a generic message', () => {
    expect(sourceCheckErrorKey(new ApiError(ApiErrorCode.Server, 500))).toBe('admin.sources.checkFailed');
  });
});
