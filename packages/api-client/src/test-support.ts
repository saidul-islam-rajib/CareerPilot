import { ThemeKey } from '@careerpilot/ui-tokens';
import { PauseDuration } from '@careerpilot/domain-ui-logic';
import { buildDemoSeed } from './in-memory/demo.seed';
import { enumValueSeed } from './in-memory/enum-values.seed';
import { createInMemoryApi } from './in-memory/in-memory-api';
import { sequentialIds, type Clock } from './ports';
import type { PublicConfig } from './types';

export const fixedNow = new Date('2026-10-20T06:00:00Z');
export const fixedClock: Clock = { now: () => new Date(fixedNow) };

export const testConfig: PublicConfig = {
  theme: ThemeKey.Sober,
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
};

export function createTestApi() {
  return createInMemoryApi({
    config: testConfig,
    state: buildDemoSeed(fixedNow),
    clock: fixedClock,
    ids: sequentialIds(),
    latencyMs: 0,
    approvalValidityDays: 3,
    recentWindowDays: 7,
  });
}
