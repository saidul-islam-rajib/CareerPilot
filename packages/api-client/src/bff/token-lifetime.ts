const MS_PER_SECOND = 1000;
const PAYLOAD_INDEX = 1;

function decodePayload(token: string): Record<string, unknown> | undefined {
  const part = token.split('.')[PAYLOAD_INDEX];
  if (!part) {
    return undefined;
  }
  try {
    const base64 = part.replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(atob(base64)) as Record<string, unknown>;
  } catch {
    return undefined;
  }
}

export function secondsUntilExpiry(token: string, nowMs: number, fallbackSeconds: number): number {
  const exp = decodePayload(token)?.exp;
  if (typeof exp !== 'number') {
    return fallbackSeconds;
  }
  return Math.max(0, Math.floor(exp - nowMs / MS_PER_SECOND));
}
