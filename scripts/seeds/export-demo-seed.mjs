import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';

const root = path.resolve(process.argv[2] ?? '.');
const output = path.resolve(process.argv[3] ?? 'services/core/tests/fixtures/sample-data.json');
const referenceNow = new Date(process.env.SEED_REFERENCE_NOW ?? '2026-10-20T06:00:00Z');

const bundleFile = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'careerpilot-seed-')), 'api-client.mjs');
await build({
  entryPoints: [path.join(root, 'packages/api-client/src/index.ts')],
  bundle: true,
  format: 'esm',
  platform: 'node',
  outfile: bundleFile,
  logLevel: 'silent',
});
const api = await import(pathToFileURL(bundleFile).href);
const user = api.buildDemoSeed(referenceNow);
const admin = api.buildAdminDemoSeed(referenceNow, user);
const seed = { referenceNow: referenceNow.toISOString(), enumValues: api.enumCatalog, user, admin };
fs.mkdirSync(path.dirname(output), { recursive: true });
fs.writeFileSync(output, `${JSON.stringify(seed, null, 2)}\n`);
console.log(`demo seed written to ${path.relative(root, output)}`);
