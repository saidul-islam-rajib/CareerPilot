export const ApiErrorCode = {
  InvalidCredentials: 'invalid_credentials',
  EmailTaken: 'email_taken',
  Unauthorized: 'unauthorized',
  NotFound: 'not_found',
  Conflict: 'conflict',
  Validation: 'validation',
  TooManyAttempts: 'too_many_attempts',
  ServiceUnavailable: 'service_unavailable',
  Network: 'network',
  Timeout: 'timeout',
  Server: 'server',
} as const;
export type ApiErrorCode = (typeof ApiErrorCode)[keyof typeof ApiErrorCode];

export const ApiErrorDetail = {
  SourceNotConfigured: 'source_not_configured',
  LinkInvalid: 'link_invalid',
  LinkExpired: 'link_expired',
  DeliveryFailed: 'delivery_failed',
  SourceUrl: 'source_url',
  SourceConnector: 'source_connector',
  SourceExists: 'source_exists',
  CountryCode: 'country_code',
  JobsNotFound: 'jobs_not_found',
} as const;
export type ApiErrorDetail = (typeof ApiErrorDetail)[keyof typeof ApiErrorDetail];

export class ApiError extends Error {
  constructor(
    readonly code: ApiErrorCode,
    readonly status?: number,
    readonly detail?: string,
  ) {
    super(detail ?? code);
    this.name = 'ApiError';
  }
}

export function isApiError(error: unknown, code?: ApiErrorCode): error is ApiError {
  return error instanceof ApiError && (code === undefined || error.code === code);
}

const STATUS_CODES: ReadonlyArray<[number, ApiErrorCode]> = [
  [401, ApiErrorCode.Unauthorized],
  [404, ApiErrorCode.NotFound],
  [409, ApiErrorCode.Conflict],
  [422, ApiErrorCode.Validation],
  [429, ApiErrorCode.TooManyAttempts],
  [503, ApiErrorCode.ServiceUnavailable],
];

export function errorCodeForStatus(status: number): ApiErrorCode {
  return STATUS_CODES.find(([code]) => code === status)?.[1] ?? ApiErrorCode.Server;
}
