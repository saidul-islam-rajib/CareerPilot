import { z } from 'zod';
import { ValidationMessage, type ValidationPolicy } from './policy';

const PHONE_PATTERN = /^\+[1-9]\d{6,14}$/;
const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;
const MIXED_CASE = /(?=.*[a-z])(?=.*[A-Z])/;
const DIGIT = /\d/;
const SYMBOL = /[^A-Za-z0-9]/;

function passwordSchema(policy: ValidationPolicy) {
  const p = policy.password;
  return z
    .string()
    .min(p.minLength, ValidationMessage.PasswordLength)
    .max(p.maxLength, ValidationMessage.PasswordLength)
    .refine(
      (value) =>
        (!p.requireMixedCase || MIXED_CASE.test(value)) &&
        (!p.requireDigit || DIGIT.test(value)) &&
        (!p.requireSymbol || SYMBOL.test(value)),
      ValidationMessage.PasswordComplexity,
    );
}

function emailSchema(policy: ValidationPolicy) {
  return z.string().trim().min(1, ValidationMessage.Required).max(policy.email.maxLength, ValidationMessage.Email).email(ValidationMessage.Email);
}

export function createSchemas(policy: ValidationPolicy) {
  const email = emailSchema(policy);
  const password = passwordSchema(policy);
  const fullName = z.string().trim().min(policy.name.minLength, ValidationMessage.NameLength).max(policy.name.maxLength, ValidationMessage.NameLength);

  const signIn = z.object({
    email,
    password: z.string().min(1, ValidationMessage.Required),
  });

  const register = z
    .object({
      fullName,
      email,
      password,
      confirmPassword: z.string().min(1, ValidationMessage.Required),
      consent: z.boolean().refine((value) => value, ValidationMessage.ConsentRequired),
    })
    .refine((value) => value.password === value.confirmPassword, {
      message: ValidationMessage.PasswordMismatch,
      path: ['confirmPassword'],
    });

  const forgotPassword = z.object({ email });

  const phone = z.string().trim().regex(PHONE_PATTERN, ValidationMessage.Phone);

  const answer = z.string().trim().min(1, ValidationMessage.Required).max(policy.answer.maxLength, ValidationMessage.Required);

  const resultCount = z
    .number()
    .int(ValidationMessage.Range)
    .min(policy.track.minResultCount, ValidationMessage.Range)
    .max(policy.track.maxResultCount, ValidationMessage.Range);

  const submissionWindow = z
    .object({
      start: z.string().regex(TIME_PATTERN, ValidationMessage.Time),
      end: z.string().regex(TIME_PATTERN, ValidationMessage.Time),
    });

  const changePassword = z
    .object({
      currentPassword: z.string().min(1, ValidationMessage.Required),
      newPassword: password,
      confirmPassword: z.string().min(1, ValidationMessage.Required),
    })
    .refine((value) => value.newPassword === value.confirmPassword, {
      message: ValidationMessage.PasswordMismatch,
      path: ['confirmPassword'],
    });

  const notifications = z.object({
    digestEnabled: z.boolean(),
    digestTime: z.string().regex(TIME_PATTERN, ValidationMessage.Time),
  });

  return { signIn, register, forgotPassword, email, phone, answer, resultCount, submissionWindow, changePassword, notifications };
}

export type Schemas = ReturnType<typeof createSchemas>;
export type SignInInput = z.infer<Schemas['signIn']>;
export type RegisterInput = z.infer<Schemas['register']>;
export type ForgotPasswordInput = z.infer<Schemas['forgotPassword']>;
export type ChangePasswordInput = z.infer<Schemas['changePassword']>;
export type NotificationsInput = z.infer<Schemas['notifications']>;

export interface FieldErrors {
  [field: string]: string | undefined;
}

export function toFieldErrors(error: z.ZodError): FieldErrors {
  const errors: FieldErrors = {};
  for (const issue of error.issues) {
    const field = issue.path.join('.') || 'form';
    errors[field] ??= issue.message;
  }
  return errors;
}

export type ValidationResult<T> = { ok: true; value: T } | { ok: false; errors: FieldErrors };

export function validate<T>(schema: z.ZodType<T>, input: unknown): ValidationResult<T> {
  const result = schema.safeParse(input);
  return result.success ? { ok: true, value: result.data } : { ok: false, errors: toFieldErrors(result.error) };
}
