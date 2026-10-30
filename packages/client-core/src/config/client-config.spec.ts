import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';
import { ThemeKey } from '@careerpilot/ui-tokens';
import { parseAppConfig, publicConfigFromDefaults } from './client-config';
import { mergePublicConfig } from './public-config';

const require = createRequire(import.meta.url);
const { loadConfig, loadClientConfig, clientConfig, withDeploymentAddresses, usesPlainHttp } = require('../../../../scripts/config/load-config.js') as {
  loadConfig: (env: string) => Record<string, unknown>;
  loadClientConfig: (env: string) => Record<string, unknown>;
  clientConfig: (config: Record<string, unknown>) => Record<string, unknown>;
  usesPlainHttp: (settings: Record<string, unknown>) => boolean;
  withDeploymentAddresses: (config: Record<string, unknown>, environ: Record<string, string>) => { api: { baseUrl: string }; admin: { baseUrl: string } };
};

const SERVER_ONLY = ['mail', 'persistence', 'security', 'coordination', 'submission', 'discovery', 'matching', 'workers', 'http', 'observability', 'dev'];

describe('client config shipped to browsers and phones', () => {
  it('holds everything the apps need', () => {
    for (const env of ['local', 'docker', 'http', 'production']) {
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

describe('deployment addresses', () => {
  const names = { api: 'CAREERPILOT_API_URL', admin: 'CAREERPILOT_ADMIN_API_URL' };

  it('uses the configured addresses without an override', () => {
    const full = loadConfig('production');
    const result = withDeploymentAddresses(full, {});
    expect(result.api.baseUrl).toBe((full.api as { baseUrl: string }).baseUrl);
    expect(result.admin.baseUrl).toBe((full.admin as { baseUrl: string }).baseUrl);
  });

  it('bakes the hosted API addresses from the environment', () => {
    const result = withDeploymentAddresses(loadConfig('production'), { [names.api]: ' https://api.example.net ', [names.admin]: 'https://admin-api.example.net' });
    expect(result.api.baseUrl).toBe('https://api.example.net');
    expect(result.admin.baseUrl).toBe('https://admin-api.example.net');
  });
});

describe('cleartext traffic in phone builds', () => {
  it('stays allowed only for plain http test addresses', () => {
    expect(usesPlainHttp({ api: { baseUrl: 'http://192.168.0.104:8000' } })).toBe(true);
  });

  it('is refused when the hosted API uses https', () => {
    expect(usesPlainHttp({ api: { baseUrl: 'https://api.example.net' } })).toBe(false);
    expect(usesPlainHttp({})).toBe(false);
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
