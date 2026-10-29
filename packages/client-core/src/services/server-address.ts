export const SERVER_ADDRESS_KEY = 'careerpilot.server';
const DEFAULT_SCHEME = 'http://';
const SCHEME_MARK = '://';
const HEALTH_PATH = '/v1/config';

export interface ServerAddress {
  current(): string;
  set(address: string): void;
}

export function createServerAddress(initial: string): ServerAddress {
  let value = initial;
  return {
    current: () => value,
    set: (address) => {
      value = address;
    },
  };
}

export function normalizeServerAddress(typed: string, fallback: string): string | undefined {
  const trimmed = typed.trim();
  if (!trimmed) {
    return undefined;
  }
  try {
    const url = new URL(trimmed.includes(SCHEME_MARK) ? trimmed : `${DEFAULT_SCHEME}${trimmed}`);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      return undefined;
    }
    const port = url.port || (trimmed.includes(SCHEME_MARK) ? '' : new URL(fallback).port);
    return `${url.protocol}//${url.hostname}${port ? `:${port}` : ''}`;
  } catch {
    return undefined;
  }
}

export function serverLabel(address: string): string {
  try {
    return new URL(address).host;
  } catch {
    return address;
  }
}

export async function serverAnswers(address: string, timeoutMs: number, fetchFn: typeof fetch = fetch): Promise<boolean> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchFn(`${address}${HEALTH_PATH}`, { signal: controller.signal });
    return response.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

export const ServerChange = {
  Invalid: 'invalid',
  Unreachable: 'unreachable',
} as const;
export type ServerChange = (typeof ServerChange)[keyof typeof ServerChange];
