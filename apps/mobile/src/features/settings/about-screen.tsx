import { View } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { ExternalLink } from 'lucide-react-native';
import { usePublicConfig } from '@/core/config/public-config';
import { useT } from '@/core/i18n/i18n';
import { useServices } from '@/core/services/app-services';
import { useTheme } from '@/core/theme/theme';
import { BrandLockup, Card, Divider, ListRow, Screen, TeamSoberCredit, Text, TextTone } from '@/ui';

export function AboutScreen() {
  const t = useT();
  const theme = useTheme();
  const { config } = usePublicConfig();
  const services = useServices();
  return (
    <Screen testID="about-screen">
      <Card>
        <View style={{ alignItems: 'center', gap: theme.space.md, paddingVertical: theme.space.lg }}>
          <BrandLockup size={theme.space.xxxl} />
          <Text tone={TextTone.Muted} align="center">
            {t('app.tagline')}
          </Text>
          <Text tone={TextTone.Muted}>{t('settings.version', { version: services.config.mobile.version })}</Text>
        </View>
      </Card>
      <Card>
        <TeamSoberCredit />
        <Divider />
        <ListRow icon={ExternalLink} title={t('auth.terms')} onPress={() => void WebBrowser.openBrowserAsync(config.legal.termsUrl)} />
        <ListRow icon={ExternalLink} title={t('auth.privacy')} onPress={() => void WebBrowser.openBrowserAsync(config.legal.privacyUrl)} />
      </Card>
    </Screen>
  );
}
