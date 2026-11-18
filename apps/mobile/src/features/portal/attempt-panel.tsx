import { useState } from 'react';
import { useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { Routes } from '@/core/navigation/routes';
import {
  attemptCanResume,
  attemptHasProof,
  attemptStateKey,
  attemptStateTone,
  stopReasonKey,
  usePortalActions,
  usePortalAttempt,
  useT,
} from '@careerpilot/client-core';
import { Badge, Button, ButtonVariant, Card, SnackbarTone, Text, TextField, TextTone, TextVariant, useSnackbar } from '@/ui';

export function AttemptPanel({ applicationId }: { applicationId: string }) {
  const t = useT();
  const router = useRouter();
  const snackbar = useSnackbar();
  const query = usePortalAttempt(applicationId);
  const actions = usePortalActions();
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const attempt = query.data;
  if (!attempt) {
    return null;
  }
  const failed = () => snackbar.show({ message: t('portal.attempt.failed'), tone: SnackbarTone.Danger });
  const canResume = attemptCanResume(attempt);
  const typed = attempt.pending.filter((q) => answers[q.label]?.trim()).map((q) => ({ label: q.label, answer: answers[q.label].trim() }));
  return (
    <Card>
      <Text variant={TextVariant.Subheading}>{t('portal.attempt.status')}</Text>
      <Badge label={t(attemptStateKey(attempt.state))} tone={attemptStateTone(attempt.state)} />
      {attempt.stop ? (
        <Text>
          {t('portal.attempt.reason')}: {t(stopReasonKey(attempt.stop))}
        </Text>
      ) : null}
      {attemptHasProof(attempt) ? (
        <>
          <Text variant={TextVariant.Subheading}>{t('portal.attempt.proof')}</Text>
          {attempt.confirmationText ? (
            <Text>
              {t('portal.attempt.confirmationText')}: {attempt.confirmationText}
            </Text>
          ) : null}
          {attempt.finalUrl ? (
            <Text>
              {t('portal.attempt.finalUrl')}: {attempt.finalUrl}
            </Text>
          ) : null}
          {attempt.evidenceKey ? <Text tone={TextTone.Muted}>{t('portal.attempt.screenshot')}</Text> : null}
        </>
      ) : null}
      {attempt.officialUrl ? (
        <Button label={t('portal.attempt.openOfficial')} variant={ButtonVariant.Outline} onPress={() => void WebBrowser.openBrowserAsync(attempt.officialUrl)} fullWidth testID="portal-open-official" />
      ) : null}
      {attempt.officialUrl && !attempt.submitClicked ? (
        <Button label={t('portal.assist.open')} fullWidth onPress={() => router.push(Routes.assist(applicationId))} testID="portal-assist" />
      ) : null}
      {attempt.prepared.length ? <Text variant={TextVariant.Subheading}>{t('portal.attempt.prepared')}</Text> : null}
      {attempt.prepared.map((item) => (
        <Text key={item.label}>
          {item.label}: {item.value}
        </Text>
      ))}
      {attempt.submitClicked ? <Text tone={TextTone.Muted}>{t('portal.attempt.alreadySent')}</Text> : null}
      {canResume && attempt.pending.length ? <Text variant={TextVariant.Subheading}>{t('portal.attempt.pending')}</Text> : null}
      {canResume
        ? attempt.pending.map((question) => (
            <TextField key={question.label} label={question.label} value={answers[question.label] ?? ''} onChangeText={(value) => setAnswers({ ...answers, [question.label]: value })} />
          ))
        : null}
      {canResume ? (
        <Button
          label={attempt.pending.length ? t('portal.attempt.resume') : t('portal.attempt.resumeOnly')}
          onPress={() => actions.resume.mutate({ applicationId, body: { answers: typed } }, { onError: failed })}
          loading={actions.resume.isPending}
          fullWidth
          testID="portal-resume"
        />
      ) : null}
      {!attempt.submitClicked ? (
        <Button label={t('portal.attempt.markDone')} variant={ButtonVariant.Outline} onPress={() => actions.complete.mutate(applicationId, { onError: failed })} loading={actions.complete.isPending} fullWidth testID="portal-complete" />
      ) : null}
    </Card>
  );
}
