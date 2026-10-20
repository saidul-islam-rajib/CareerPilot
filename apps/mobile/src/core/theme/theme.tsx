import { createContext, useContext, useMemo, type PropsWithChildren } from 'react';
import { StyleSheet } from 'react-native';
import {
  borderWidth,
  contentMaxWidth,
  fontScaleMax,
  iconStroke,
  opacity,
  zoom,
  gesture,
  breakpoints,
  fontSize,
  fontWeight,
  iconSize,
  lineHeight,
  motion,
  space,
  themes,
  touchTarget,
  type Theme,
} from '@careerpilot/ui-tokens';

export interface AppTheme extends Theme {
  space: typeof space;
  fontSize: typeof fontSize;
  lineHeight: typeof lineHeight;
  fontWeight: typeof fontWeight;
  iconSize: typeof iconSize;
  motion: typeof motion;
  touchTarget: number;
  breakpoints: typeof breakpoints;
  opacity: typeof opacity;
  iconStroke: number;
  fontScaleMax: number;
  borderWidth: typeof borderWidth;
  contentMaxWidth: number;
  zoom: typeof zoom;
  gesture: typeof gesture;
}

export function buildAppTheme(theme: Theme): AppTheme {
  return { ...theme, space, fontSize, lineHeight, fontWeight, iconSize, motion, touchTarget, breakpoints, opacity, iconStroke, fontScaleMax, borderWidth, contentMaxWidth, zoom, gesture };
}

const ThemeContext = createContext<AppTheme>(buildAppTheme(themes.sober));

export function ThemeProvider({ theme, children }: PropsWithChildren<{ theme: Theme }>) {
  const value = useMemo(() => buildAppTheme(theme), [theme]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): AppTheme {
  return useContext(ThemeContext);
}

export function makeStyles<T extends StyleSheet.NamedStyles<T>>(factory: (theme: AppTheme) => T) {
  return function useStyles(): T {
    const theme = useTheme();
    return useMemo(() => StyleSheet.create(factory(theme)), [theme]);
  };
}
