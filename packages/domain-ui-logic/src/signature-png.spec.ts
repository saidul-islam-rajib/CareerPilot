import { describe, expect, it } from 'vitest';
import { encodeSignaturePng, hasInk, rasterizeStrokes } from './signature-png';

const SIZE = { width: 40, height: 20, strokeWidth: 3 };

describe('signature png', () => {
  it('draws strokes into the alpha channel', () => {
    const alpha = rasterizeStrokes([[{ x: 2, y: 10 }, { x: 30, y: 10 }]], SIZE);
    expect(alpha[10 * SIZE.width + 15]).toBe(255);
    expect(alpha[0]).toBe(0);
  });

  it('encodes a valid png header and trailer', () => {
    const png = encodeSignaturePng([[{ x: 5, y: 5 }]], SIZE);
    expect(Array.from(png.slice(0, 8))).toEqual([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    expect(String.fromCharCode(...png.slice(12, 16))).toBe('IHDR');
    expect(String.fromCharCode(...png.slice(-8, -4))).toBe('IEND');
  });

  it('knows when nothing was drawn', () => {
    expect(hasInk([])).toBe(false);
    expect(hasInk([[{ x: 1, y: 1 }]])).toBe(true);
  });
});
