import { useLocalSearchParams, useRouter } from 'expo-router';
import { useT } from '@careerpilot/client-core';
import { Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { RotateCcw, X, ZoomIn, ZoomOut, type LucideIcon } from '@/ui/icons';
import { useTheme } from '@/core/theme/theme';
import { Icon, Text, TextTone, TextVariant, ZoomableImage, useZoom } from '@/ui';

function ControlButton({ icon, label, onPress, testID }: { icon: LucideIcon; label: string; onPress: () => void; testID?: string }) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      hitSlop={theme.space.sm}
      testID={testID}
      style={{ width: theme.touchTarget, height: theme.touchTarget, borderRadius: theme.radius.pill, backgroundColor: theme.colors.background, alignItems: 'center', justifyContent: 'center' }}
    >
      <Icon icon={icon} color={theme.colors.text} />
    </Pressable>
  );
}

export function ViewerScreen() {
  const { uri, title } = useLocalSearchParams<{ uri: string; title: string }>();
  const t = useT();
  const theme = useTheme();
  const router = useRouter();
  const zoom = useZoom();
  const insets = useSafeAreaInsets();
  const close = () => router.back();
  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.viewerBackdrop, paddingTop: insets.top, paddingBottom: insets.bottom }} testID="viewer-screen">
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.space.md, paddingHorizontal: theme.space.md, paddingVertical: theme.space.sm }}>
        <ControlButton icon={X} label={t('common.close')} onPress={close} testID="viewer-close" />
        <Text variant={TextVariant.Heading} tone={TextTone.Inverse} style={{ flex: 1 }} numberOfLines={1}>
          {title}
        </Text>
      </View>
      <ZoomableImage uri={uri} label={title} zoom={zoom} />
      <View style={{ alignItems: 'center', gap: theme.space.sm, padding: theme.space.lg }}>
        <Text variant={TextVariant.Caption} tone={TextTone.Inverse}>
          {t('profile.pinchToZoom')}
        </Text>
        <View style={{ flexDirection: 'row', gap: theme.space.lg }}>
          <ControlButton icon={ZoomOut} label={t('profile.zoomOut')} onPress={zoom.controls.zoomOut} />
          <ControlButton icon={RotateCcw} label={t('profile.resetZoom')} onPress={zoom.controls.reset} />
          <ControlButton icon={ZoomIn} label={t('profile.zoomIn')} onPress={zoom.controls.zoomIn} />
          <ControlButton icon={X} label={t('common.close')} onPress={close} testID="viewer-close-bottom" />
        </View>
      </View>
    </View>
  );
}
