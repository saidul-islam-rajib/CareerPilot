import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright-core';

const appDir = path.resolve(process.argv[2] ?? 'apps/web');
const outDir = path.resolve(process.argv[3] ?? '.validation/web');
const port = Number(process.env.VALIDATION_PORT ?? 4320);
const base = `http://localhost:${port}`;
const widths = (process.env.VIEWPORT_WIDTHS ?? '390,1280').split(',').map(Number);
const height = Number(process.env.VIEWPORT_HEIGHT ?? 900);
const settleMs = Number(process.env.SETTLE_MS ?? 900);
const startTimeoutMs = Number(process.env.START_TIMEOUT_MS ?? 60000);

const screens = [
  ['home', '/'],
  ['approvals', '/approvals'],
  ['approval-detail', '/approvals/apr_frontend'],
  ['applications', '/applications'],
  ['application-record', '/applications/app_bay'],
  ['opportunity', '/opportunities/opp_remote_frontend'],
  ['opportunity-hard-failure', '/opportunities/opp_gov_programmer'],
  ['circular', '/opportunities/opp_bd_dhaka/circular'],
  ['profile', '/profile'],
  ['settings', '/settings'],
  ['tracks', '/settings/tracks'],
  ['pause', '/settings/pause'],
  ['window', '/settings/window'],
  ['activity', '/settings/activity'],
  ['about', '/settings/about'],
  ['licences', '/settings/licences'],
  ['delete-account', '/settings/delete-account'],
];

async function waitForServer() {
  const deadline = Date.now() + startTimeoutMs;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${base}/welcome`);
      if (response.ok) {
        return;
      }
    } catch {
      await new Promise((resolve) => setTimeout(resolve, settleMs));
    }
  }
  throw new Error('Web server did not start');
}

const server = spawn('npx', ['next', 'start', '--port', String(port)], { cwd: appDir, shell: true, stdio: 'ignore' });
const errors = [];
try {
  await waitForServer();
  const browser = await chromium.launch({ channel: process.env.BROWSER_CHANNEL ?? 'msedge' });
  for (const width of widths) {
    const dir = path.join(outDir, String(width));
    fs.mkdirSync(dir, { recursive: true });
    const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 });
    page.on('console', (m) => m.type() === 'error' && errors.push(`[${width}] ${m.text()}`));
    page.on('pageerror', (e) => errors.push(`[${width}] ${e.message}`));
    const shot = async (name) => {
      await page.waitForTimeout(settleMs);
      await page.screenshot({ path: path.join(dir, `${name}.png`), fullPage: true });
    };
    await page.goto(`${base}/welcome`);
    await shot('welcome');
    await page.goto(`${base}/register`);
    await page.getByRole('button', { name: 'Create account' }).click();
    await shot('register-errors');
    await page.goto(`${base}/sign-in`);
    await page.getByLabel('Email').fill('admin@sober.com');
    await page.getByLabel('Password', { exact: true }).fill('admin@sober.com');
    await page.getByRole('button', { name: 'Sign in' }).click();
    await page.waitForURL(`${base}/`, { timeout: startTimeoutMs });
    for (const [name, route] of screens) {
      await page.goto(`${base}${route}`);
      await shot(name);
    }
    await page.close();
  }
  await browser.close();
} finally {
  server.kill();
  spawn('taskkill', ['/pid', String(server.pid), '/T', '/F'], { shell: true, stdio: 'ignore' });
}
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, 'console-errors.txt'), errors.join('\n'));
console.log(`widths: ${widths.join(', ')}, screens per width: ${screens.length + 2}, console errors: ${errors.length}`);
