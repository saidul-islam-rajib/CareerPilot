import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';
import { enumCatalog } from './enum-catalog';

const require = createRequire(import.meta.url);
const { loadConfig } = require('../../../../scripts/config/load-config.js') as { loadConfig: (env: string) => { enumValues: unknown } };

describe('enum catalog', () => {
  it('matches the catalog the backend serves from config', () => {
    expect(loadConfig('local').enumValues).toEqual(enumCatalog);
  });
});
