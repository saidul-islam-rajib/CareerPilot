import { describe, expect, it } from 'vitest';
import { buildRegistration, extractToken, makeTestEmail, makeTestPassword, messageSearchUrl } from './test-account.mjs';

describe('test account helpers', () => {
  it('builds addresses that stay in Mailpit', () => {
    expect(makeTestEmail('abc')).toBe('screens-abc@sober.com');
    expect(makeTestEmail()).toMatch(/^screens-[0-9a-f]+@sober\.com$/);
  });

  it('builds passwords with every required character class', () => {
    expect(makeTestPassword()).toMatch(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{12,}$/);
  });

  it('reads the token from a link in the email text', () => {
    expect(extractToken('Open http://localhost:3000/set-password?token=abc.DEF-1_2~x%2B now')).toBe('abc.DEF-1_2~x+');
    expect(extractToken('no link here')).toBeUndefined();
  });

  it('builds the registration and search request', () => {
    expect(buildRegistration('a@sober.com')).toEqual({
      fullName: 'Screen Validator',
      email: 'a@sober.com',
      consent: true,
      consentDocuments: { terms: '1.0', privacy: '1.0' },
    });
    expect(messageSearchUrl('http://m', 'a@sober.com')).toBe('http://m/api/v1/search?query=to%3Aa%40sober.com');
  });
});
