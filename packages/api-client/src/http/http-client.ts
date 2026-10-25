import { ApiError, ApiErrorCode, errorCodeForStatus, isApiError } from '../errors';

export const HttpMethod = {
  Get: 'GET',
  Post: 'POST',
  Put: 'PUT',
  Patch: 'PATCH',
  Delete: 'DELETE',
} as const;
export type HttpMethod = (typeof HttpMethod)[keyof typeof HttpMethod];

export interface HttpClientOptions {
  baseUrl: string;
  timeoutMs: number;
  uploadTimeoutMs?: number;
  fetchFn: typeof fetch;
  getAccessToken: () => string | undefined;
  onUnauthorized?: () => void;
}

export interface HttpClient {
  request<T>(method: HttpMethod, path: string, body?: unknown): Promise<T>;
}

const NO_CONTENT = 204;

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
  const baseUrl = options.baseUrl.replace(/\/+$/, '');
  const fetchFn = options.fetchFn;
  return {
    async request<T>(method: HttpMethod, path: string, body?: unknown): Promise<T> {
      const isForm = typeof FormData !== 'undefined' && body instanceof FormData;
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), isForm ? (options.uploadTimeoutMs ?? options.timeoutMs) : options.timeoutMs);
      const token = options.getAccessToken();
      const headers: Record<string, string> = { Accept: 'application/json' };
      if (body !== undefined && !isForm) {
        headers['Content-Type'] = 'application/json';
      }
      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }
      try {
        const response = await fetchFn(`${baseUrl}${path}`, {
          method,
          headers,
          body: body === undefined ? undefined : isForm ? (body as FormData) : JSON.stringify(body),
          signal: controller.signal,
        });
        if (!response.ok) {
          const problem = await readProblem(response);
          if (response.status === 401) {
            options.onUnauthorized?.();
          }
          throw new ApiError(knownCode(problem.code) ?? errorCodeForStatus(response.status), response.status, problem.detail);
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
