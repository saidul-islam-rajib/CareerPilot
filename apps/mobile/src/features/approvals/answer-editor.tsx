import { useState } from 'react';
import { useSchemas, useT } from '@careerpilot/client-core';
import { View } from 'react-native';
import { Pencil, Sparkles, UserRound } from 'lucide-react-native';
import { AnswerSource, type QuestionAnswer } from '@careerpilot/api-client';
import { StatusTone } from '@careerpilot/domain-ui-logic';
import { validate } from '@careerpilot/validation';
import { useTheme } from '@/core/theme/theme';
import { Badge, Button, ButtonVariant, Icon, IconSize, Row, Text, TextField, TextTone, TextVariant } from '@/ui';

export interface AnswerEditorProps {
  item: QuestionAnswer;
  editable: boolean;
  saving: boolean;
  onSave: (answer: string) => void;
}

export function AnswerEditor({ item, editable, saving, onSave }: AnswerEditorProps) {
  const t = useT();
  const theme = useTheme();
  const schemas = useSchemas();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(item.answer);
  const [error, setError] = useState<string>();
  const save = () => {
    const result = validate(schemas.answer, draft);
    if (!result.ok) {
      setError(result.errors.form);
      return;
    }
    onSave(result.value);
    setEditing(false);
  };
  const sourceBadge =
    item.source === AnswerSource.Ai ? (
      <Badge label={t('approvals.aiDrafted')} tone={StatusTone.Warning} />
    ) : item.source === AnswerSource.Profile ? (
      <Badge label={t('approvals.fromProfile')} tone={StatusTone.Info} />
    ) : null;
  return (
    <View style={{ gap: theme.space.sm, paddingVertical: theme.space.sm }}>
      <Row align="flex-start">
        <Icon icon={item.source === AnswerSource.Ai ? Sparkles : UserRound} size={IconSize.Small} color={theme.colors.textMuted} />
        <Text variant={TextVariant.Subheading} style={{ flex: 1 }}>
          {item.question}
        </Text>
      </Row>
      {sourceBadge}
      {editing ? (
        <>
          <TextField label={t('approvals.editAnswer')} value={draft} onChangeText={setDraft} error={error} multiline autoFocus />
          <Row>
            <Button label={t('common.save')} onPress={save} loading={saving} style={{ flex: 1 }} />
            <Button label={t('common.cancel')} variant={ButtonVariant.Outline} onPress={() => setEditing(false)} style={{ flex: 1 }} />
          </Row>
        </>
      ) : (
        <Row align="flex-start">
          <Text tone={TextTone.Default} style={{ flex: 1 }}>
            {item.answer}
          </Text>
          {editable ? <Button label={t('common.edit')} icon={Pencil} variant={ButtonVariant.Ghost} onPress={() => setEditing(true)} /> : null}
        </Row>
      )}
    </View>
  );
}
