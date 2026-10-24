import { z } from 'zod';
import { appConfigSchema } from '@careerpilot/client-core';

const adminConfigSchema = appConfigSchema.extend({
  admin: z.object({
    baseUrl: z.string().url(),
    pageSize: z.number().int().positive(),
    chartDays: z.number().int().positive(),
    completeProfilePercent: z.number().int().min(0).max(100),
    sessionTimeoutMinutes: z.number().int().positive(),
  }),
});

export type AdminConfig = z.infer<typeof adminConfigSchema>;

export function parseAdminConfig(raw: unknown): AdminConfig {
  return adminConfigSchema.parse(raw);
}

let cached: AdminConfig | undefined;

export function getAdminConfig(): AdminConfig {
  cached ??= parseAdminConfig(JSON.parse(process.env.NEXT_PUBLIC_CAREERPILOT_CONFIG ?? '{}'));
  return cached;
}

export function getAppVersion(): string {
  return process.env.NEXT_PUBLIC_APP_VERSION ?? '';
}
