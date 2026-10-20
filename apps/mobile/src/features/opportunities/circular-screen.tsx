import { useLocalSearchParams } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { Archive, ExternalLink } from 'lucide-react-native';
import { StatusTone } from '@careerpilot/domain-ui-logic';
import { useFormat } from '@/core/format/use-format';
import { useT } from '@/core/i18n/i18n';
import { Banner, Button, ButtonVariant, Card, ErrorState, LoadingState, Screen, Text } from '@/ui';
import { useOpportunity } from './use-opportunity';

export function CircularScreen() {
  const { opportunityId } = useLocalSearchParams<{ opportunityId: string }>();
  const t = useT();
  const format = useFormat();
  const opportunity = useOpportunity(opportunityId);
  if (opportunity.isPending) {
    return <LoadingState />;
  }
  if (opportunity.isError) {
    return <ErrorState onRetry={() => void opportunity.refetch()} />;
  }
  const { circular } = opportunity.data;
  return (
    <Screen testID="circular-screen">
      <Banner tone={StatusTone.Info} icon={Archive} title={t('opportunity.circularArchived', { date: format.dateTime(circular.archivedAt) })} />
      <Card>
        <Text selectable>{circular.text}</Text>
      </Card>
      <Button
        label={circular.originalUrl}
        icon={ExternalLink}
        variant={ButtonVariant.Ghost}
        onPress={() => void WebBrowser.openBrowserAsync(circular.originalUrl)}
      />
    </Screen>
  );
}
