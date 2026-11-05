import { describe, expect, it } from 'vitest';
import { catalogs, createTranslator } from '@careerpilot/i18n';
import type { AttemptView } from '@careerpilot/api-client';
import { AttemptState, HostPolicy, PortalAccountStatus, StopReason, Verdict, WallKind } from '@careerpilot/domain-ui-logic';
import {
  accountStatusKey,
  attemptCanResume,
  attemptHasProof,
  attemptStateKey,
  autopilotInputOf,
  hostPolicyKey,
  stopReasonKey,
  verdictKey,
  wallKey,
} from './use-portal';

const t = createTranslator(catalogs.en);
const attempt: AttemptView = {
  applicationId: 'a1',
  state: AttemptState.Stopped,
  detail: '',
  officialUrl: 'https://jobs.example.com',
  host: 'jobs.example.com',
  prepared: [],
  pending: [],
  submitClicked: false,
  runs: 1,
  finalUrl: '',
  confirmationText: '',
  evidenceKey: '',
  updatedAt: '',
};

describe('portal helpers', () => {
  it('has a catalog text for every enum value', () => {
    const keys = [
      ...Object.values(StopReason).map(stopReasonKey),
      ...Object.values(AttemptState).map(attemptStateKey),
      ...Object.values(HostPolicy).map(hostPolicyKey),
      ...Object.values(Verdict).map(verdictKey),
      ...Object.values(WallKind).map(wallKey),
      ...Object.values(PortalAccountStatus).map(accountStatusKey),
    ];
    for (const key of keys) {
      expect(t(key), key).not.toBe(key);
    }
  });

  it('allows resuming only before submit was clicked', () => {
    expect(attemptCanResume(attempt)).toBe(true);
    expect(attemptCanResume({ ...attempt, submitClicked: true })).toBe(false);
    expect(attemptCanResume({ ...attempt, state: AttemptState.Confirmed })).toBe(false);
  });

  it('detects proof and trims the account email', () => {
    expect(attemptHasProof(attempt)).toBe(false);
    expect(attemptHasProof({ ...attempt, finalUrl: 'https://x' })).toBe(true);
    const input = autopilotInputOf({ acknowledged: true, allowAccountCreation: true, accountEmail: ' ', acceptTerms: false, acceptPrivacy: false, allowEmailVerification: false });
    expect(input.accountEmail).toBeUndefined();
  });
});
