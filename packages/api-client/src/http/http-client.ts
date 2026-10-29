import { ApiError, ApiErrorCode, errorCodeForStatus, isApiError } from '../errors';

export const HttpMethod = {
  Get: 'GET',
  Post: 'POST',
  Put: 'PUT',
  Patch: 'PATCH',
  Delete: 'DELETE',
} as const;
export type HttpMethod = (typeof HttpMethod)[keyof typeof HttpMethod];

export const RequestPace = {
  Normal: 'normal',
  Long: 'long',
} as const;
export type RequestPace = (typeof RequestPace)[keyof typeof RequestPace];

export interface HttpClientOptions {
  baseUrl: string | (() => string);
  timeoutMs: number;
  uploadTimeoutMs?: number;
  fetchFn: typeof fetch;
  getAccessToken: () => string | undefined;
  onUnauthorized?: () => void;
}

export interface HttpClient {
  request<T>(method: HttpMethod, path: string, body?: unknown, pace?: RequestPace): Promise<T>;
}

const NO_CONTENT = 204;
export const TIME_ZONE_HEADER = 'X-Client-Time-Zone';

export function deviceTimeZone(): string | undefined {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || undefined;
  } catch {
    return undefined;
  }
}

interface ProblemDetails {
  code?: string;
  detail?: string;
}

function knownCode(code: string | undefined): ApiErrorCode | undefined {
  return (Object.values(ApiErrorCode) as string[]).includes(code ?? '') ? (code as ApiErrorCode) : undefined;
}

async function readProblem(response: Response): Promise<ProblemDetails> {
  try {
    return (await response.json()) as ProblemDetails;
  } catch {
    return {};
  }
}

export function createHttpClient(options: HttpClientOptions): HttpClient {
  const baseUrl = () => (typeof options.baseUrl === 'function' ? options.baseUrl() : options.baseUrl).replace(/\/+$/, '');
  const fetchFn = options.fetchFn;
  return {
    async request<T>(method: HttpMethod, path: string, body?: unknown, pace: RequestPace = RequestPace.Normal): Promise<T> {
      const isForm = typeof FormData !== 'undefined' && body instanceof FormData;
      const controller = new AbortController();
      const long = isForm || pace === RequestPace.Long;
      const timer = setTimeout(() => controller.abort(), long ? (options.uploadTimeoutMs ?? options.timeoutMs) : options.timeoutMs);
      const token = options.getAccessToken();
      const headers: Record<string, string> = { Accept: 'application/json' };
      const zone = deviceTimeZone();
      if (zone) {
        headers[TIME_ZONE_HEADER] = zone;
      }
      if (body !== undefined && !isForm) {
        headers['Content-Type'] = 'application/json';
      }
      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }
      try {
        const response = await fetchFn(`${baseUrl()}${path}`, {
          method,
          headers,
          body: body === undefined ? undefined : isForm ? (body as FormData) : JSON.stringify(body),
          signal: controller.signal,
        });
        if (!response.ok) {
          const problem = await readProblem(response);
          const code = knownCode(problem.code) ?? errorCodeForStatus(response.status);
          if (code === ApiErrorCode.Unauthorized) {
            options.onUnauthorized?.();
          }
          throw new ApiError(code, response.status, problem.detail);
        }
        return response.status === NO_CONTENT ? (undefined as T) : ((await response.json()) as T);
      } catch (error) {
        if (isApiError(error)) {
          throw error;
        }
        if (controller.signal.aborted) {
          throw new ApiError(ApiErrorCode.Timeout);
        }
        throw new ApiError(ApiErrorCode.Network, undefined, error instanceof Error ? error.message : undefined);
      } finally {
        clearTimeout(timer);
      }
    },
  };
}
