const fs = require('node:fs');
const path = require('node:path');
const yaml = require('js-yaml');

const CONFIG_ROOT = path.resolve(__dirname, '../../config');

function camel(key) {
  return key.replace(/_([a-z0-9])/g, (_, c) => c.toUpperCase());
}

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function camelize(value) {
  if (Array.isArray(value)) {
    return value.map(camelize);
  }
  if (isObject(value)) {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [camel(k), camelize(v)]));
  }
  return value;
}

function deepMerge(base, override) {
  const result = { ...base };
  for (const [key, value] of Object.entries(override)) {
    result[key] = isObject(result[key]) && isObject(value) ? deepMerge(result[key], value) : value;
  }
  return result;
}

function readYaml(file) {
  const parsed = yaml.load(fs.readFileSync(file, 'utf8'));
  return isObject(parsed) ? parsed : {};
}

const CLIENT_SECTIONS = ['account', 'admin', 'answers', 'api', 'branding', 'display', 'legal', 'mobile', 'openSourceComponents', 'query', 'tracking', 'ui', 'validation'];
const CLIENT_FIELDS = {
  accountLinks: ['ttlMinutes', 'minTtlMinutes', 'maxTtlMinutes'],
  notifications: ['defaultDigestTime', 'digestTimePresets'],
  profile: ['pageOrder', 'sections', 'limits', 'uploads', 'completeness'],
  verification: ['codeLength', 'codeTtlSeconds', 'resendCooldownSeconds', 'smsEnabled'],
};

function loadConfig(env, root = CONFIG_ROOT) {
  const defaultsDir = path.join(root, 'defaults');
  const merged = fs
    .readdirSync(defaultsDir)
    .filter((name) => name.endsWith('.yaml'))
    .sort()
    .reduce((acc, name) => deepMerge(acc, readYaml(path.join(defaultsDir, name))), {});
  const envFile = path.join(root, 'env', `${env}.yaml`);
  return camelize(fs.existsSync(envFile) ? deepMerge(merged, readYaml(envFile)) : merged);
}

function pickFields(value, fields) {
  return isObject(value) ? Object.fromEntries(fields.filter((field) => field in value).map((field) => [field, value[field]])) : value;
}

function clientConfig(config) {
  const whole = CLIENT_SECTIONS.filter((section) => section in config).map((section) => [section, config[section]]);
  const partial = Object.entries(CLIENT_FIELDS)
    .filter(([section]) => section in config)
    .map(([section, fields]) => [section, pickFields(config[section], fields)]);
  return Object.fromEntries([...whole, ...partial]);
}

function loadClientConfig(env, root = CONFIG_ROOT) {
  return clientConfig(loadConfig(env, root));
}

module.exports = { loadConfig, loadClientConfig, clientConfig, deepMerge, camelize };
