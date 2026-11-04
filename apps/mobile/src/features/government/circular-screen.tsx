import { useState } from 'react';
import { Linking, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ApiErrorDetail, isApiError, type GovPost, type PostEligibility } from '@careerpilot/api-client';
import {
  eligibilityKey,
  eligibilityOfPost,
  enumLabelKey,
  moveItem,
  reasonKey,
  useCircular,
  useFormat,
  useGovernmentReference,
  useStartGovApplication,
  useT,
} from '@careerpilot/client-core';
import { DayKind, Eligibility, StatusTone } from '@careerpilot/domain-ui-logic';
import { useTheme } from '@/core/theme/theme';
import { Routes } from '@/core/navigation/routes';
import { Badge, Button, ButtonVariant, Card, Checkbox, ErrorState, LoadingState, Screen, Section, SnackbarTone, SortableList, Text, TextTone, TextVariant, useSnackbar } from '@/ui';

const TONES: Record<Eligibility, StatusTone> = {
  [Eligibility.Met]: StatusTone.Success,
  [Eligibility.NotMet]: StatusTone.Danger,
  [Eligibility.Unknown]: StatusTone.Neutral,
};

function PostCard({ post, eligibility, chosen, onToggle }: { post: GovPost; eligibility?: PostEligibility; chosen: boolean; onToggle: (on: boolean) => void }) {
  const t = useT();
  const theme = useTheme();
  return (
    <Card>
      <Checkbox checked={chosen} onChange={onToggle} accessibilityLabel={post.title}>
        <Text variant={TextVariant.Subheading}>{post.title}</Text>
      </Checkbox>
      <Text tone={TextTone.Muted}>
        {[
          post.grade ? t('government.circular.grade', { grade: post.grade }) : undefined,
          post.payMin !== undefined && post.payMax !== undefined ? t('government.circular.payScale', { min: post.payMin, max: post.payMax }) : undefined,
          post.vacancies !== undefined ? t('government.circular.vacancies', { count: post.vacancies }) : t('government.circular.vacanciesUnknown'),
          post.location || undefined,
        ]
          .filter(Boolean)
          .join(' · ')}
      </Text>
      {eligibility ? <Badge label={t(eligibilityKey(eligibility.overall))} tone={TONES[eligibility.overall]} /> : null}
      {eligibility?.criteria.map((criterion) => (
        <View key={`${criterion.kind}-${criterion.exam ?? ''}`} style={{ gap: theme.space.xs }}>
          <Text>
            {t(enumLabelKey('criterion_kind', criterion.kind))}: {t(reasonKey(criterion.reason))}
            {criterion.expected ? ` ${t('government.criteria.expected', { value: criterion.expected })}` : ''}
            {criterion.found ? ` ${t('government.criteria.found', { value: criterion.found })}` : ''}
          </Text>
        </View>
      ))}
      {eligibility?.quotas.length ? (
        <Text tone={TextTone.Muted}>
          {t('government.criteria.quotas')}: {eligibility.quotas.map((quota) => t(enumLabelKey('quota_kind', quota.kind))).join(', ')}
        </Text>
      ) : null}
    </Card>
  );
}

export function CircularScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const t = useT();
  const router = useRouter();
  const format = useFormat();
  const snackbar = useSnackbar();
  const view = useCircular(id);
  const currency = useGovernmentReference().data?.currency ?? '';
  const start = useStartGovApplication();
  const [chosen, setChosen] = useState<string[]>([]);

  if (view.isPending) {
    return <LoadingState />;
  }
  if (view.isError) {
    return <ErrorState onRetry={() => void view.refetch()} />;
  }
  const { circular, posts } = view.data;
  const toggle = (postId: string, on: boolean) => setChosen((current) => (on ? [...current, postId] : current.filter((value) => value !== postId)));
  const begin = () => {
    if (!chosen.length) {
      snackbar.show({ message: t('government.circular.pickOne'), tone: SnackbarTone.Danger });
      return;
    }
    start.mutate(
      { circularId: id, postIds: chosen },
      {
        onSuccess: (application) => router.push(Routes.governmentApplication(application.id)),
        onError: (error) =>
          snackbar.show({
            message: isApiError(error) && error.detail === ApiErrorDetail.AlreadyTracking ? t('government.circular.already') : t('government.errors.generic'),
            tone: SnackbarTone.Danger,
          }),
      },
    );
  };
  return (
    <Screen testID="government-circular-screen">
      <Text variant={TextVariant.Heading}>{circular.title}</Text>
      <Text tone={TextTone.Muted}>{circular.authority}</Text>
      {view.data.amended ? <Badge label={t('government.circular.amended')} tone={StatusTone.Warning} /> : null}
      {circular.liveRemoved ? <Text>{t('government.circular.liveRemoved')}</Text> : null}
      <Card>
        <Text>{circular.closesOn ? t('government.circular.closes', { date: format.date(circular.closesOn) }) : t('government.circular.closesNone')}</Text>
        {view.data.closeNote && view.data.closeNote.kind !== DayKind.Working ? (
          <Text tone={TextTone.Muted}>
            {t(`government.day.${view.data.closeNote.kind}`, { name: view.data.closeNote.holidayName })} {t('government.day.notMoved')}
          </Text>
        ) : null}
        {circular.ageCutoffOn ? <Text>{t('government.circular.cutoff', { date: format.date(circular.ageCutoffOn) })}</Text> : null}
        <Text>{circular.fee?.amount !== undefined ? t('government.circular.fee', { amount: circular.fee.amount, currency }) : t('government.circular.feeNone')}</Text>
        {circular.applyUrl ? <Button label={t('government.circular.apply')} variant={ButtonVariant.Secondary} onPress={() => void Linking.openURL(circular.applyUrl)} fullWidth /> : null}
      </Card>
      <Section title={t('government.circular.posts')}>
        <Text tone={TextTone.Muted}>{t('government.criteria.profileHint')}</Text>
        {circular.posts.map((post) => (
          <PostCard key={post.id} post={post} eligibility={eligibilityOfPost(posts, post.id)} chosen={chosen.includes(post.id)} onToggle={(on) => toggle(post.id, on)} />
        ))}
      </Section>
      {chosen.length > 1 ? (
        <Section title={t('government.circular.choosePosts')}>
          <Text tone={TextTone.Muted}>{t('government.circular.rankHint')}</Text>
          <SortableList
            items={chosen}
            keyOf={(postId) => postId}
            labelOf={(postId) => circular.posts.find((post) => post.id === postId)?.title ?? postId}
            renderItem={(postId) => <Text>{circular.posts.find((post) => post.id === postId)?.title ?? postId}</Text>}
            onReorder={(from, to) => setChosen((current) => moveItem(current, from, to))}
          />
        </Section>
      ) : null}
      {circular.notices.length ? (
        <Section title={t('government.circular.notices')}>
          <Card>
            {circular.notices.map((notice) => (
              <Text key={notice.id}>
                {t(enumLabelKey('notice_kind', notice.kind))}: {notice.title}
              </Text>
            ))}
          </Card>
        </Section>
      ) : null}
      <Button label={t('government.circular.start')} onPress={begin} loading={start.isPending} fullWidth testID="government-start" />
    </Screen>
  );
}
