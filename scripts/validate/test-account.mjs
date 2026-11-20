import { randomBytes } from 'node:crypto';

const TEST_DOMAIN = 'sober.com';
const TOKEN_PATTERN = /[?&]token=([A-Za-z0-9._~%-]+)/;
const PASSWORD_PREFIX = 'Aa1!';
const CONSENT_VERSION = '1.0';

export function makeTestEmail(suffix = randomBytes(5).toString('hex')) {
  return `screens-${suffix}@${TEST_DOMAIN}`;
}

export function makeTestPassword(suffix = randomBytes(8).toString('hex')) {
  return `${PASSWORD_PREFIX}${suffix}`;
}

export function extractToken(text) {
  const found = TOKEN_PATTERN.exec(text);
  return found ? decodeURIComponent(found[1]) : undefined;
}

export function buildRegistration(email, versions = { terms: CONSENT_VERSION, privacy: CONSENT_VERSION }) {
  return { fullName: 'Screen Validator', email, consent: true, consentDocuments: versions };
}

export function messageSearchUrl(mailpitBase, email) {
  return `${mailpitBase}/api/v1/search?query=${encodeURIComponent(`to:${email}`)}`;
}

async function postJson(url, body) {
  const response = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  if (!response.ok) {
    throw new Error(`${url} answered ${response.status}`);
  }
}

async function waitForToken(mailpitBase, email, timeoutMs, intervalMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const search = await (await fetch(messageSearchUrl(mailpitBase, email))).json();
    const first = search.messages?.[0];
    if (first) {
      const message = await (await fetch(`${mailpitBase}/api/v1/message/${first.ID}`)).json();
      const token = extractToken(`${message.Text ?? ''} ${message.HTML ?? ''}`);
      if (token) {
        return token;
      }
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
  throw new Error(`No account email arrived in Mailpit for ${email}`);
}

export async function createTestAccount({
  apiBase = process.env.VALIDATION_API_URL ?? 'http://localhost:8000/v1',
  mailpitBase = process.env.VALIDATION_MAILPIT_URL ?? 'http://localhost:8025',
  timeoutMs = 20000,
  intervalMs = 500,
} = {}) {
  const email = makeTestEmail();
  const password = makeTestPassword();
  await postJson(`${apiBase}/auth/register`, buildRegistration(email));
  const token = await waitForToken(mailpitBase, email, timeoutMs, intervalMs);
  await postJson(`${apiBase}/auth/account-links/complete`, { token, password });
  return { email, password };
}
