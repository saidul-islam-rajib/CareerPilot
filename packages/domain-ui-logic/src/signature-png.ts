export interface StrokePoint {
  x: number;
  y: number;
}

export interface PadSize {
  width: number;
  height: number;
  strokeWidth: number;
}

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const CHANNELS = 4;
const ALPHA_OFFSET = 3;
const OPAQUE = 255;
const BIT_DEPTH = 8;
const COLOR_TYPE_RGBA = 6;
const MAX_STORED_BLOCK = 65535;
const ADLER_MOD = 65521;
const BYTE_MASK = 0xff;
const CRC_POLYNOMIAL = 0xedb88320;
const CRC_TABLE_SIZE = 256;
const BYTE_BITS = 8;
const ZLIB_HEADER = [0x78, 0x01];
const FILTER_NONE = 0;
const LAST_BLOCK = 1;
const NOT_LAST_BLOCK = 0;

const CRC_TABLE: number[] = Array.from({ length: CRC_TABLE_SIZE }, (_, n) => {
  let c = n;
  for (let k = 0; k < BYTE_BITS; k += 1) {
    c = c & 1 ? CRC_POLYNOMIAL ^ (c >>> 1) : c >>> 1;
  }
  return c >>> 0;
});

function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff;
  for (const byte of bytes) {
    c = (CRC_TABLE[(c ^ byte) & BYTE_MASK] ?? 0) ^ (c >>> BYTE_BITS);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function adler32(bytes: Uint8Array): number {
  let a = 1;
  let b = 0;
  for (const byte of bytes) {
    a = (a + byte) % ADLER_MOD;
    b = (b + a) % ADLER_MOD;
  }
  return ((b << 16) | a) >>> 0;
}

function word(value: number): number[] {
  return [value >>> 24, (value >>> 16) & BYTE_MASK, (value >>> 8) & BYTE_MASK, value & BYTE_MASK];
}

function chunk(type: string, data: Uint8Array): Uint8Array {
  const name = Uint8Array.from(type, (c) => c.charCodeAt(0));
  const body = new Uint8Array(name.length + data.length);
  body.set(name);
  body.set(data, name.length);
  return Uint8Array.from([...word(data.length), ...body, ...word(crc32(body))]);
}

function storedDeflate(raw: Uint8Array): number[] {
  const out: number[] = [...ZLIB_HEADER];
  for (let start = 0; start < raw.length; start += MAX_STORED_BLOCK) {
    const size = Math.min(MAX_STORED_BLOCK, raw.length - start);
    const last = start + size >= raw.length ? LAST_BLOCK : NOT_LAST_BLOCK;
    out.push(last, size & BYTE_MASK, size >>> BYTE_BITS, ~size & BYTE_MASK, (~size >>> BYTE_BITS) & BYTE_MASK);
    for (let i = start; i < start + size; i += 1) {
      out.push(raw[i] ?? 0);
    }
  }
  return [...out, ...word(adler32(raw))];
}

function stamp(alpha: Uint8Array, size: PadSize, at: StrokePoint): void {
  const radius = size.strokeWidth / 2;
  const x0 = Math.max(0, Math.floor(at.x - radius));
  const x1 = Math.min(size.width - 1, Math.ceil(at.x + radius));
  const y0 = Math.max(0, Math.floor(at.y - radius));
  const y1 = Math.min(size.height - 1, Math.ceil(at.y + radius));
  for (let y = y0; y <= y1; y += 1) {
    for (let x = x0; x <= x1; x += 1) {
      if (Math.hypot(x - at.x, y - at.y) <= radius) {
        alpha[y * size.width + x] = OPAQUE;
      }
    }
  }
}

function drawSegment(alpha: Uint8Array, size: PadSize, from: StrokePoint, to: StrokePoint): void {
  const steps = Math.max(1, Math.ceil(Math.hypot(to.x - from.x, to.y - from.y)));
  for (let i = 0; i <= steps; i += 1) {
    const t = i / steps;
    stamp(alpha, size, { x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t });
  }
}

export function rasterizeStrokes(strokes: StrokePoint[][], size: PadSize): Uint8Array {
  const alpha = new Uint8Array(size.width * size.height);
  for (const stroke of strokes) {
    const [first] = stroke;
    if (first && stroke.length === 1) {
      stamp(alpha, size, first);
    }
    for (let i = 1; i < stroke.length; i += 1) {
      const from = stroke[i - 1];
      const to = stroke[i];
      if (from && to) {
        drawSegment(alpha, size, from, to);
      }
    }
  }
  return alpha;
}

export function encodeSignaturePng(strokes: StrokePoint[][], size: PadSize): Uint8Array {
  const alpha = rasterizeStrokes(strokes, size);
  const rowBytes = size.width * CHANNELS + 1;
  const raw = new Uint8Array(rowBytes * size.height);
  for (let y = 0; y < size.height; y += 1) {
    raw[y * rowBytes] = FILTER_NONE;
    for (let x = 0; x < size.width; x += 1) {
      raw[y * rowBytes + 1 + x * CHANNELS + ALPHA_OFFSET] = alpha[y * size.width + x] ?? 0;
    }
  }
  const header = Uint8Array.from([...word(size.width), ...word(size.height), BIT_DEPTH, COLOR_TYPE_RGBA, 0, 0, 0]);
  const parts = [Uint8Array.from(PNG_SIGNATURE), chunk('IHDR', header), chunk('IDAT', Uint8Array.from(storedDeflate(raw))), chunk('IEND', new Uint8Array())];
  const png = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
  let offset = 0;
  for (const part of parts) {
    png.set(part, offset);
    offset += part.length;
  }
  return png;
}

export function hasInk(strokes: StrokePoint[][]): boolean {
  return strokes.some((stroke) => stroke.length > 0);
}
