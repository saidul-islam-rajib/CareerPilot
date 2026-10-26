import type { ReactNode } from 'react';
import { RefreshControl, ScrollView, View, type ViewStyle } from 'react-native';
import { SafeAreaView, useSafeAreaInsets, type Edge } from 'react-native-safe-area-context';
import { useTheme } from '@/core/theme/theme';

export interface ScreenProps {
  children: ReactNode;
  scroll?: boolean;
  refreshing?: boolean;
  onRefresh?: () => void;
  footer?: ReactNode;
  edges?: Edge[];
  contentStyle?: ViewStyle;
  testID?: string;
}

const DEFAULT_EDGES: Edge[] = ['left', 'right'];
const BOTTOM_EDGE: Edge = 'bottom';

export function Screen({ children, scroll = true, refreshing = false, onRefresh, footer, edges = DEFAULT_EDGES, contentStyle, testID }: ScreenProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const footerInset = edges.includes(BOTTOM_EDGE) ? 0 : insets.bottom;
  const inner: ViewStyle = {
    width: '100%',
    maxWidth: theme.contentMaxWidth,
    alignSelf: 'center',
    padding: theme.space.lg,
    gap: theme.space.lg,
  };
  return (
    <SafeAreaView edges={edges} style={{ flex: 1, backgroundColor: theme.colors.surface }} testID={testID}>
      {scroll ? (
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ flexGrow: 1 }}
          refreshControl={onRefresh ? <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.primary} /> : undefined}
        >
          <View style={[inner, contentStyle]}>{children}</View>
        </ScrollView>
      ) : (
        <View style={[inner, { flex: 1 }, contentStyle]}>{children}</View>
      )}
      {footer ? (
        <View
          style={{
            borderTopWidth: theme.borderWidth.hairline,
            borderTopColor: theme.colors.border,
            backgroundColor: theme.colors.background,
          }}
        >
          <View style={[inner, { paddingTop: theme.space.md, paddingBottom: theme.space.md + footerInset }]} testID="screen-footer">
            {footer}
          </View>
        </View>
      ) : null}
    </SafeAreaView>
  );
}
