export interface ValidationPolicy {
  password: {
    minLength: number;
    maxLength: number;
    requireMixedCase: boolean;
    requireDigit: boolean;
    requireSymbol: boolean;
  };
  name: {
    minLength: number;
    maxLength: number;
  };
  email: {
    maxLength: number;
  };
  answer: {
    maxLength: number;
  };
  note: {
    maxLength: number;
  };
  track: {
    minResultCount: number;
    maxResultCount: number;
  };
}

export const ValidationMessage = {
  Required: 'validation.required',
  Email: 'validation.email',
  PasswordLength: 'validation.passwordLength',
  PasswordComplexity: 'validation.passwordComplexity',
  PasswordMismatch: 'validation.passwordMismatch',
  ConsentRequired: 'validation.consentRequired',
  NameLength: 'validation.nameLength',
  Phone: 'validation.phone',
  Range: 'validation.range',
  Time: 'validation.time',
  VerificationCode: 'validation.verificationCode',
} as const;
export type ValidationMessage = (typeof ValidationMessage)[keyof typeof ValidationMessage];
