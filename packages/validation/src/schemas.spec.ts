import { describe, expect, it } from 'vitest';
import { ValidationMessage, type ValidationPolicy } from './policy';
import { createSchemas, validate } from './schemas';

const policy: ValidationPolicy = {
  password: { minLength: 10, maxLength: 128, requireMixedCase: true, requireDigit: true, requireSymbol: true },
  name: { minLength: 2, maxLength: 120 },
  email: { maxLength: 254 },
  answer: { maxLength: 4000 },
  track: { minResultCount: 1, maxResultCount: 50 },
};
const schemas = createSchemas(policy);

const validRegistration = {
  fullName: 'Saidul Islam Rajib',
  email: 'user@example.com',
  password: 'Str0ng!Password',
  confirmPassword: 'Str0ng!Password',
  consent: true,
};

describe('register schema', () => {
  it('accepts a valid registration', () => {
    expect(validate(schemas.register, validRegistration).ok).toBe(true);
  });

  it('requires the consent checkbox', () => {
    const result = validate(schemas.register, { ...validRegistration, consent: false });
    expect(result).toEqual({ ok: false, errors: { consent: ValidationMessage.ConsentRequired } });
  });

  it('rejects mismatched and weak passwords', () => {
    const mismatch = validate(schemas.register, { ...validRegistration, confirmPassword: 'Other!Pass123' });
    expect(mismatch.ok ? undefined : mismatch.errors.confirmPassword).toBe(ValidationMessage.PasswordMismatch);
    const weak = validate(schemas.register, { ...validRegistration, password: 'alllowercase', confirmPassword: 'alllowercase' });
    expect(weak.ok ? undefined : weak.errors.password).toBe(ValidationMessage.PasswordComplexity);
    const short = validate(schemas.register, { ...validRegistration, password: 'S!1a', confirmPassword: 'S!1a' });
    expect(short.ok ? undefined : short.errors.password).toBe(ValidationMessage.PasswordLength);
  });

  it('follows the configured policy', () => {
    const relaxed = createSchemas({ ...policy, password: { ...policy.password, requireSymbol: false, minLength: 4 } });
    expect(validate(relaxed.register, { ...validRegistration, password: 'Abc1', confirmPassword: 'Abc1' }).ok).toBe(true);
  });
});

describe('other schemas', () => {
  it('validates sign-in email', () => {
    const result = validate(schemas.signIn, { email: 'not-an-email', password: 'x' });
    expect(result.ok ? undefined : result.errors.email).toBe(ValidationMessage.Email);
  });

  it('validates phone numbers in international format', () => {
    expect(validate(schemas.phone, '+8801712345678').ok).toBe(true);
    expect(validate(schemas.phone, '01712345678').ok).toBe(false);
  });

  it('validates result counts within configured bounds', () => {
    expect(validate(schemas.resultCount, 10).ok).toBe(true);
    expect(validate(schemas.resultCount, 51).ok).toBe(false);
  });

  it('validates submission window times', () => {
    expect(validate(schemas.submissionWindow, { start: '00:00', end: '01:30' }).ok).toBe(true);
    expect(validate(schemas.submissionWindow, { start: '24:00', end: '01:30' }).ok).toBe(false);
  });
});

describe('account schemas', () => {
  it('requires the current password and a matching strong new password', () => {
    expect(validate(schemas.changePassword, { currentPassword: '', newPassword: 'weak', confirmPassword: 'other' })).toEqual({
      ok: false,
      errors: { currentPassword: ValidationMessage.Required, newPassword: ValidationMessage.PasswordLength, confirmPassword: ValidationMessage.PasswordMismatch },
    });
    expect(validate(schemas.changePassword, { currentPassword: 'old', newPassword: 'N3w!Password99', confirmPassword: 'N3w!Password99' }).ok).toBe(true);
    expect(validate(schemas.changePassword, { currentPassword: 'old', newPassword: 'N3w!Password99', confirmPassword: 'N3w!Password98' })).toEqual({
      ok: false,
      errors: { confirmPassword: 'validation.passwordMismatch' },
    });
  });

  it('accepts times of day only', () => {
    expect(validate(schemas.notifications, { digestEnabled: true, digestTime: '07:30' }).ok).toBe(true);
    expect(validate(schemas.notifications, { digestEnabled: false, digestTime: '7pm' })).toEqual({ ok: false, errors: { digestTime: ValidationMessage.Time } });
  });
});
