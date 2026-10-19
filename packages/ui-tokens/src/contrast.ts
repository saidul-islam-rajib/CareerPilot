const HEX_SHORT = 3;
const HEX_LONG = 6;
const CHANNEL_MAX = 255;
const LINEAR_THRESHOLD = 0.03928;
const LINEAR_DIVISOR = 12.92;
const GAMMA_OFFSET = 0.055;
const GAMMA_DIVISOR = 1.055;
const GAMMA = 2.4;
const LUMINANCE_WEIGHTS = [0.2126, 0.7152, 0.0722] as const;
const CONTRAST_OFFSET = 0.05;

export const AA_NORMAL_TEXT = 4.5;
export const AA_LARGE_TEXT = 3;

export function parseHex(hex: string): [number, number, number] {
  const body = hex.replace('#', '');
  const full = body.length === HEX_SHORT ? [...body].map((c) => c + c).join('') : body;
  if (full.length !== HEX_LONG || /[^0-9a-f]/i.test(full)) {
    throw new Error(`Invalid hex colour: ${hex}`);
  }
  const channels = [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16));
  return [channels[0] ?? 0, channels[1] ?? 0, channels[2] ?? 0];
}

export function relativeLuminance(hex: string): number {
  const linear = parseHex(hex).map((value) => {
    const c = value / CHANNEL_MAX;
    return c <= LINEAR_THRESHOLD ? c / LINEAR_DIVISOR : ((c + GAMMA_OFFSET) / GAMMA_DIVISOR) ** GAMMA;
  });
  return linear.reduce((sum, c, i) => sum + c * (LUMINANCE_WEIGHTS[i] ?? 0), 0);
}

export function contrastRatio(foreground: string, background: string): number {
  const a = relativeLuminance(foreground);
  const b = relativeLuminance(background);
  const [light, dark] = a > b ? [a, b] : [b, a];
  return (light + CONTRAST_OFFSET) / (dark + CONTRAST_OFFSET);
}
