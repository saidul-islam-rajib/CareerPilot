'use client';

import { Flag } from 'lucide-react';
import { useOpportunityReport, useT } from '@careerpilot/client-core';
import { ReportKind } from '@careerpilot/domain-ui-logic';
import { Button, Card, Section, SelectField, TextField } from '@careerpilot/ui-web';

export function ReportProblem({ opportunityId }: { opportunityId: string }) {
  const t = useT();
  const report = useOpportunityReport(opportunityId);
  return (
    <Section title={t('listingReports.title')}>
      <Card className="gap-3">
        <p className="text-muted">{t('listingReports.body')}</p>
        <SelectField
          label={t('listingReports.kind')}
          value={report.kind}
          options={Object.values(ReportKind).map((kind) => ({ value: kind, label: t(`listingReports.kinds.${kind}`) }))}
          onValueChange={(value) => report.setKind(value as ReportKind)}
        />
        <TextField label={t('listingReports.note')} value={report.note} onChange={(event) => report.setNote(event.target.value)} />
        {report.errorKey ? <p role="alert">{t(report.errorKey)}</p> : null}
        {report.sent && !report.errorKey ? <p role="status">{t('listingReports.sent')}</p> : null}
        <Button variant="outline" icon={Flag} loading={report.sending} onClick={report.submit}>
          {t('listingReports.send')}
        </Button>
      </Card>
    </Section>
  );
}
