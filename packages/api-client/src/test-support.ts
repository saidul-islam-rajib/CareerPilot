import { createRequire } from 'node:module';
import { ThemeKey } from '@careerpilot/ui-tokens';
import { AnswerTopic, PauseDuration } from '@careerpilot/domain-ui-logic';
import { buildDemoSeed } from './in-memory/demo.seed';
import { enumValueSeed } from './in-memory/enum-values.seed';
import { createInMemoryApi } from './in-memory/in-memory-api';
import { sequentialIds, type Clock } from './ports';
import type { ProfileSettings, PublicConfig } from './types';

const require = createRequire(import.meta.url);
const { loadConfig } = require('../../../scripts/config/load-config.js') as { loadConfig: (env: string) => { profile: ProfileSettings } };
const localProfile = loadConfig('local').profile;

export const testProfileSettings: ProfileSettings = {
  pageOrder: localProfile.pageOrder,
  sections: localProfile.sections,
  limits: localProfile.limits,
  uploads: localProfile.uploads,
  completeness: localProfile.completeness,
};

export const fixedNow = new Date('2026-10-20T06:00:00Z');
export const fixedClock: Clock = { now: () => new Date(fixedNow) };

export const testConfig: PublicConfig = {
  theme: ThemeKey.Sober,
  display: { strongMatchScore: 80, fairMatchScore: 65, urgentDeadlineDays: 3 },
  locale: 'en',
  defaultTimeZone: 'Asia/Dhaka',
  enumValues: enumValueSeed,
  validationPolicy: {
    password: { minLength: 10, maxLength: 128, requireMixedCase: true, requireDigit: true, requireSymbol: true },
    name: { minLength: 2, maxLength: 120 },
    email: { maxLength: 254 },
    answer: { maxLength: 4000 },
    track: { minResultCount: 1, maxResultCount: 50 },
  },
  pauseOptions: [
    { duration: PauseDuration.Days, amount: 7 },
    { duration: PauseDuration.Indefinite },
  ],
  accountDeletionGraceDays: 14,
  legal: { termsUrl: 'https://example.com/terms', privacyUrl: 'https://example.com/privacy', termsVersion: '1', privacyVersion: '1' },
  branding: { productName: 'CareerPilot', developerName: 'Team Sober', developerUrl: 'https://team-sober.com/' },
  openSourceComponents: [],
  notifications: {
    defaultDigestTime: '08:00',
    digestTimePresets: [
      { key: 'morning', time: '08:00' },
      { key: 'evening', time: '18:00' },
    ],
  },
  verification: { codeLength: 6, codeTtlSeconds: 600, resendCooldownSeconds: 60, smsEnabled: false },
  tracking: {
    taskTitleMaxLength: 120,
    taskNotesMaxLength: 2000,
    taskLocationMaxLength: 500,
    outcomeNoteMaxLength: 500,
    upcomingDays: 7,
    upcomingLimit: 5,
    followUpAfterDays: 14,
    defaultTaskTime: '09:00',
  },
  answers: {
    questionMaxLength: 300,
    maxSavedAnswers: 100,
    topicKeywords: [
      { topic: AnswerTopic.Sponsorship, keywords: ['sponsorship', 'visa'] },
      { topic: AnswerTopic.NoticePeriod, keywords: ['notice period'] },
      { topic: AnswerTopic.StartDate, keywords: ['start date', 'earliest start'] },
      { topic: AnswerTopic.Relocation, keywords: ['relocate'] },
    ],
  },
  profile: testProfileSettings,
};

export const TEST_VERIFICATION_CODE = '246810';

export function createTestApi() {
  return createInMemoryApi({
    config: testConfig,
    state: buildDemoSeed(fixedNow),
    clock: fixedClock,
    ids: sequentialIds(),
    latencyMs: 0,
    demoVerificationCode: TEST_VERIFICATION_CODE,
    approvalValidityDays: 3,
    recentWindowDays: 7,
  });
}
