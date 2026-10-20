import { useLocalSearchParams, useRouter } from 'expo-router';
import { Pressable, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { RotateCcw, X, ZoomIn, ZoomOut, type LucideIcon } from 'lucide-react-native';
import { useT } from '@/core/i18n/i18n';
import { useTheme } from '@/core/theme/theme';
import { Icon, Text, TextTone, TextVariant, ZoomableImage, useZoom } from '@/ui';

function ControlButton({ icon, label, onPress }: { icon: LucideIcon; label: string; onPress: () => void }) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
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
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.overlay }} testID="viewer-screen">
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: theme.space.md }}>
        <Text variant={TextVariant.Heading} tone={TextTone.Inverse}>
          {title}
        </Text>
        <ControlButton icon={X} label={t('common.close')} onPress={() => router.back()} />
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
        </View>
      </View>
    </SafeAreaView>
  );
}
