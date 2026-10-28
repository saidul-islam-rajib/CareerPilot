import { useState } from 'react';
import { useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { View } from 'react-native';
import { AlertTriangle, ExternalLink, Plus, Trash2 } from '@/ui/icons';
import type { UserSource } from '@careerpilot/api-client';
import { sourceProblemKey, sourceReviewKey, useAddJobSourceForm, useFormat, useJobSources, useRemoveJobSource, useT } from '@careerpilot/client-core';
import { EnumKey, StatusTone } from '@careerpilot/domain-ui-logic';
import { Routes } from '@/core/navigation/routes';
import { useTheme } from '@/core/theme/theme';
import { Banner, Button, ButtonVariant, Card, Divider, EmptyState, EnumBadge, ErrorState, LoadingState, Row, Screen, Section, Text, TextField, TextTone, TextVariant, useSnackbar } from '@/ui';

function SourceRow({ source }: { source: UserSource }) {
  const t = useT();
  const theme = useTheme();
  const format = useFormat();
  const snackbar = useSnackbar();
  const remove = useRemoveJobSource();
  const [confirming, setConfirming] = useState(false);
  const removeNow = () => void remove.mutateAsync(source.id).then(() => snackbar.show({ message: t('sources.removed', { name: source.name }) }));
  return (
    <View style={{ gap: theme.space.xs, paddingVertical: theme.space.sm }}>
      <Text variant={TextVariant.Subheading}>{source.name}</Text>
      <Row gap={theme.space.xs} wrap>
        <EnumBadge enumKey={EnumKey.SourceReview} value={source.review} />
        <EnumBadge enumKey={EnumKey.SourceStatus} value={source.status} />
      </Row>
      <Text variant={TextVariant.Caption} tone={TextTone.Muted}>
        {t('sources.jobsFound', { count: source.jobsFound })} · {source.lastCheckedAt ? t('sources.lastChecked', { time: format.dateTime(source.lastCheckedAt) }) : t('sources.notChecked')}
      </Text>
      <Text variant={TextVariant.Caption} tone={TextTone.Muted}>
        {t(sourceReviewKey(source))}
      </Text>
      {source.reviewNote ? <Text variant={TextVariant.Caption}>{t('sources.reviewNote', { note: source.reviewNote })}</Text> : null}
      {source.lastError ? <Banner tone={StatusTone.Warning} icon={AlertTriangle} title={t(sourceProblemKey(source.lastError))} /> : null}
      <Row gap={theme.space.xs} wrap>
        <Button label={t('sources.visit')} icon={ExternalLink} variant={ButtonVariant.Ghost} onPress={() => void WebBrowser.openBrowserAsync(source.siteUrl)} testID={`source-visit-${source.id}`} />
        {confirming ? (
          <>
            <Button label={t('sources.remove')} icon={Trash2} variant={ButtonVariant.Destructive} loading={remove.isPending} onPress={removeNow} testID={`source-remove-confirm-${source.id}`} />
            <Button label={t('common.cancel')} variant={ButtonVariant.Ghost} onPress={() => setConfirming(false)} />
          </>
        ) : (
          <Button label={t('common.remove')} icon={Trash2} variant={ButtonVariant.Ghost} onPress={() => setConfirming(true)} testID={`source-remove-${source.id}`} />
        )}
      </Row>
      {confirming ? (
        <Text variant={TextVariant.Caption} tone={TextTone.Muted}>
          {t('sources.removeBody')}
        </Text>
      ) : null}
    </View>
  );
}

export function SourcesScreen() {
  const t = useT();
  const router = useRouter();
  const sources = useJobSources();
  const form = useAddJobSourceForm();
  if (sources.isPending) {
    return <LoadingState />;
  }
  if (sources.isError) {
    return <ErrorState onRetry={() => void sources.refetch()} />;
  }
  const full = sources.data.length >= form.maxSources;
  return (
    <Screen testID="sources-screen">
      <Text tone={TextTone.Muted}>{t('sources.body')}</Text>
      <Button label={t('sources.add')} icon={Plus} variant={ButtonVariant.Secondary} disabled={full} onPress={() => router.push(Routes.addSource)} testID="add-source" />
      <Section title={`${t('sources.mine')} · ${t('sources.count', { count: sources.data.length, max: form.maxSources })}`}>
        <Card>
          {sources.data.length === 0 ? (
            <EmptyState body={t('sources.empty')} />
          ) : (
            sources.data.map((source, index) => (
              <View key={source.id}>
                {index > 0 ? <Divider /> : null}
                <SourceRow source={source} />
              </View>
            ))
          )}
        </Card>
      </Section>
    </Screen>
  );
}

export function AddSourceScreen() {
  const t = useT();
  const router = useRouter();
  const snackbar = useSnackbar();
  const form = useAddJobSourceForm((source) => {
    snackbar.show({ message: t('sources.added', { name: source.name, count: source.jobsFound }) });
    router.back();
  });
  return (
    <Screen
      testID="add-source-screen"
      footer={<Button label={form.adding ? t('sources.finding') : t('sources.submit')} onPress={form.submit} loading={form.adding} fullWidth testID="source-submit" />}
    >
      <Text tone={TextTone.Muted}>{t('sources.addBody')}</Text>
      {form.formError ? <Banner tone={StatusTone.Danger} icon={AlertTriangle} title={t(form.formError)} /> : null}
      <Card>
        <TextField
          label={t('sources.url')}
          value={form.values.url}
          onChangeText={(value) => form.setField('url', value)}
          error={form.errors.url}
          hint={t('sources.urlHint')}
          keyboardType="url"
          autoCapitalize="none"
          autoCorrect={false}
          testID="source-url"
        />
        <TextField label={t('sources.name')} value={form.values.name ?? ''} maxLength={form.nameMaxLength} onChangeText={(value) => form.setField('name', value)} hint={t('sources.nameHint')} testID="source-name" />
        <TextField
          label={t('sources.note')}
          value={form.values.note ?? ''}
          maxLength={form.noteMaxLength}
          onChangeText={(value) => form.setField('note', value)}
          hint={t('sources.noteHint')}
          multiline
          testID="source-note"
        />
      </Card>
    </Screen>
  );
}
