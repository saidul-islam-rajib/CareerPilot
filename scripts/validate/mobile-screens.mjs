import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright-core';

const root = path.resolve(process.argv[2] ?? 'apps/mobile/dist');
const outDir = path.resolve(process.argv[3] ?? '.validation/mobile');
const port = Number(process.env.VALIDATION_PORT ?? 4310);
const viewport = { width: Number(process.env.VIEWPORT_WIDTH ?? 390), height: Number(process.env.VIEWPORT_HEIGHT ?? 844) };
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.ico': 'image/x-icon', '.json': 'application/json', '.ttf': 'font/ttf' };

const server = http.createServer((req, res) => {
  const url = decodeURIComponent((req.url ?? '/').split('?')[0]);
  let file = path.join(root, url);
  if (!file.startsWith(root) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    file = path.join(root, 'index.html');
  }
  res.writeHead(200, { 'Content-Type': types[path.extname(file)] ?? 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
});

const screens = [
  ['home', '/'],
  ['approvals', '/approvals'],
  ['approval-detail', '/approval/apr_frontend'],
  ['applications', '/applications'],
  ['application-record', '/application/app_bay'],
  ['opportunity', '/opportunity/opp_remote_frontend'],
  ['opportunity-hard-failure', '/opportunity/opp_gov_programmer'],
  ['circular', '/circular/opp_bd_dhaka'],
  ['profile', '/profile'],
  ['more', '/more'],
  ['tracks', '/settings/tracks'],
  ['pause', '/settings/pause'],
  ['window', '/settings/window'],
  ['activity', '/settings/activity'],
  ['about', '/settings/about'],
  ['licences', '/settings/licences'],
  ['delete-account', '/settings/delete-account'],
];

await new Promise((resolve) => server.listen(port, resolve));
fs.mkdirSync(outDir, { recursive: true });
const browser = await chromium.launch({ channel: process.env.BROWSER_CHANNEL ?? 'msedge' });
const page = await browser.newPage({ viewport, deviceScaleFactor: 2 });
const errors = [];
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
page.on('pageerror', (e) => errors.push(e.message));
const base = `http://localhost:${port}`;
const shot = async (name) => {
  await page.waitForTimeout(Number(process.env.SETTLE_MS ?? 1200));
  await page.screenshot({ path: path.join(outDir, `${name}.png`), fullPage: true });
};

await page.goto(`${base}/welcome`);
await shot('welcome');
await page.goto(`${base}/register`);
await page.getByTestId('register-submit').click();
await shot('register-errors');
await page.goto(`${base}/sign-in`);
await page.getByTestId('sign-in-email').fill('admin@sober.com');
await page.getByTestId('sign-in-password').fill('admin@sober.com');
await page.getByTestId('sign-in-submit').click();
await page.waitForSelector('[data-testid="home-screen"]', { timeout: 15000 });
for (const [name, route] of screens) {
  await page.goto(`${base}${route}`);
  await shot(name);
}
await browser.close();
server.close();
fs.writeFileSync(path.join(outDir, 'console-errors.txt'), errors.join('\n'));
console.log(`screens: ${screens.length + 2}, console errors: ${errors.length}`);
