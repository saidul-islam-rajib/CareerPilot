import { describe, expect, it } from 'vitest';
import { catalogs, createTranslator } from '@careerpilot/i18n';
import type { AttemptView, FillPlan } from '@careerpilot/api-client';
import { AttemptState, HostPolicy, PortalAccountStatus, StopReason, Verdict, WallKind } from '@careerpilot/domain-ui-logic';
import {
  accountStatusKey,
  attemptCanResume,
  attemptHasProof,
  assistCopyItems,
  assistUsesWebView,
  attemptStateKey,
  readinessSummary,
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

const plan: FillPlan = {
  applicationId: 'a1',
  officialUrl: 'https://jobs.example.com',
  host: 'jobs.example.com',
  hostPolicy: HostPolicy.Review,
  assistAllowed: true,
  accountEmail: 'me+jobs@example.com',
  hasPassword: true,
  facts: [{ fact: 'full_name', value: 'Rahim Uddin', autocomplete: [], names: [], labels: [] }],
  answers: [{ label: 'Years of experience', answer: '5' }],
  coverLetter: 'Hello',
  coverLetterLabels: [],
  resumeLabels: [],
  confirmationPhrases: [],
  skipTerms: [],
  captchaSelectors: [],
  scanIntervalMs: 1500,
  excerptChars: 300,
};

describe('assisted apply helpers', () => {
  it('lists copyable values from the plan only', () => {
    const items = assistCopyItems(plan);
    expect(items.map((i) => i.value)).toEqual(['me+jobs@example.com', 'Rahim Uddin', '5', 'Hello']);
    for (const item of items) {
      expect(item.label ?? t(item.labelKey ?? '')).toBeTruthy();
      expect(item.labelKey ? t(item.labelKey) : item.label).not.toBe(item.labelKey);
    }
  });

  it('opens the in-app page only when the host is not blocked', () => {
    expect(assistUsesWebView(plan)).toBe(true);
    expect(assistUsesWebView({ ...plan, assistAllowed: false, hostPolicy: HostPolicy.Blocked })).toBe(false);
  });

  it('summarises a readiness verdict', () => {
    const base = { id: 'r', url: '', host: '', state: 'done', requestedAt: '', requestedBy: '', wall: 'none', captchaSeen: false, pageTitle: '', finalUrl: '', fields: [], mapped: 0, unknown: 0, error: '' };
    expect(readinessSummary({ ...base, verdict: Verdict.CanAutoApply, reasons: [] } as never).canAutoApply).toBe(true);
    expect(readinessSummary({ ...base, verdict: Verdict.WillStop, reasons: [StopReason.Captcha] } as never)).toEqual({ canAutoApply: false, reasons: [StopReason.Captcha] });
  });
});
