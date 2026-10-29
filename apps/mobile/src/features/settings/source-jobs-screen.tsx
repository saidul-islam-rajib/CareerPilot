import { useState } from 'react';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { View } from 'react-native';
import type { SourceJob } from '@careerpilot/api-client';
import { arrangementCounts, arrangementKey, jobsIn, useFormat, useSaveSourceJob, useSourceJobs, useT } from '@careerpilot/client-core';
import type { WorkArrangement } from '@careerpilot/domain-ui-logic';
import { CalendarClock, Check, ExternalLink, MapPin, Plus } from '@/ui/icons';
import { Routes } from '@/core/navigation/routes';
import { useTheme } from '@/core/theme/theme';
import { Badge, Button, ButtonVariant, Card, Divider, EmptyState, ErrorState, Icon, IconSize, LoadingState, Row, Screen, Segmented, Text, TextTone, TextVariant, useSnackbar } from '@/ui';

const ALL = 'all';
type Filter = WorkArrangement | typeof ALL;

function JobRow({ sourceId, job }: { sourceId: string; job: SourceJob }) {
  const t = useT();
  const theme = useTheme();
  const format = useFormat();
  const router = useRouter();
  const snackbar = useSnackbar();
  const save = useSaveSourceJob(sourceId);
  const add = () =>
    save.mutate(job.id, {
      onSuccess: ({ opportunityId }) => {
        snackbar.show({ message: t('sources.jobAdded', { title: job.title }) });
        router.push(Routes.opportunity(opportunityId));
      },
    });
  return (
    <View style={{ gap: theme.space.xs, paddingVertical: theme.space.sm }}>
      <Text variant={TextVariant.Subheading}>{job.title}</Text>
      <Row gap={theme.space.xs} wrap>
        <Badge label={t(arrangementKey(job.workArrangement))} />
      </Row>
      {job.location ? (
        <Row gap={theme.space.xs}>
          <Icon icon={MapPin} size={IconSize.Small} color={theme.colors.textMuted} />
          <Text variant={TextVariant.Caption} tone={TextTone.Muted} style={{ flexShrink: 1 }}>
            {job.location}
          </Text>
        </Row>
      ) : null}
      <Row gap={theme.space.xs}>
        <Icon icon={CalendarClock} size={IconSize.Small} color={theme.colors.textMuted} />
        <Text variant={TextVariant.Caption} tone={TextTone.Muted}>
          {format.deadline(job.deadline)}
        </Text>
      </Row>
      <Row gap={theme.space.xs} wrap>
        <Button
          label={job.listed ? t('sources.listedJob') : t('sources.addJob')}
          accessibilityLabel={job.listed ? t('sources.listedJob') : t('sources.addJobLabel', { title: job.title })}
          icon={job.listed ? Check : Plus}
          variant={job.listed ? ButtonVariant.Outline : ButtonVariant.Secondary}
          disabled={job.listed}
          loading={save.isPending}
          onPress={add}
          testID={`source-job-add-${job.id}`}
        />
        <Button label={t('sources.openJob')} icon={ExternalLink} variant={ButtonVariant.Ghost} onPress={() => void WebBrowser.openBrowserAsync(job.url)} />
      </Row>
    </View>
  );
}

export function SourceJobsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const t = useT();
  const found = useSourceJobs(id);
  const [filter, setFilter] = useState<Filter>(ALL);
  if (found.isPending) {
    return <LoadingState />;
  }
  if (found.isError) {
    return <ErrorState onRetry={() => void found.refetch()} />;
  }
  const { source, jobs } = found.data;
  const shown = jobsIn(jobs, filter === ALL ? undefined : filter);
  const options = [
    { value: ALL as Filter, label: t('sources.allJobs', { count: jobs.length }) },
    ...arrangementCounts(source.arrangements).map(({ arrangement, count }) => ({
      value: arrangement as Filter,
      label: t('sources.filterCount', { label: t(arrangementKey(arrangement)), count }),
    })),
  ];
  return (
    <Screen testID="source-jobs-screen">
      <Stack.Screen options={{ title: t('sources.jobsTitle', { name: source.name }) }} />
      <Text tone={TextTone.Muted}>{t('sources.jobsBody')}</Text>
      {jobs.length === 0 ? (
        <EmptyState body={t('sources.jobsEmpty')} />
      ) : (
        <>
          <Segmented options={options} value={filter} onChange={setFilter} accessibilityLabel={t('sources.jobsFilter')} />
          <Card>
            {shown.map((job, index) => (
              <View key={job.id}>
                {index > 0 ? <Divider /> : null}
                <JobRow sourceId={source.id} job={job} />
              </View>
            ))}
          </Card>
        </>
      )}
    </Screen>
  );
}
