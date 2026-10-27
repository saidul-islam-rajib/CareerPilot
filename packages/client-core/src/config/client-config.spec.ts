import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';
import { ThemeKey } from '@careerpilot/ui-tokens';
import { parseAppConfig, publicConfigFromDefaults } from './client-config';
import { mergePublicConfig } from './public-config';

const require = createRequire(import.meta.url);
const { loadConfig, loadClientConfig, clientConfig } = require('../../../../scripts/config/load-config.js') as {
  loadConfig: (env: string) => Record<string, unknown>;
  loadClientConfig: (env: string) => Record<string, unknown>;
  clientConfig: (config: Record<string, unknown>) => Record<string, unknown>;
};

const SERVER_ONLY = ['mail', 'persistence', 'security', 'coordination', 'submission', 'discovery', 'matching', 'workers', 'http', 'observability', 'dev'];

describe('client config shipped to browsers and phones', () => {
  it('holds everything the apps need', () => {
    for (const env of ['local', 'docker', 'http']) {
      expect(() => parseAppConfig({ careerpilot: loadClientConfig(env) })).not.toThrow();
    }
  });

  it('never carries server-only settings', () => {
    const shipped = loadClientConfig('docker');
    for (const section of SERVER_ONLY) {
      expect(shipped).not.toHaveProperty(section);
    }
    expect(shipped.profile).not.toHaveProperty('storage');
    expect(shipped.accountLinks).not.toHaveProperty('tokenBytes');
  });

  it('drops a secret placed by mistake in a config file', () => {
    const full = loadConfig('local');
    const planted = { ...full, mail: { smtpPasswordEnv: 'planted-secret' }, profile: { ...(full.profile as object), storage: { key: 'planted-secret' } } };
    expect(JSON.stringify(clientConfig(planted))).not.toContain('planted-secret');
  });
});

describe('app config', () => {
  it('parses the repository YAML defaults', () => {
    const config = parseAppConfig({ careerpilot: loadConfig('local') });
    expect(config.api.baseUrl).toMatch(/^https?:\/\//);
    expect(config.ui.activeTheme).toBe(ThemeKey.Sober);
    expect(config.branding.developerUrl).toBe('https://team-sober.com/');
    expect(config.validation.password.minLength).toBeGreaterThan(0);
  });

  it('rejects invalid configuration', () => {
    const config = loadConfig('local');
    expect(() => parseAppConfig({ careerpilot: { ...config, ui: { activeTheme: 'neon' } } })).toThrow();
    expect(() => parseAppConfig(undefined)).toThrow();
  });

  it('builds the public config used before the server responds', () => {
    const publicConfig = publicConfigFromDefaults(parseAppConfig({ careerpilot: loadConfig('local') }));
    expect(publicConfig.theme).toBe(ThemeKey.Sober);
    expect(publicConfig.enumValues.length).toBeGreaterThan(0);
    expect(publicConfig.openSourceComponents.map((c) => c.name)).toContain('React Native Reusables');
  });
});

describe('mergePublicConfig', () => {
  it('keeps app defaults for keys an older server does not send', () => {
    const defaults = publicConfigFromDefaults(parseAppConfig({ careerpilot: loadConfig('local') }));
    const { profile, ...olderServer } = defaults;
    const merged = mergePublicConfig(defaults, { ...olderServer, locale: 'en-GB' });
    expect(merged.profile).toBe(profile);
    expect(merged.locale).toBe('en-GB');
    expect(mergePublicConfig(defaults, undefined)).toBe(defaults);
  });
});
