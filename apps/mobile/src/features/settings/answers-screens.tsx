import type { ReactNode } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Pressable, View } from 'react-native';
import { AlertTriangle, CheckCircle2, ChevronRight, Plus, Trash2 } from '@/ui/icons';
import type { QuestionGroup, SavedAnswer, SavedAnswerInput } from '@careerpilot/api-client';
import { useAnswerActions, useQuestionBank, useSavedAnswerForm, useT } from '@careerpilot/client-core';
import { AnswerTopic, EnumKey, StatusTone, enumValues, isEnumValue } from '@careerpilot/domain-ui-logic';
import { Routes } from '@/core/navigation/routes';
import { useTheme } from '@/core/theme/theme';
import { Banner, Button, ButtonVariant, Card, ChoiceList, Divider, EmptyState, EnumBadge, ErrorState, Icon, IconSize, LoadingState, Row, Screen, Section, Text, TextField, TextTone, TextVariant, useSnackbar } from '@/ui';

function GroupRow({ group }: { group: QuestionGroup }) {
  const t = useT();
  const theme = useTheme();
  const router = useRouter();
  const saved = group.savedAnswerId !== undefined;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${t('answers.saveThis')}: ${group.question}`}
      disabled={saved}
      onPress={() => router.push(Routes.answer({ topic: group.topic, question: group.question, answer: group.lastAnswer }))}
      style={{ flexDirection: 'row', alignItems: 'center', gap: theme.space.sm, paddingVertical: theme.space.sm }}
    >
      <View style={{ flex: 1, gap: theme.space.xxs }}>
        <Text variant={TextVariant.Subheading}>{group.question}</Text>
        <Row gap={theme.space.xs} wrap>
          <EnumBadge enumKey={EnumKey.AnswerTopic} value={group.topic} />
          <Text variant={TextVariant.Caption} tone={TextTone.Muted}>
            {group.count === 1 ? t('answers.askedOnce') : t('answers.askedCount', { count: group.count })}
          </Text>
        </Row>
        {group.lastAnswer ? (
          <Text variant={TextVariant.Caption} tone={TextTone.Muted}>
            {t('answers.lastAnswer', { answer: group.lastAnswer })}
          </Text>
        ) : null}
      </View>
      {saved ? <Icon icon={CheckCircle2} size={IconSize.Small} color={theme.colors.success} /> : <Icon icon={ChevronRight} color={theme.colors.textMuted} />}
    </Pressable>
  );
}

function SavedRow({ answer }: { answer: SavedAnswer }) {
  const t = useT();
  const theme = useTheme();
  const router = useRouter();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${t('answers.edit')}: ${answer.question}`}
      onPress={() => router.push(Routes.answer({ id: answer.id }))}
      style={{ flexDirection: 'row', alignItems: 'center', gap: theme.space.sm, paddingVertical: theme.space.sm }}
    >
      <View style={{ flex: 1, gap: theme.space.xxs }}>
        <EnumBadge enumKey={EnumKey.AnswerTopic} value={answer.topic} />
        <Text variant={TextVariant.Subheading}>{answer.question}</Text>
        <Text tone={TextTone.Muted}>{answer.answer}</Text>
      </View>
      <Icon icon={ChevronRight} color={theme.colors.textMuted} />
    </Pressable>
  );
}

function rows<T>(items: T[], render: (item: T) => ReactNode, keyOf: (item: T) => string) {
  return items.map((item, index) => (
    <View key={keyOf(item)}>
      {index > 0 ? <Divider /> : null}
      {render(item)}
    </View>
  ));
}

export function AnswersScreen() {
  const t = useT();
  const router = useRouter();
  const bank = useQuestionBank();
  if (bank.isPending) {
    return <LoadingState />;
  }
  if (bank.isError) {
    return <ErrorState onRetry={() => void bank.refetch()} />;
  }
  const blocking = bank.data.groups.filter((g) => g.needsAnswer);
  const asked = bank.data.groups.filter((g) => !g.needsAnswer);
  return (
    <Screen testID="answers-screen">
      <Text tone={TextTone.Muted}>{t('answers.body')}</Text>
      <Button label={t('answers.add')} icon={Plus} variant={ButtonVariant.Secondary} onPress={() => router.push(Routes.answer({}))} testID="add-answer" />
      {blocking.length > 0 ? (
        <>
          <Banner tone={StatusTone.Warning} icon={AlertTriangle} title={t('answers.needsAnswer')} body={t('answers.needsAnswerBody')} />
          <Card>{rows(blocking, (group) => <GroupRow group={group} />, (group) => group.key)}</Card>
        </>
      ) : null}
      <Section title={t('answers.saved')}>
        <Card>{bank.data.saved.length === 0 ? <EmptyState body={t('answers.savedEmpty')} /> : rows(bank.data.saved, (answer) => <SavedRow answer={answer} />, (answer) => answer.id)}</Card>
      </Section>
      <Section title={t('answers.asked')}>
        <Card>{asked.length === 0 ? <EmptyState body={t('answers.askedEmpty')} /> : rows(asked, (group) => <GroupRow group={group} />, (group) => group.key)}</Card>
      </Section>
    </Screen>
  );
}

function AnswerForm({ answer, defaults }: { answer?: SavedAnswer; defaults?: Partial<SavedAnswerInput> }) {
  const t = useT();
  const router = useRouter();
  const snackbar = useSnackbar();
  const actions = useAnswerActions();
  const form = useSavedAnswerForm({
    answer,
    defaults,
    onSaved: () => {
      snackbar.show({ message: t('answers.answerSaved') });
      router.back();
    },
  });
  const topics = enumValues(AnswerTopic).map((topic) => ({ value: topic, label: t(`enums.answer_topic.${topic}`) }));
  const remove = () =>
    answer &&
    void actions.remove.mutateAsync(answer.id).then(() => {
      snackbar.show({ message: t('answers.removed'), actionLabel: t('common.undo'), onAction: () => void actions.restore.mutateAsync(answer.id) });
      router.back();
    });
  return (
    <Screen testID="answer-screen" footer={<Button label={t('common.save')} onPress={form.submit} loading={form.saving} fullWidth testID="answer-save" />}>
      {form.formError ? <Banner tone={StatusTone.Danger} icon={AlertTriangle} title={t(form.formError)} /> : null}
      <Card>
        <TextField label={t('answers.question')} value={form.values.question} maxLength={form.limits.questionMaxLength} onChangeText={(value) => form.setField('question', value)} error={form.errors.question} testID="answer-question" />
        <TextField label={t('answers.answer')} value={form.values.answer} maxLength={form.answerMaxLength} onChangeText={(value) => form.setField('answer', value)} error={form.errors.answer} multiline testID="answer-text" />
        <ChoiceList label={t('answers.topic')} choices={topics} value={form.values.topic} onChange={form.setTopic} compact />
        {answer ? <Button label={t('common.remove')} icon={Trash2} variant={ButtonVariant.Ghost} onPress={remove} testID="answer-remove" /> : null}
      </Card>
    </Screen>
  );
}

export function AnswerScreen() {
  const params = useLocalSearchParams<{ id?: string; topic?: string; question?: string; answer?: string }>();
  const bank = useQuestionBank();
  if (bank.isPending) {
    return <LoadingState />;
  }
  if (bank.isError) {
    return <ErrorState onRetry={() => void bank.refetch()} />;
  }
  const answer = params.id ? bank.data.saved.find((a) => a.id === params.id) : undefined;
  const defaults: Partial<SavedAnswerInput> = {
    ...(isEnumValue(AnswerTopic, params.topic) ? { topic: params.topic } : {}),
    ...(params.question ? { question: params.question } : {}),
    ...(params.answer ? { answer: params.answer } : {}),
  };
  return <AnswerForm answer={answer} defaults={defaults} />;
}
