import * as WebBrowser from 'expo-web-browser';
import { Scale } from 'lucide-react-native';
import { usePublicConfig } from '@/core/config/public-config';
import { useT } from '@/core/i18n/i18n';
import { Card, ListRow, Screen, TeamSoberCredit, Text, TextTone } from '@/ui';

export function LicencesScreen() {
  const t = useT();
  const { config } = usePublicConfig();
  return (
    <Screen testID="licences-screen">
      <Text tone={TextTone.Muted}>{t('credits.licencesIntro')}</Text>
      <Card>
        {config.openSourceComponents.map((component) => (
          <ListRow
            key={component.name}
            icon={Scale}
            title={component.name}
            subtitle={component.licence}
            onPress={() => void WebBrowser.openBrowserAsync(component.url)}
          />
        ))}
      </Card>
      <TeamSoberCredit />
    </Screen>
  );
}
