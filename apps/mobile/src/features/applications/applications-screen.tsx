import { useState } from 'react';
import { useApplications, useFormat, useT } from '@careerpilot/client-core';
import { useRouter } from 'expo-router';
import { View } from 'react-native';
import { ApplicationFilter, type ApplicationSummary } from '@careerpilot/api-client';
import { EnumKey } from '@careerpilot/domain-ui-logic';
import { Routes } from '@/core/navigation/routes';
import { useTheme } from '@/core/theme/theme';
import { Card, EmptyState, EnumBadge, ErrorState, LoadingState, Row, Screen, Segmented, Text, TextTone, TextVariant } from '@/ui';

function ApplicationCard({ application, onPress }: { application: ApplicationSummary; onPress: () => void }) {
  const t = useT();
  const theme = useTheme();
  const format = useFormat();
  return (
    <Card onPress={onPress} accessibilityLabel={`${application.opportunity.title}, ${application.opportunity.organization}`}>
      <View style={{ gap: theme.space.xxs }}>
        <Text variant={TextVariant.Subheading}>{application.opportunity.title}</Text>
        <Text variant={TextVariant.Label} tone={TextTone.Muted}>
          {application.opportunity.organization} · {application.opportunity.location}
        </Text>
      </View>
      <Row wrap>
        <EnumBadge enumKey={EnumKey.SubmissionStatus} value={application.submissionStatus} />
        <EnumBadge enumKey={EnumKey.OutcomeStatus} value={application.outcomeStatus} />
      </Row>
      <Text variant={TextVariant.Caption} tone={TextTone.Muted}>
        {application.appliedAt ? t('applications.appliedOn', { date: format.date(application.appliedAt) }) : t('common.updatedAt', { date: format.date(application.updatedAt) })}
        {application.lastContactAt ? ` · ${t('applications.lastContact', { date: format.date(application.lastContactAt) })}` : ''}
      </Text>
    </Card>
  );
}

export function ApplicationsScreen() {
  const t = useT();
  const router = useRouter();
  const [filter, setFilter] = useState<ApplicationFilter>(ApplicationFilter.All);
  const applications = useApplications(filter);
  const options = [
    { value: ApplicationFilter.All, label: t('applications.filterAll') },
    { value: ApplicationFilter.Active, label: t('applications.filterActive') },
    { value: ApplicationFilter.Submitted, label: t('applications.filterSubmitted') },
    { value: ApplicationFilter.Attention, label: t('applications.filterAttention') },
  ];
  return (
    <Screen refreshing={applications.isRefetching} onRefresh={() => void applications.refetch()} testID="applications-screen">
      <Segmented options={options} value={filter} onChange={setFilter} accessibilityLabel={t('applications.title')} />
      {applications.isPending ? <LoadingState /> : null}
      {applications.isError ? <ErrorState onRetry={() => void applications.refetch()} /> : null}
      {applications.isSuccess && applications.data.length === 0 ? <EmptyState title={t('applications.empty')} /> : null}
      {applications.data?.map((application) => (
        <ApplicationCard key={application.id} application={application} onPress={() => router.push(Routes.application(application.id))} />
      ))}
    </Screen>
  );
}
