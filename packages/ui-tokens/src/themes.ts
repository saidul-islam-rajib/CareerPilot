export const ThemeKey = {
  Sober: 'sober',
  Horizon: 'horizon',
  Orchid: 'orchid',
} as const;
export type ThemeKey = (typeof ThemeKey)[keyof typeof ThemeKey];

export const THEME_KEYS: readonly ThemeKey[] = Object.values(ThemeKey);

export interface ThemeColors {
  background: string;
  surface: string;
  card: string;
  border: string;
  input: string;
  text: string;
  textMuted: string;
  primary: string;
  primaryHover: string;
  primaryForeground: string;
  primarySubtle: string;
  accent: string;
  accentForeground: string;
  success: string;
  successSubtle: string;
  warning: string;
  warningSubtle: string;
  danger: string;
  dangerSubtle: string;
  info: string;
  infoSubtle: string;
  neutral: string;
  neutralSubtle: string;
  overlay: string;
  focusRing: string;
}

export interface ThemeRadius {
  control: number;
  card: number;
  pill: number;
}

export interface Theme {
  key: ThemeKey;
  colors: ThemeColors;
  radius: ThemeRadius;
}

const semantic = {
  success: '#15803D',
  successSubtle: '#DCFCE7',
  warning: '#B45309',
  warningSubtle: '#FEF3C7',
  danger: '#B91C1C',
  dangerSubtle: '#FEE2E2',
  info: '#0369A1',
  infoSubtle: '#E0F2FE',
  overlay: 'rgba(15, 23, 42, 0.55)',
} as const;

const PILL_RADIUS = 999;

export const themes: Readonly<Record<ThemeKey, Theme>> = {
  sober: {
    key: 'sober',
    colors: {
      ...semantic,
      background: '#FFFFFF',
      surface: '#FAFAF9',
      card: '#FFFFFF',
      border: '#E7E5E4',
      input: '#D6D3D1',
      text: '#1C1917',
      textMuted: '#57534E',
      primary: '#0F766E',
      primaryHover: '#115E59',
      primaryForeground: '#FFFFFF',
      primarySubtle: '#CCFBF1',
      accent: '#B45309',
      accentForeground: '#FFFFFF',
      neutral: '#44403C',
      neutralSubtle: '#F5F5F4',
      focusRing: '#14B8A6',
    },
    radius: { control: 8, card: 12, pill: PILL_RADIUS },
  },
  horizon: {
    key: 'horizon',
    colors: {
      ...semantic,
      background: '#FFFFFF',
      surface: '#F8FAFC',
      card: '#FFFFFF',
      border: '#E2E8F0',
      input: '#CBD5E1',
      text: '#0F172A',
      textMuted: '#475569',
      primary: '#2563EB',
      primaryHover: '#1D4ED8',
      primaryForeground: '#FFFFFF',
      primarySubtle: '#EFF6FF',
      accent: '#0369A1',
      accentForeground: '#FFFFFF',
      neutral: '#334155',
      neutralSubtle: '#F1F5F9',
      focusRing: '#60A5FA',
    },
    radius: { control: 6, card: 10, pill: PILL_RADIUS },
  },
  orchid: {
    key: 'orchid',
    colors: {
      ...semantic,
      background: '#FFFFFF',
      surface: '#FAFAFA',
      card: '#FFFFFF',
      border: '#E4E4E7',
      input: '#D4D4D8',
      text: '#18181B',
      textMuted: '#52525B',
      primary: '#6D28D9',
      primaryHover: '#5B21B6',
      primaryForeground: '#FFFFFF',
      primarySubtle: '#EDE9FE',
      accent: '#BE185D',
      accentForeground: '#FFFFFF',
      neutral: '#3F3F46',
      neutralSubtle: '#F4F4F5',
      focusRing: '#A78BFA',
    },
    radius: { control: 10, card: 16, pill: PILL_RADIUS },
  },
};

export function isThemeKey(value: unknown): value is ThemeKey {
  return typeof value === 'string' && (THEME_KEYS as readonly string[]).includes(value);
}

export function resolveTheme(key: unknown, fallback: ThemeKey): Theme {
  return themes[isThemeKey(key) ? key : fallback];
}
