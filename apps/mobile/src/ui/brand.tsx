import { Image } from 'expo-image';
import * as WebBrowser from 'expo-web-browser';
import { Pressable, View } from 'react-native';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { usePublicConfig } from '@/core/config/public-config';
import { useT } from '@/core/i18n/i18n';
import { useTheme } from '@/core/theme/theme';
import { Text, TextTone, TextVariant } from './text';

const teamSoberLogo = require('@careerpilot/brand/assets/team-sober-logo.png');

const MARK_VIEWBOX = '0 0 64 64';

export function BrandMark({ size }: { size: number }) {
  const theme = useTheme();
  const t = useT();
  return (
    <Svg width={size} height={size} viewBox={MARK_VIEWBOX} accessibilityLabel={t('app.name')} role="img">
      <Rect width={64} height={64} rx={16} fill={theme.colors.primary} />
      <Path d="M14 46 C 20 40, 24 38, 30 36" stroke={theme.colors.primaryForeground} strokeOpacity={theme.opacity.overlay} strokeWidth={3} strokeLinecap="round" strokeDasharray="1 6" fill="none" />
      <Path d="M24 40 L50 16 L42 46 L34 37 Z" fill={theme.colors.primaryForeground} />
      <Path d="M34 37 L50 16" stroke={theme.colors.primary} strokeWidth={2} strokeLinecap="round" />
      <Circle cx={48} cy={48} r={5} fill={theme.colors.accent} />
    </Svg>
  );
}

export function BrandLockup({ size }: { size: number }) {
  const theme = useTheme();
  const t = useT();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.space.md }}>
      <BrandMark size={size} />
      <Text variant={TextVariant.Title}>{t('app.name')}</Text>
    </View>
  );
}

export function TeamSoberCredit({ compact = false }: { compact?: boolean }) {
  const theme = useTheme();
  const t = useT();
  const { config } = usePublicConfig();
  const logoSize = compact ? theme.iconSize.lg : theme.space.xxxl;
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={`${t('credits.developedBy')}. ${t('credits.visit')}`}
      onPress={() => void WebBrowser.openBrowserAsync(config.branding.developerUrl)}
      style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: theme.space.sm, paddingVertical: theme.space.sm }}
    >
      <Image source={teamSoberLogo} style={{ width: logoSize, height: logoSize, borderRadius: logoSize / 4 }} contentFit="contain" />
      <View>
        <Text variant={compact ? TextVariant.Caption : TextVariant.Label} tone={TextTone.Muted}>
          {t('credits.developedBy')}
        </Text>
        {compact ? null : (
          <Text variant={TextVariant.Caption} tone={TextTone.Primary}>
            {t('credits.visit')}
          </Text>
        )}
      </View>
    </Pressable>
  );
}
