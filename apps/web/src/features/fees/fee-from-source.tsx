'use client';

import { ReceiptText } from 'lucide-react';
import { FeeSourceKind, useFeeRuleFromSource, useT } from '@careerpilot/client-core';
import { Button, Card } from '@careerpilot/ui-web';

const LABEL_KEYS: Record<FeeSourceKind, string> = {
  [FeeSourceKind.Opportunity]: 'fees.fromOpportunity',
  [FeeSourceKind.Program]: 'fees.fromProgram',
};

export function FeeFromSource({ kind, id }: { kind: FeeSourceKind; id: string }) {
  const t = useT();
  const source = useFeeRuleFromSource(kind, id);
  return (
    <Card className="gap-2">
      <Button variant="outline" icon={ReceiptText} loading={source.creating} onClick={source.create}>
        {t(LABEL_KEYS[kind])}
      </Button>
      {source.errorKey ? <p role="alert">{t(source.errorKey)}</p> : null}
      {source.created && !source.errorKey ? <p role="status">{t('fees.ruleCreated')}</p> : null}
    </Card>
  );
}
