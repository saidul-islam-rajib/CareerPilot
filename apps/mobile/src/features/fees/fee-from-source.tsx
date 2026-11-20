import { FeeSourceKind, useFeeRuleFromSource, useT } from '@careerpilot/client-core';
import { Button, ButtonVariant, Card, Text, TextTone } from '@/ui';

const LABEL_KEYS: Record<FeeSourceKind, string> = {
  [FeeSourceKind.Opportunity]: 'fees.fromOpportunity',
  [FeeSourceKind.Program]: 'fees.fromProgram',
};

export function FeeFromSource({ kind, id }: { kind: FeeSourceKind; id: string }) {
  const t = useT();
  const source = useFeeRuleFromSource(kind, id);
  return (
    <Card>
      <Button label={t(LABEL_KEYS[kind])} variant={ButtonVariant.Outline} loading={source.creating} onPress={source.create} testID="fee-from-source" />
      {source.errorKey ? <Text tone={TextTone.Danger}>{t(source.errorKey)}</Text> : null}
      {source.created && !source.errorKey ? <Text tone={TextTone.Muted}>{t('fees.ruleCreated')}</Text> : null}
    </Card>
  );
}
