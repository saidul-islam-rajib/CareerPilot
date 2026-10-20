import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';
import { ThemeKey } from '@careerpilot/ui-tokens';
import { ApiMode, parseAppConfig, publicConfigFromDefaults } from './client-config';

const require = createRequire(import.meta.url);
const { loadConfig } = require('../../../../scripts/config/load-config.js') as { loadConfig: (env: string) => Record<string, unknown> };

describe('app config', () => {
  it('parses the repository YAML defaults', () => {
    const config = parseAppConfig({ careerpilot: loadConfig('local') });
    expect(config.api.mode).toBe(ApiMode.InMemory);
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
