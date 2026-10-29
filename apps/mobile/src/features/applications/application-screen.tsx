import { useState } from 'react';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useApplication, useFormat, useRecordSubmitted, useT } from '@careerpilot/client-core';
import { View } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { Archive, CircleCheckBig, ExternalLink, FileText, Mail, Pencil, ShieldCheck } from '@/ui/icons';
import { EnumKey, StatusTone, SubmissionStatus, TimelineActor } from '@careerpilot/domain-ui-logic';
import { Routes } from '@/core/navigation/routes';
import { useTheme } from '@/core/theme/theme';
import { Banner, Button, ButtonVariant, Card, Divider, EmptyState, EnumBadge, ErrorState, ListRow, LoadingState, Row, Screen, Section, Text, TextTone, TextVariant, useSnackbar } from '@/ui';
import { FollowUpsCard } from './follow-up-screens';

const KILOBYTE = 1024;

export function ApplicationScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const t = useT();
  const theme = useTheme();
  const router = useRouter();
  const format = useFormat();
  const application = useApplication(id);
  const recordSubmitted = useRecordSubmitted(id);
  const snackbar = useSnackbar();
  const [confirming, setConfirming] = useState(false);

  if (application.isPending) {
    return <LoadingState />;
  }
  if (application.isError) {
    return <ErrorState onRetry={() => void application.refetch()} />;
  }
  const a = application.data;
  const dotColor: Record<TimelineActor, string> = {
    system: theme.colors.primary,
    user: theme.colors.accent,
    employer: theme.colors.success,
    admin: theme.colors.neutral,
  };

  return (
    <>
      <Stack.Screen options={{ title: a.opportunity.organization }} />
      <Screen testID="application-screen">
        <View style={{ gap: theme.space.sm }}>
          <Text variant={TextVariant.Title}>{a.opportunity.title}</Text>
          <Text tone={TextTone.Muted}>
            {a.opportunity.organization} · {a.opportunity.location}
          </Text>
        </View>
        {a.submissionStatus === SubmissionStatus.ManualActionRequired ? (
          <Banner
            tone={StatusTone.Warning}
            icon={ExternalLink}
            title={t('applications.finishOnSite')}
            body={t('applications.finishOnSiteBody')}
            action={
              <View style={{ gap: theme.space.sm }}>
                <Button label={t('applications.openApplicationPage')} icon={ExternalLink} variant={ButtonVariant.Secondary} onPress={() => void WebBrowser.openBrowserAsync(a.circular.originalUrl)} testID="open-application-page" />
                {confirming ? (
                  <View style={{ gap: theme.space.xs }}>
                    <Text variant={TextVariant.Subheading}>{t('applications.submittedItTitle')}</Text>
                    <Text tone={TextTone.Muted}>{t('applications.submittedItBody')}</Text>
                    <Row>
                      <Button
                        label={t('applications.submittedItConfirm')}
                        icon={CircleCheckBig}
                        loading={recordSubmitted.isPending}
                        onPress={() => void recordSubmitted.mutateAsync().then(() => snackbar.show({ message: t('applications.submittedRecorded') }))}
                        style={{ flex: 1 }}
                        testID="submitted-confirm"
                      />
                      <Button label={t('common.cancel')} variant={ButtonVariant.Ghost} onPress={() => setConfirming(false)} />
                    </Row>
                  </View>
                ) : (
                  <Button label={t('applications.submittedIt')} icon={CircleCheckBig} onPress={() => setConfirming(true)} testID="submitted-it" />
                )}
              </View>
            }
          />
        ) : null}

        <Card>
          <ListRow title={t('applications.submission')} trailing={<EnumBadge enumKey={EnumKey.SubmissionStatus} value={a.submissionStatus} />} />
          <ListRow title={t('applications.outcome')} trailing={<EnumBadge enumKey={EnumKey.OutcomeStatus} value={a.outcomeStatus} />} />
          <ListRow title={t('opportunity.route')} trailing={<EnumBadge enumKey={EnumKey.ApplicationRoute} value={a.route} />} />
          {a.appliedAt ? <ListRow title={t('applications.appliedOn', { date: format.dateTime(a.appliedAt) })} /> : null}
          {a.lastContactAt ? <ListRow title={t('applications.lastContact', { date: format.date(a.lastContactAt) })} /> : null}
          <Button label={t('applications.updateOutcome')} icon={Pencil} variant={ButtonVariant.Outline} onPress={() => router.push(Routes.outcome(a.id))} testID="update-outcome" />
        </Card>

        <FollowUpsCard application={a} />

        <Section title={t('applications.timeline')}>
          <Card>
            {a.timeline.map((entry, index) => (
              <Row key={`${entry.at}-${index}`} align="flex-start">
                <View style={{ alignItems: 'center', alignSelf: 'stretch' }}>
                  <View style={{ width: theme.space.md, height: theme.space.md, borderRadius: theme.radius.pill, backgroundColor: dotColor[entry.actor], marginTop: theme.space.xs }} />
                  {index < a.timeline.length - 1 ? <View style={{ flex: 1, width: theme.borderWidth.focus, backgroundColor: theme.colors.border }} /> : null}
                </View>
                <View style={{ flex: 1, gap: theme.space.xxs, paddingBottom: theme.space.md }}>
                  <Text>{entry.text}</Text>
                  <Text variant={TextVariant.Caption} tone={TextTone.Muted}>
                    {format.dateTime(entry.at)}
                  </Text>
                  {entry.status ? <EnumBadge enumKey={EnumKey.SubmissionStatus} value={entry.status} /> : null}
                </View>
              </Row>
            ))}
          </Card>
        </Section>

        <Section title={t('applications.evidence')}>
          <Card>
            {a.evidence.length === 0 ? <Text tone={TextTone.Muted}>{t('applications.noEvidence')}</Text> : null}
            {a.evidence.map((item) => (
              <ListRow key={item.at} icon={ShieldCheck} title={item.text} subtitle={format.dateTime(item.at)} />
            ))}
          </Card>
        </Section>

        {a.questions.length > 0 ? (
          <Section title={t('applications.questions')}>
            <Card>
              {a.questions.map((qa, index) => (
                <View key={qa.id} style={{ gap: theme.space.xs, paddingVertical: theme.space.xs }}>
                  {index > 0 ? <Divider /> : null}
                  <Text variant={TextVariant.Subheading}>{qa.question}</Text>
                  <Text selectable>{qa.answer}</Text>
                </View>
              ))}
            </Card>
          </Section>
        ) : null}

        {a.emails.length > 0 ? (
          <Section title={t('applications.emails')}>
            {a.emails.map((email) => (
              <Card key={email.sentAt}>
                <ListRow icon={Mail} title={email.subject} subtitle={`${email.to} · ${format.dateTime(email.sentAt)}`} />
                <Text selectable tone={TextTone.Muted}>
                  {email.body}
                </Text>
              </Card>
            ))}
          </Section>
        ) : null}

        <Section title={t('applications.files')}>
          <Card>
            {a.files.length === 0 ? <EmptyState /> : null}
            {a.files.map((file) => (
              <ListRow
                key={file.name}
                icon={FileText}
                title={file.name}
                subtitle={`${t('profile.version', { version: file.version })}${file.sizeBytes > 0 ? ` · ${t('common.kilobytes', { value: Math.round(file.sizeBytes / KILOBYTE) })}` : ''}`}
              />
            ))}
          </Card>
        </Section>

        <Card>
          <ListRow icon={Archive} title={t('applications.circular')} subtitle={t('opportunity.circularArchived', { date: format.date(a.circular.archivedAt) })} onPress={() => router.push(Routes.circular(a.opportunity.id))} />
        </Card>
      </Screen>
    </>
  );
}
