import { describe, expect, it, vi } from 'vitest';
import { createServerAddress, normalizeServerAddress, serverAnswers, serverLabel } from './server-address';

const CURRENT = 'http://192.168.0.104:8000';

describe('normalizeServerAddress', () => {
  it('accepts just the computer address and keeps the current port', () => {
    expect(normalizeServerAddress(' 192.168.0.106 ', CURRENT)).toBe('http://192.168.0.106:8000');
    expect(normalizeServerAddress('192.168.0.106:9000', CURRENT)).toBe('http://192.168.0.106:9000');
  });

  it('keeps full addresses as typed and refuses anything else', () => {
    expect(normalizeServerAddress('https://api.example.com/', CURRENT)).toBe('https://api.example.com');
    expect(normalizeServerAddress('', CURRENT)).toBeUndefined();
    expect(normalizeServerAddress('ftp://192.168.0.106', CURRENT)).toBeUndefined();
    expect(normalizeServerAddress('not an address', CURRENT)).toBeUndefined();
  });
});

describe('server address', () => {
  it('changes at run time and shows a short label', () => {
    const server = createServerAddress(CURRENT);
    server.set('http://192.168.0.106:8000');
    expect(server.current()).toBe('http://192.168.0.106:8000');
    expect(serverLabel(server.current())).toBe('192.168.0.106:8000');
  });

  it('counts a server as answering only when its config endpoint responds', async () => {
    const ok = vi.fn(async () => new Response('{}', { status: 200 }));
    expect(await serverAnswers(CURRENT, 1000, ok as unknown as typeof fetch)).toBe(true);
    expect(ok).toHaveBeenCalledWith(`${CURRENT}/v1/config`, expect.anything());
    const down = vi.fn(async () => {
      throw new TypeError('Network request failed');
    });
    expect(await serverAnswers(CURRENT, 1000, down as unknown as typeof fetch)).toBe(false);
  });
});
