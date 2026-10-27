import { spawn, spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { createServer } from 'node:net';
import { networkInterfaces } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { loadConfig } = require('../config/load-config.js');

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const MOBILE_FOLDER = 'apps/mobile';
const PACKAGE_FILE = 'package.json';
const EXPO_CLI = 'expo/bin/cli';
const PACKAGER_HOSTNAME_ENV = 'REACT_NATIVE_PACKAGER_HOSTNAME';
const EXPO_OFFLINE_ENV = 'EXPO_OFFLINE';
const MILLISECONDS_PER_SECOND = 1000;
const POLL_INTERVAL_MS = 1000;
const SCRIPT_SOURCE = /<script[^>]+src="([^"]+)"/;
const MANIFEST_ACCEPT = 'application/expo+json,application/json';
const PORT_FLAG = '--port';
const COMPOSE_FILE_FLAG = '-f';

const { dev, http, notifications } = loadConfig(process.env.APP_ENV ?? 'local');

function includesAny(name, words) {
  const lower = name.toLowerCase();
  return words.some((word) => lower.includes(word));
}

function adapterRank(name) {
  const index = dev.preferredAdapters.findIndex((word) => name.toLowerCase().includes(word));
  return index === -1 ? dev.preferredAdapters.length : index;
}

function usableAddress(entry) {
  return entry.family === 'IPv4' && !entry.internal && !dev.ignoredAddressPrefixes.some((prefix) => entry.address.startsWith(prefix));
}

function lanAddress() {
  return Object.entries(networkInterfaces())
    .filter(([name]) => !includesAny(name, dev.ignoredAdapters))
    .flatMap(([name, entries]) => (entries ?? []).filter(usableAddress).map((entry) => ({ address: entry.address, rank: adapterRank(name) })))
    .sort((a, b) => a.rank - b.rank)[0]?.address;
}

async function reachable(url, init) {
  try {
    return (await fetch(url, init)).ok;
  } catch {
    return false;
  }
}

async function waitFor(url) {
  const deadline = Date.now() + dev.waitSeconds * MILLISECONDS_PER_SECOND;
  while (Date.now() < deadline) {
    if (await reachable(url)) {
      return true;
    }
    await delay(POLL_INTERVAL_MS);
  }
  return false;
}

function composeFileArgs() {
  return dev.composeFiles.filter((file) => existsSync(join(ROOT, file))).flatMap((file) => [COMPOSE_FILE_FLAG, file]);
}

function startApi(webAddress) {
  const env = { ...process.env, [dev.apiBindEnv]: dev.apiBindAddress, [notifications.webBaseUrlEnv]: webAddress };
  return spawnSync('docker', ['compose', ...composeFileArgs(), 'up', '-d', dev.apiService], { cwd: ROOT, stdio: 'inherit', env }).status === 0;
}

function portFree(port) {
  return new Promise((settle) => {
    const probe = createServer();
    probe.once('error', () => settle(false));
    probe.listen(port, () => probe.close(() => settle(true)));
  });
}

async function serverPort(args) {
  const requested = args.indexOf(PORT_FLAG);
  if (requested !== -1) {
    return Number(args[requested + 1]);
  }
  for (let port = dev.phoneServerPort; port < dev.phoneServerPort + dev.portSearchSpan; port += 1) {
    if (await portFree(port)) {
      return port;
    }
  }
  return dev.phoneServerPort;
}

function metroEnvironment(host, appSettings) {
  const offline = dev.expoOffline ? { [EXPO_OFFLINE_ENV]: '1' } : {};
  return { ...process.env, ...offline, ...appSettings, [PACKAGER_HOSTNAME_ENV]: host };
}

function startMetro(env, port, args) {
  const portArgs = args.includes(PORT_FLAG) ? [] : [PORT_FLAG, String(port)];
  const mobileRoot = join(ROOT, MOBILE_FOLDER);
  const expoCli = createRequire(join(mobileRoot, PACKAGE_FILE)).resolve(EXPO_CLI);
  const metro = spawn(process.execPath, [expoCli, 'start', ...portArgs, ...args], { cwd: mobileRoot, stdio: 'inherit', env });
  metro.on('exit', (code) => process.exit(code ?? 0));
}

async function download(url, init) {
  await (await fetch(url, init)).arrayBuffer();
}

async function warmBundles(serverUrl) {
  if (!(await waitFor(`${serverUrl}/status`))) {
    return;
  }
  for (const platform of dev.warmPlatforms) {
    const manifest = await (await fetch(serverUrl, { headers: { 'expo-platform': platform, accept: MANIFEST_ACCEPT } })).json();
    await download(manifest.launchAsset.url);
  }
  const page = await (await fetch(serverUrl, { headers: { accept: 'text/html' } })).text();
  const script = SCRIPT_SOURCE.exec(page)?.[1];
  if (script) {
    await download(new URL(script, serverUrl));
  }
  console.log('\nPhone app is ready: open it in Expo Go now.');
}

async function realBackend(host, serverUrl) {
  const apiUrl = `http://${host}:${http.userApiPort}`;
  if (!startApi(serverUrl)) {
    return undefined;
  }
  if (!(await waitFor(`${apiUrl}${dev.apiCheckPath}`))) {
    console.warn(`The API is not answering at ${apiUrl}. If Windows Firewall asks, allow Docker on private networks.`);
  }
  console.log(`\nReal backend: ${apiUrl} (real email). Email links open ${serverUrl}\n`);
  return { APP_ENV: dev.phoneAppEnv, [dev.apiUrlEnv]: apiUrl };
}

async function main() {
  const host = process.env[dev.phoneHostEnv] || lanAddress();
  if (!host) {
    console.error(`No Wi-Fi address found. Connect this PC to Wi-Fi, or set ${dev.phoneHostEnv} to its address.`);
    process.exit(1);
  }
  const args = process.argv.slice(2);
  const port = await serverPort(args);
  const serverUrl = `http://${host}:${port}`;
  const appSettings = await realBackend(host, serverUrl);
  if (!appSettings) {
    console.error('Docker is not running, so the API cannot start. Start Docker Desktop, then run this again.');
    process.exit(1);
  }
  startMetro(metroEnvironment(host, appSettings), port, args);
  warmBundles(serverUrl).catch(() => undefined);
}

await main();
