import { MonitorSmartphone, ShieldAlert } from 'lucide-react-native';
import { StatusTone } from '@careerpilot/domain-ui-logic';
import { useFormat } from '@/core/format/use-format';
import { useT } from '@/core/i18n/i18n';
import { Badge, Card, ErrorState, ListRow, LoadingState, Screen, Text, TextTone, TextVariant } from '@/ui';
import { useSignInActivity } from './use-settings';

export function ActivityScreen() {
  const t = useT();
  const format = useFormat();
  const activity = useSignInActivity();
  if (activity.isPending) {
    return <LoadingState />;
  }
  if (activity.isError) {
    return <ErrorState onRetry={() => void activity.refetch()} />;
  }
  return (
    <Screen testID="activity-screen">
      <Text variant={TextVariant.Caption} tone={TextTone.Muted}>
        {t('auth.consentNote')}
      </Text>
      {activity.data.map((event) => (
        <Card key={event.id}>
          <ListRow
            icon={event.success ? MonitorSmartphone : ShieldAlert}
            title={event.device}
            subtitle={`${event.approximateLocation} · ${event.ip} · ${format.dateTime(event.at)}`}
            trailing={
              event.current ? (
                <Badge label={t('activity.thisDevice')} tone={StatusTone.Primary} />
              ) : (
                <Badge label={event.success ? t('activity.success') : t('activity.failed')} tone={event.success ? StatusTone.Success : StatusTone.Danger} />
              )
            }
          />
        </Card>
      ))}
    </Screen>
  );
}
