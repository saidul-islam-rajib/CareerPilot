const { createHash } = require('node:crypto');
const { getDefaultConfig } = require('expo/metro-config');
const { loadClientConfig } = require('../../scripts/config/load-config');

const APP_ENV = process.env.APP_ENV ?? 'local';
const API_URL = process.env.CAREERPILOT_API_URL ?? '';

function appConfigFingerprint() {
  return createHash('sha256')
    .update(JSON.stringify([APP_ENV, API_URL, loadClientConfig(APP_ENV)]))
    .digest('hex');
}

const config = getDefaultConfig(__dirname);
config.cacheVersion = [config.cacheVersion, appConfigFingerprint()].filter(Boolean).join(':');

module.exports = config;
