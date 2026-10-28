import { z } from 'zod';
import { AnswerTopic, CompletenessKind, EnumKey, PauseDuration, ProfileFieldType, enumValues } from '@careerpilot/domain-ui-logic';
import { THEME_KEYS, type ThemeKey } from '@careerpilot/ui-tokens';
import { enumCatalog, type PublicConfig } from '@careerpilot/api-client';

const SECONDS_PER_MINUTE = 60;
const themeKey = z.enum(THEME_KEYS as [ThemeKey, ...ThemeKey[]]);

function enumSchema<T extends string>(values: T[]) {
  return z.enum(values as [T, ...T[]]);
}

const fieldSchema = z.object({
  key: z.string(),
  type: enumSchema(enumValues(ProfileFieldType)),
  required: z.boolean().optional(),
  maxLength: z.number().int().positive().optional(),
  min: z.number().optional(),
  max: z.number().optional(),
  options: enumSchema(enumValues(EnumKey)).optional(),
});

const sectionSchema = z.object({
  key: z.string(),
  icon: z.string(),
  titleField: z.string(),
  subtitleFields: z.array(z.string()).optional(),
  startField: z.string().optional(),
  endField: z.string().optional(),
  ongoingField: z.string().optional(),
  bodyField: z.string().optional(),
  linkField: z.string().optional(),
  fields: z.array(fieldSchema),
});

const positiveInt = z.number().int().positive();

const profileSchema = z.object({
  pageOrder: z.array(z.string()),
  sections: z.array(sectionSchema),
  limits: z.object({
    maxContacts: positiveInt,
    maxSkills: positiveInt,
    maxSkillLength: positiveInt,
    maxEntriesPerSection: positiveInt,
    maxDocuments: positiveInt,
    headlineMaxLength: positiveInt,
    locationMaxLength: positiveInt,
    summaryMaxLength: positiveInt,
    contactLabelMaxLength: positiveInt,
    documentNameMaxLength: positiveInt,
    phonePattern: z.string(),
    minYear: z.number().int(),
    futureYears: z.number().int().nonnegative(),
    minSkillsForCompleteness: z.number().int().nonnegative(),
  }),
  uploads: z.object({
    maxDocumentBytes: positiveInt,
    maxPhotoBytes: positiveInt,
    documentTypes: z.array(z.string()),
    photoTypes: z.array(z.string()),
  }),
  completeness: z.array(z.object({ kind: enumSchema(enumValues(CompletenessKind)), weight: z.number().int().nonnegative(), section: z.string().optional() })),
});

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
    baseUrl: z.string().url(),
    timeoutMs: z.number().int().positive(),
    uploadTimeoutMs: z.number().int().positive(),
  }),
  query: z.object({
    staleTimeMs: z.number().int().nonnegative(),
    retryCount: z.number().int().nonnegative(),
    retryBaseDelayMs: z.number().int().positive(),
    retryMaxDelayMs: z.number().int().positive(),
  }),
  display: z.object({
    strongMatchScore: z.number().int().min(0).max(100),
    fairMatchScore: z.number().int().min(0).max(100),
    urgentDeadlineDays: z.number().int().nonnegative(),
  }),
  ui: z.object({
    activeTheme: themeKey,
    adminTheme: themeKey,
    saveDelayMs: z.number().int().positive(),
    submissionWindowPresets: z.array(z.object({ key: z.string(), start: z.string(), end: z.string() })),
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
    note: z.object({ maxLength: z.number().int().positive() }),
    track: z.object({ minResultCount: z.number().int().positive(), maxResultCount: z.number().int().positive() }),
  }),
  openSourceComponents: z.array(z.object({ name: z.string(), licence: z.string(), url: z.string().url() })),
  tracking: z.object({
    taskTitleMaxLength: z.number().int().positive(),
    taskNotesMaxLength: z.number().int().positive(),
    taskLocationMaxLength: z.number().int().positive(),
    outcomeNoteMaxLength: z.number().int().positive(),
    upcomingDays: z.number().int().positive(),
    upcomingLimit: z.number().int().positive(),
    followUpAfterDays: z.number().int().positive(),
    defaultTaskTime: z.string(),
  }),
  jobSources: z.object({ maxPerUser: z.number().int().positive(), minLimit: z.number().int().positive(), maxLimit: z.number().int().positive() }),
  answers: z.object({
    questionMaxLength: z.number().int().positive(),
    maxSavedAnswers: z.number().int().positive(),
    topicKeywords: z.array(z.object({ topic: z.enum(enumValues(AnswerTopic)), keywords: z.array(z.string()) })),
  }),
  verification: z.object({
    codeLength: z.number().int().positive(),
    codeTtlSeconds: z.number().int().positive(),
    resendCooldownSeconds: z.number().int().nonnegative(),
    smsEnabled: z.boolean(),
  }),
  accountLinks: z
    .object({
      ttlMinutes: z.number().int().positive(),
      minTtlMinutes: z.number().int().positive(),
      maxTtlMinutes: z.number().int().positive(),
    })
    .refine((links) => links.minTtlMinutes <= links.ttlMinutes && links.ttlMinutes <= links.maxTtlMinutes),
  notifications: z.object({
    defaultDigestTime: z.string(),
    digestTimePresets: z.array(z.object({ key: z.string(), time: z.string() })),
  }),
  profile: profileSchema,
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
    enumValues: enumCatalog,
    validationPolicy: config.validation,
    pauseOptions: config.account.pauseOptions,
    accountDeletionGraceDays: config.account.deletionGraceDays,
    legal: config.legal,
    branding: config.branding,
    openSourceComponents: config.openSourceComponents,
    notifications: config.notifications,
    tracking: config.tracking,
    answers: config.answers,
    jobSources: config.jobSources,
    verification: {
      codeLength: config.verification.codeLength,
      codeTtlSeconds: config.verification.codeTtlSeconds,
      resendCooldownSeconds: config.verification.resendCooldownSeconds,
      smsEnabled: config.verification.smsEnabled,
    },
    accountLinks: {
      ttlMinutes: config.accountLinks.ttlMinutes,
      resendCooldownSeconds: config.accountLinks.ttlMinutes * SECONDS_PER_MINUTE,
      minTtlMinutes: config.accountLinks.minTtlMinutes,
      maxTtlMinutes: config.accountLinks.maxTtlMinutes,
    },
    profile: config.profile,
  };
}
