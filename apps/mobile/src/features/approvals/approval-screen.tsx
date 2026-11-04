import { useState } from 'react';
import { sourceLabel, useApproval, useApprovalActions, useFormat, useT } from '@careerpilot/client-core';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { View } from 'react-native';
import { CheckCircle2, FileText, PenLine, ShieldCheck, XCircle } from '@/ui/icons';
import { ApprovalState, EnumKey, StatusTone, WritingKind } from '@careerpilot/domain-ui-logic';
import { useTheme } from '@/core/theme/theme';
import { OpportunityCard } from '@/features/opportunities/opportunity-card';
import { Routes } from '@/core/navigation/routes';
import { Badge, Banner, Button, ButtonVariant, Card, Divider, EnumBadge, ErrorState, ListRow, LoadingState, Row, Screen, Section, Text, TextTone, TextVariant } from '@/ui';
import { AnswerEditor } from './answer-editor';

export function ApprovalScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const t = useT();
  const theme = useTheme();
  const router = useRouter();
  const format = useFormat();
  const approval = useApproval(id);
  const actions = useApprovalActions(id);
  const [confirming, setConfirming] = useState(false);

  if (approval.isPending) {
    return <LoadingState />;
  }
  if (approval.isError) {
    return <ErrorState onRetry={() => void approval.refetch()} />;
  }
  const a = approval.data;
  const pending = a.state === ApprovalState.Pending;
  const unanswered = a.materials.answers.some((item) => !item.answer.trim());
  const coverLetterDraft = a.materials.writing.find((item) => item.kind === WritingKind.CoverLetter);
  const extraWriting = a.materials.writing.filter((item) => item.kind !== WritingKind.CoverLetter);
  const windowLabel = a.submissionWindowLabel ?? t('approvals.sendWindowNow');

  const footer = pending ? (
    confirming ? (
      <View style={{ gap: theme.space.sm }} accessibilityRole="alert">
        <Text variant={TextVariant.Subheading}>{t('approvals.confirmApproveTitle')}</Text>
        <Text tone={TextTone.Muted}>{t('approvals.confirmApproveBody', { employer: a.opportunity.organization })}</Text>
        <Row>
          <Button label={t('common.confirm')} icon={CheckCircle2} onPress={() => actions.approve.mutate(undefined, { onSettled: () => setConfirming(false) })} loading={actions.approve.isPending} style={{ flex: 1 }} testID="confirm-approve" />
          <Button label={t('common.cancel')} variant={ButtonVariant.Outline} onPress={() => setConfirming(false)} style={{ flex: 1 }} />
        </Row>
      </View>
    ) : (
      <View style={{ gap: theme.space.sm }}>
        {unanswered ? (
          <Text variant={TextVariant.Caption} tone={TextTone.Warning} accessibilityLiveRegion="polite">
            {t('approvals.unansweredQuestions')}
          </Text>
        ) : null}
        <Button label={t('approvals.approveAndSend')} icon={CheckCircle2} onPress={() => setConfirming(true)} disabled={unanswered} fullWidth testID="approve" />
        <Button label={t('approvals.reject')} icon={XCircle} variant={ButtonVariant.Outline} onPress={() => actions.reject.mutate()} loading={actions.reject.isPending} fullWidth testID="reject" />
      </View>
    )
  ) : undefined;

  return (
    <Screen footer={footer} testID="approval-screen">
      {a.state === ApprovalState.Approved ? (
        <Banner tone={StatusTone.Success} icon={ShieldCheck} title={t('approvals.approvedNote', { window: windowLabel })} action={<Button label={t('applications.title')} variant={ButtonVariant.Outline} onPress={() => router.push(Routes.applications)} />} />
      ) : null}
      {a.state === ApprovalState.Rejected ? <Banner tone={StatusTone.Neutral} icon={XCircle} title={t('approvals.rejectedNote')} /> : null}
      {pending ? (
        <Text variant={TextVariant.Caption} tone={TextTone.Warning}>
          {t('approvals.expiresOn', { date: format.dateTime(a.expiresAt) })}
        </Text>
      ) : null}

      <OpportunityCard opportunity={a.opportunity} onPress={() => router.push(Routes.opportunity(a.opportunity.id))} />

      <Section title={t('approvals.materials')}>
        <Card>
          <ListRow icon={FileText} title={t('approvals.cv')} subtitle={`${a.materials.cv.name} · ${t('profile.version', { version: a.materials.cv.version })}`} />
          <ListRow title={t('opportunity.route')} trailing={<EnumBadge enumKey={EnumKey.ApplicationRoute} value={a.route} />} />
          {pending ? <ListRow icon={PenLine} title={t('writing.open')} subtitle={t('writing.openHint')} onPress={() => router.push(Routes.writing(a.opportunity.id))} /> : null}
        </Card>
      </Section>

      <Section title={t('approvals.coverLetter')}>
        <Card>
          {coverLetterDraft ? (
            <Badge label={t('writing.approvalVersion', { kind: t(`writing.kinds.${coverLetterDraft.kind}`), version: coverLetterDraft.version, source: sourceLabel(t, coverLetterDraft) })} tone={StatusTone.Info} />
          ) : null}
          <Text selectable>{a.materials.coverLetter}</Text>
        </Card>
      </Section>

      {extraWriting.map((item) => (
        <Section key={item.draftId} title={t(`writing.kinds.${item.kind}`)}>
          <Card>
            <Badge label={t('writing.approvalVersion', { kind: t(`writing.kinds.${item.kind}`), version: item.version, source: sourceLabel(t, item) })} tone={StatusTone.Info} />
            <Text selectable>{item.text}</Text>
          </Card>
        </Section>
      ))}

      {a.materials.answers.length > 0 ? (
        <Section title={t('approvals.answers')}>
          <Card>
            {a.materials.answers.map((item, index) => (
              <View key={item.id}>
                {index > 0 ? <Divider /> : null}
                <AnswerEditor
                  item={item}
                  editable={pending}
                  saving={actions.updateAnswer.isPending}
                  onSave={(answer, saveForReuse) => actions.updateAnswer.mutate({ answerId: item.id, answer, saveForReuse })}
                />
              </View>
            ))}
          </Card>
        </Section>
      ) : null}
    </Screen>
  );
}
