import * as WebBrowser from 'expo-web-browser';
import { usePublicConfig, useT } from '@careerpilot/client-core';
import { Scale } from 'lucide-react-native';
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
