import { buildDemoSeed, createInMemoryApi, sequentialIds, type CareerPilotApi, type Clock } from '@careerpilot/api-client';
import { publicConfigFromDefaults, type AppConfig } from './config/client-config';

export const TEST_VERIFICATION_CODE = '246810';
export const TEST_LINK_TOKEN = 'test-link';

export function createTestApi(config: AppConfig, clock: Clock): CareerPilotApi {
  return createInMemoryApi({
    config: publicConfigFromDefaults(config),
    state: buildDemoSeed(clock.now()),
    clock,
    ids: sequentialIds(),
    latencyMs: 0,
    demoVerificationCode: TEST_VERIFICATION_CODE,
    demoLinkToken: TEST_LINK_TOKEN,
    approvalValidityDays: config.account.approvalValidityDays,
    recentWindowDays: config.account.recentWindowDays,
  });
}
