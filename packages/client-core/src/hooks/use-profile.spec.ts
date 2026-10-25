import { describe, expect, it } from 'vitest';
import { ApiError, ApiErrorCode } from '@careerpilot/api-client';
import { UploadRejection, checkUpload, profileErrorKey, sortEntries } from './use-profile';

describe('profileErrorKey', () => {
  it('explains upload and contact problems', () => {
    expect(profileErrorKey(new ApiError(ApiErrorCode.Validation, 422, 'file_type'))).toBe('validation.fileType');
    expect(profileErrorKey(new ApiError(ApiErrorCode.Validation, 422, 'file_too_large'))).toBe('validation.fileTooLarge');
    expect(profileErrorKey(new ApiError(ApiErrorCode.Conflict, 409, 'contact_exists'))).toBe('validation.duplicateContact');
  });

  it('falls back to a generic message', () => {
    expect(profileErrorKey(new ApiError(ApiErrorCode.Validation, 422, 'experience.title'))).toBe('common.saveFailed');
    expect(profileErrorKey(new ApiError(ApiErrorCode.Network))).toBe('common.saveFailed');
  });
});

describe('sortEntries', () => {
  it('orders entries by position and tolerates missing sections', () => {
    const entry = (id: string, position: number) => ({ id, position, values: {}, updatedAt: '2026-01-01T00:00:00Z' });
    expect(sortEntries([entry('b', 2), entry('a', 1)]).map((e) => e.id)).toEqual(['a', 'b']);
    expect(sortEntries(undefined)).toEqual([]);
  });
});

describe('checkUpload', () => {
  const pdf = (size: number, type = 'application/pdf') => ({ name: 'cv.pdf', type, size, uri: 'file://cv.pdf' });

  it('flags empty, wrong-type, and oversized uploads', () => {
    expect(checkUpload(pdf(0), ['application/pdf'], 10)).toBe(UploadRejection.Empty);
    expect(checkUpload(pdf(5, 'image/png'), ['application/pdf'], 10)).toBe(UploadRejection.Type);
    expect(checkUpload(pdf(11), ['application/pdf'], 10)).toBe(UploadRejection.Size);
    expect(checkUpload(pdf(10), ['application/pdf'], 10)).toBeUndefined();
  });
});
