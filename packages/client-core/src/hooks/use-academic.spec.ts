import { describe, expect, it } from 'vitest';
import { ApiError, ApiErrorCode, type AcademicWarning, type Exam } from '@careerpilot/api-client';
import { AcademicFailure, AmountSource, ExamStatus, ExamKind, WarningKind } from '@careerpilot/domain-ui-logic';
import { academicErrorKey, examsExpiringFirst, studyOpportunities, warningKey } from './use-academic';

describe('academic helpers', () => {
  it('maps failures to catalog keys and falls back to a generic one', () => {
    const known = new ApiError(ApiErrorCode.Validation, 422, AcademicFailure.RefereeConsentRequired);
    expect(academicErrorKey(known)).toBe('academic.errors.referee_consent_required');
    expect(academicErrorKey(new Error('x'))).toBe('academic.errors.generic');
  });

  it('keys warnings by kind', () => {
    const warning: AcademicWarning = {
      kind: WarningKind.NoValidScore,
      programId: 'p',
      exam: ExamKind.Ielts,
    };
    expect(warningKey(warning)).toBe('academic.warnings.no_valid_score');
  });

  it('sorts exams by expiry with unknown last', () => {
    const base = {
      status: ExamStatus.Planned,
      reports: [],
      note: '',
      feeCurrency: '',
      feeSource: AmountSource.Estimate,
    };
    const exams = [
      { ...base, id: 'a', exam: ExamKind.Gre },
      { ...base, id: 'b', exam: ExamKind.Ielts, expiresOn: '2027-01-01' },
      { ...base, id: 'c', exam: ExamKind.Toefl, expiresOn: '2026-01-01' },
    ] satisfies Exam[];
    expect(examsExpiringFirst(exams).map((e) => e.id)).toEqual(['c', 'b', 'a']);
  });

  it('lists untracked study opportunities from the dashboard only once', () => {
    const summary = (id: string, type: string) => ({ id, type }) as never;
    const dashboard = {
      tracks: [
        {
          opportunities: [summary('a', 'masters'), summary('b', 'job'), summary('c', 'phd')],
        },
        { opportunities: [summary('a', 'masters')] },
      ],
    } as never;
    expect(studyOpportunities(dashboard, ['c']).map((o) => o.id)).toEqual(['a']);
    expect(studyOpportunities(undefined, [])).toEqual([]);
  });
});
