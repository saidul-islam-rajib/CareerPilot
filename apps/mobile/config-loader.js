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

module.exports = { loadConfig, deepMerge, camelize };
