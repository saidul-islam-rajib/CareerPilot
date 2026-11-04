import { useState } from 'react';
import { View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import {
  issueMessage,
  KIND_ORDER,
  sourceLabel,
  useApprovals,
  useDrafts,
  useFormat,
  useOpportunity,
  useT,
  useWritingActions,
  useWritingStatus,
  versionsOf,
  writingErrorKey,
} from '@careerpilot/client-core';
import type { WritingDraft } from '@careerpilot/api-client';
import { DraftStatus, IssueKind, StatusTone, WritingKind, WritingTone } from '@careerpilot/domain-ui-logic';
import { useTheme } from '@/core/theme/theme';
import { AlertTriangle, CheckCircle2, Eraser, FilePlus, Link2Off, PenLine, RefreshCw, Save, Sparkles, Trash2 } from '@/ui/icons';
import {
  Badge,
  Banner,
  Button,
  ButtonVariant,
  Card,
  ErrorState,
  LoadingState,
  Screen,
  Section,
  Segmented,
  Text,
  TextField,
  TextTone,
  TextVariant,
} from '@/ui';

const FLAGGED_KINDS: readonly IssueKind[] = [IssueKind.UnsupportedClaim, IssueKind.OtherEmployer];
const EDITOR_LINES = 12;

interface EditorProps {
  draft: WritingDraft;
  approvalId?: string;
  opportunityId: string;
  onSelect: (id: string) => void;
}

function DraftEditor({ draft, approvalId, opportunityId, onSelect }: EditorProps) {
  const t = useT();
  const theme = useTheme();
  const format = useFormat();
  const actions = useWritingActions(opportunityId);
  const [text, setText] = useState(draft.text);
  const [confirmingRemove, setConfirmingRemove] = useState(false);
  const changed = text.trim() !== draft.text.trim();
  const attached = approvalId ? draft.attachedApprovalIds.includes(approvalId) : false;
  const failure = [actions.edit, actions.attach, actions.detach, actions.recheck, actions.stripFlagged, actions.remove].find((m) => m.isError)?.error;
  const flagged = draft.issues.some((issue) => FLAGGED_KINDS.includes(issue.kind));
  return (
    <Card testID="draft-editor">
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: theme.space.sm }}>
        <Text variant={TextVariant.Subheading}>{t('writing.version', { version: draft.version })}</Text>
        <Badge label={sourceLabel(t, draft)} tone={StatusTone.Info} />
        <Badge label={t('writing.wordCount', { count: draft.wordCount })} tone={StatusTone.Neutral} />
        {attached ? <Badge label={t('writing.attached')} tone={StatusTone.Success} /> : null}
      </View>
      <Text variant={TextVariant.Caption} tone={TextTone.Muted}>
        {format.dateTime(draft.createdAt)}
      </Text>
      {failure ? <Banner tone={StatusTone.Danger} icon={AlertTriangle} title={t(writingErrorKey(failure))} /> : null}
      <TextField label={t('writing.textLabel')} value={text} onChangeText={setText} multiline numberOfLines={EDITOR_LINES} textAlignVertical="top" />
      <View style={{ gap: theme.space.sm }}>
        <Button
          label={actions.edit.isPending ? t('writing.saving') : t('writing.saveVersion')}
          icon={Save}
          variant={ButtonVariant.Secondary}
          disabled={!changed}
          loading={actions.edit.isPending}
          onPress={() => actions.edit.mutate({ id: draft.id, text }, { onSuccess: (next) => onSelect(next.id) })}
          testID="save-version"
        />
        {approvalId && !attached ? (
          <Button
            label={t('writing.attach')}
            icon={FilePlus}
            disabled={changed || draft.status !== DraftStatus.Ready}
            loading={actions.attach.isPending}
            onPress={() => actions.attach.mutate({ id: draft.id, approvalId })}
            testID="attach-draft"
          />
        ) : null}
        {approvalId && attached ? (
          <Button label={t('writing.detach')} icon={Link2Off} variant={ButtonVariant.Outline} loading={actions.detach.isPending} onPress={() => actions.detach.mutate({ id: draft.id, approvalId })} />
        ) : null}
        <Button label={t('writing.recheck')} icon={RefreshCw} variant={ButtonVariant.Outline} loading={actions.recheck.isPending} onPress={() => actions.recheck.mutate(draft.id)} />
        {confirmingRemove ? (
          <View style={{ gap: theme.space.sm }} accessibilityRole="alert">
            <Text tone={TextTone.Muted}>{t('writing.removeConfirm')}</Text>
            <Button label={t('common.delete')} icon={Trash2} variant={ButtonVariant.Destructive} onPress={() => actions.remove.mutate(draft.id)} loading={actions.remove.isPending} testID="confirm-remove" />
            <Button label={t('common.cancel')} variant={ButtonVariant.Outline} onPress={() => setConfirmingRemove(false)} />
          </View>
        ) : (
          <Button label={t('writing.remove')} icon={Trash2} variant={ButtonVariant.Outline} onPress={() => setConfirmingRemove(true)} testID="remove-draft" />
        )}
      </View>
      <Section title={t('writing.checksHeading')}>
        {draft.issues.length === 0 ? (
          <Banner tone={StatusTone.Success} icon={CheckCircle2} title={t('writing.checksPassed')} />
        ) : (
          <View style={{ gap: theme.space.sm }}>
            <Banner tone={StatusTone.Warning} icon={AlertTriangle} title={t('writing.checksFailed')} />
            {draft.issues.map((issue, index) => (
              <Card key={`${issue.kind}-${index}`}>
                <Text>{issueMessage(t, issue)}</Text>
              </Card>
            ))}
            {flagged ? (
              <Button
                label={t('writing.removeFlagged')}
                icon={Eraser}
                variant={ButtonVariant.Secondary}
                loading={actions.stripFlagged.isPending}
                onPress={() => actions.stripFlagged.mutate(draft.id, { onSuccess: (next) => onSelect(next.id) })}
                testID="strip-flagged"
              />
            ) : null}
          </View>
        )}
      </Section>
      <Section title={t('writing.factsHeading')}>
        {draft.factsUsed.length === 0 ? (
          <Text tone={TextTone.Muted}>{t('writing.noFacts')}</Text>
        ) : (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.space.sm }}>
            {draft.factsUsed.map((fact) => (
              <Badge key={fact.id} label={fact.label} tone={StatusTone.Neutral} />
            ))}
          </View>
        )}
      </Section>
    </Card>
  );
}

export function WritingScreen() {
  const { opportunityId } = useLocalSearchParams<{ opportunityId: string }>();
  const t = useT();
  const theme = useTheme();
  const format = useFormat();
  const opportunity = useOpportunity(opportunityId);
  const status = useWritingStatus();
  const drafts = useDrafts(opportunityId);
  const approvals = useApprovals();
  const actions = useWritingActions(opportunityId);
  const [kind, setKind] = useState<WritingKind>(WritingKind.CoverLetter);
  const [tone, setTone] = useState<WritingTone>(WritingTone.Professional);
  const [words, setWords] = useState('');
  const [instructions, setInstructions] = useState('');
  const [selected, setSelected] = useState<string | undefined>(undefined);

  if (opportunity.isPending || status.isPending || drafts.isPending) {
    return <LoadingState />;
  }
  if (opportunity.isError || status.isError || drafts.isError) {
    return <ErrorState onRetry={() => void Promise.all([opportunity.refetch(), status.refetch(), drafts.refetch()])} />;
  }
  const o = opportunity.data;
  const rule = status.data.kinds.find((item) => item.kind === kind);
  const versions = versionsOf(drafts.data, kind);
  const current = versions.find((draft) => draft.id === selected) ?? versions[0];
  const approvalId = approvals.data?.find((approval) => approval.opportunity.id === opportunityId)?.id;
  const requestedWords = Number(words);

  return (
    <Screen testID="writing-screen">
      <Text variant={TextVariant.Heading}>{t('writing.title')}</Text>
      <Text tone={TextTone.Muted}>{t('writing.opportunityHeading', { title: o.title, organization: o.organization })}</Text>
      {status.data.aiConfigured ? (
        <Banner tone={StatusTone.Info} icon={Sparkles} title={t('writing.aiConfigured', { model: status.data.model ?? '' })} />
      ) : (
        <Banner tone={StatusTone.Warning} icon={AlertTriangle} title={t('writing.aiNotConfigured')} />
      )}
      {approvals.isSuccess && !approvalId ? <Banner tone={StatusTone.Neutral} icon={AlertTriangle} title={t('writing.noPendingApplication')} /> : null}
      <Segmented
        accessibilityLabel={t('writing.kindLabel')}
        value={kind}
        onChange={(next) => {
          setKind(next);
          setSelected(undefined);
          setWords('');
        }}
        options={KIND_ORDER.map((value) => {
          const item = status.data.kinds.find((k) => k.kind === value);
          return { value, label: item && !item.available ? `${t(`writing.kinds.${value}`)} · ${t('writing.needsAi')}` : t(`writing.kinds.${value}`) };
        })}
      />
      <Card>
        <Segmented
          accessibilityLabel={t('writing.toneLabel')}
          value={tone}
          onChange={setTone}
          options={status.data.tones.map((value) => ({ value, label: t(`writing.tones.${value}`) }))}
        />
        <TextField
          label={t('writing.wordsLabel')}
          keyboardType="number-pad"
          placeholder={rule ? String(rule.defaultWords) : undefined}
          value={words}
          onChangeText={setWords}
        />
        <TextField
          label={t('writing.instructionsLabel')}
          hint={t('writing.instructionsHint')}
          value={instructions}
          maxLength={status.data.maxInstructionChars}
          onChangeText={setInstructions}
          multiline
          numberOfLines={3}
          textAlignVertical="top"
        />
        {rule && !rule.available ? <Banner tone={StatusTone.Warning} icon={AlertTriangle} title={t('writing.aiOnlyUnavailable')} /> : null}
        {actions.generate.isError ? <Banner tone={StatusTone.Danger} icon={AlertTriangle} title={t(writingErrorKey(actions.generate.error))} /> : null}
        <Button
          label={actions.generate.isPending ? t('writing.generating') : t('writing.generate')}
          icon={PenLine}
          disabled={!rule?.available}
          loading={actions.generate.isPending}
          onPress={() =>
            actions.generate.mutate(
              { kind, tone, maxWords: requestedWords > 0 ? requestedWords : undefined, instructions: instructions.trim() || undefined },
              { onSuccess: (draft) => setSelected(draft.id) },
            )
          }
          testID="generate-draft"
        />
      </Card>
      <Section title={t('writing.draftsHeading')}>
        {versions.length === 0 ? (
          <Text tone={TextTone.Muted}>{t('writing.noDrafts')}</Text>
        ) : (
          <View style={{ gap: theme.space.md }}>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.space.sm }} accessibilityLabel={t('writing.versionsHeading')}>
              {versions.map((draft) => (
                <Button
                  key={draft.id}
                  label={`${t('writing.version', { version: draft.version })} · ${format.dateTime(draft.createdAt)}`}
                  variant={draft.id === current?.id ? ButtonVariant.Secondary : ButtonVariant.Outline}
                  onPress={() => setSelected(draft.id)}
                />
              ))}
            </View>
            {current ? <DraftEditor key={current.id} draft={current} approvalId={approvalId} opportunityId={opportunityId} onSelect={setSelected} /> : null}
          </View>
        )}
      </Section>
    </Screen>
  );
}
