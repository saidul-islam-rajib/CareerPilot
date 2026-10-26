export const space = {
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
} as const;
export type SpaceKey = keyof typeof space;

export const fontSize = {
  xs: 12,
  sm: 14,
  md: 16,
  lg: 18,
  xl: 20,
  xxl: 24,
  display: 30,
} as const;
export type FontSizeKey = keyof typeof fontSize;

export const lineHeight = {
  xs: 16,
  sm: 20,
  md: 24,
  lg: 26,
  xl: 28,
  xxl: 32,
  display: 38,
} as const satisfies Record<FontSizeKey, number>;

export const fontWeight = {
  regular: '400',
  medium: '500',
  semibold: '600',
  bold: '700',
} as const;
export type FontWeightKey = keyof typeof fontWeight;

export const iconSize = { sm: 16, md: 20, lg: 24 } as const;

export const motion = { fastMs: 150, normalMs: 250 } as const;

export const touchTarget = 44;

export const breakpoints = { sm: 360, md: 600, lg: 900, xl: 1200 } as const;

export const fontFamily = {
  ui: 'Inter',
  bangla: 'Noto Sans Bengali',
} as const;

export const opacity = { disabled: 0.6, overlay: 0.55 } as const;

export const iconStroke = 2;

export const fontScaleMax = 2;

export const borderWidth = { hairline: 1, focus: 2 } as const;

export const contentMaxWidth = 720;

export const zoom = { min: 1, max: 5, step: 1, doubleTap: 2.5 } as const;
export const photoCrop = { sliderStep: 0.01, buttonStep: 0.25, nudge: 0.02, wheelStep: 0.0015 } as const;

export const gesture = { longPressMs: 250, dragScale: 1.02, dragElevation: 6 } as const;

export const feedback = { toastMs: 5000, undoToastMs: 8000, maxToasts: 3 } as const;

export const ring = { size: 120, stroke: 10 } as const;
