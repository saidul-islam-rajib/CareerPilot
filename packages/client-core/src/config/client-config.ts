import { z } from 'zod';
import { PauseDuration, enumValues } from '@careerpilot/domain-ui-logic';
import { THEME_KEYS, type ThemeKey } from '@careerpilot/ui-tokens';
import { enumValueSeed, type PublicConfig } from '@careerpilot/api-client';

export const ApiMode = {
  InMemory: 'in_memory',
  Http: 'http',
} as const;
export type ApiMode = (typeof ApiMode)[keyof typeof ApiMode];

const themeKey = z.enum(THEME_KEYS as [ThemeKey, ...ThemeKey[]]);

export const appConfigSchema = z.object({
  account: z.object({
    locale: z.string(),
    defaultTimeZone: z.string(),
    deletionGraceDays: z.number().int().positive(),
    approvalValidityDays: z.number().int().positive(),
    recentWindowDays: z.number().int().positive(),
    pauseOptions: z.array(
      z.object({
        duration: z.enum(enumValues(PauseDuration) as [PauseDuration, ...PauseDuration[]]),
        amount: z.number().int().positive().optional(),
      }),
    ),
  }),
  legal: z.object({
    termsUrl: z.string().url(),
    privacyUrl: z.string().url(),
    termsVersion: z.string(),
    privacyVersion: z.string(),
  }),
  branding: z.object({
    productName: z.string(),
    developerName: z.string(),
    developerUrl: z.string().url(),
  }),
  api: z.object({
    mode: z.enum([ApiMode.InMemory, ApiMode.Http]),
    baseUrl: z.string().url(),
    timeoutMs: z.number().int().positive(),
    demoLatencyMs: z.number().int().nonnegative(),
  }),
  query: z.object({
    staleTimeMs: z.number().int().nonnegative(),
    retryCount: z.number().int().nonnegative(),
  }),
  display: z.object({
    strongMatchScore: z.number().int().min(0).max(100),
    fairMatchScore: z.number().int().min(0).max(100),
    urgentDeadlineDays: z.number().int().nonnegative(),
  }),
  ui: z.object({
    activeTheme: themeKey,
    adminTheme: themeKey,
  }),
  validation: z.object({
    password: z.object({
      minLength: z.number().int().positive(),
      maxLength: z.number().int().positive(),
      requireMixedCase: z.boolean(),
      requireDigit: z.boolean(),
      requireSymbol: z.boolean(),
    }),
    name: z.object({ minLength: z.number().int().positive(), maxLength: z.number().int().positive() }),
    email: z.object({ maxLength: z.number().int().positive() }),
    answer: z.object({ maxLength: z.number().int().positive() }),
    track: z.object({ minResultCount: z.number().int().positive(), maxResultCount: z.number().int().positive() }),
  }),
  openSourceComponents: z.array(z.object({ name: z.string(), licence: z.string(), url: z.string().url() })),
});

export type AppConfig = z.infer<typeof appConfigSchema>;

export function parseAppConfig(extra: unknown): AppConfig {
  const section = (extra as { careerpilot?: unknown } | undefined)?.careerpilot;
  return appConfigSchema.parse(section);
}

export function publicConfigFromDefaults(config: AppConfig): PublicConfig {
  return {
    theme: config.ui.activeTheme,
    display: config.display,
    locale: config.account.locale,
    defaultTimeZone: config.account.defaultTimeZone,
    enumValues: enumValueSeed,
    validationPolicy: config.validation,
    pauseOptions: config.account.pauseOptions,
    accountDeletionGraceDays: config.account.deletionGraceDays,
    legal: config.legal,
    branding: config.branding,
    openSourceComponents: config.openSourceComponents,
  };
}
