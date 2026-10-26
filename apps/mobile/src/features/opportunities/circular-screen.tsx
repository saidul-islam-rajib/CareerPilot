import { useLocalSearchParams } from 'expo-router';
import { useFormat, useOpportunity, useT } from '@careerpilot/client-core';
import * as WebBrowser from 'expo-web-browser';
import { Archive, ExternalLink } from '@/ui/icons';
import { StatusTone } from '@careerpilot/domain-ui-logic';
import { Banner, Button, ButtonVariant, Card, ErrorState, LoadingState, Screen, Text } from '@/ui';

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
