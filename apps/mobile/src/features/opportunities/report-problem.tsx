import { useOpportunityReport, useT } from '@careerpilot/client-core';
import { ReportKind } from '@careerpilot/domain-ui-logic';
import { Flag } from '@/ui/icons';
import { Button, ButtonVariant, Card, Section, SelectField, Text, TextField, TextTone } from '@/ui';

export function ReportProblem({ opportunityId }: { opportunityId: string }) {
  const t = useT();
  const report = useOpportunityReport(opportunityId);
  return (
    <Section title={t('listingReports.title')}>
      <Card>
        <Text tone={TextTone.Muted}>{t('listingReports.body')}</Text>
        <SelectField
          label={t('listingReports.kind')}
          value={report.kind}
          placeholder={t('listingReports.kind')}
          options={Object.values(ReportKind).map((kind) => ({ value: kind, label: t(`listingReports.kinds.${kind}`) }))}
          onChange={(value) => report.setKind(value as ReportKind)}
        />
        <TextField label={t('listingReports.note')} value={report.note} onChangeText={report.setNote} />
        {report.errorKey ? <Text tone={TextTone.Danger}>{t(report.errorKey)}</Text> : null}
        {report.sent && !report.errorKey ? <Text tone={TextTone.Muted}>{t('listingReports.sent')}</Text> : null}
        <Button icon={Flag} label={t('listingReports.send')} variant={ButtonVariant.Outline} loading={report.sending} onPress={report.submit} testID="report-send" />
      </Card>
    </Section>
  );
}
