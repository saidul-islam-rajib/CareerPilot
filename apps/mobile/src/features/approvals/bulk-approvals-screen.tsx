import { useRouter } from 'expo-router';
import { enumLabelKey, useBulkApprovals, useT } from '@careerpilot/client-core';
import { Routes } from '@/core/navigation/routes';
import { Button, ButtonVariant, Card, EmptyState, ErrorState, LoadingState, Screen, SwitchRow, Text, TextTone } from '@/ui';

export function BulkApprovalsScreen() {
  const t = useT();
  const router = useRouter();
  const bulk = useBulkApprovals();
  const { result } = bulk;
  if (bulk.rows.isPending) {
    return <LoadingState />;
  }
  if (bulk.rows.isError) {
    return <ErrorState onRetry={() => void bulk.rows.refetch()} />;
  }
  return (
    <Screen testID="bulk-approvals-screen">
      <Text tone={TextTone.Muted}>{t('approvals.bulk.body')}</Text>
      {bulk.items.length === 0 ? <EmptyState title={t('approvals.bulk.empty')} /> : null}
      {result ? (
        <Text tone={result.refused.length > 0 ? TextTone.Warning : TextTone.Success}>{t('approvals.bulk.approved', { count: result.approved.length })}</Text>
      ) : null}
      {bulk.failed ? <Text tone={TextTone.Danger}>{t('approvals.bulk.failed')}</Text> : null}
      {bulk.items.map((row) => {
        const warnings = result?.refused.find((item) => item.approvalId === row.approvalId)?.reasons ?? row.warnings;
        const files = [t('approvals.bulk.cv', { name: row.cvName }), ...row.writingKinds.map((kind) => t(enumLabelKey('writing_kind', kind)))].join(', ');
        const description = [`${t('approvals.bulk.route')}: ${t(enumLabelKey('application_route', row.route))}`, `${t('approvals.bulk.files')}: ${files}`].join('\n');
        return (
          <Card key={row.approvalId}>
            {row.eligible ? (
              <SwitchRow
                label={`${row.employer} · ${row.role}`}
                description={description}
                value={bulk.selected.includes(row.approvalId)}
                onChange={() => bulk.toggle(row.approvalId)}
                testID={`bulk-${row.approvalId}`}
              />
            ) : (
              <>
                <Text>{`${row.employer} · ${row.role}`}</Text>
                <Text tone={TextTone.Muted}>{description}</Text>
              </>
            )}
            {warnings.map((warning) => (
              <Text key={warning} tone={TextTone.Warning}>
                {t(`approvals.bulk.block.${warning}`)}
              </Text>
            ))}
            {row.eligible ? null : (
              <Button label={t('approvals.bulk.oneByOne')} variant={ButtonVariant.Outline} onPress={() => router.push(Routes.approval(row.approvalId))} />
            )}
          </Card>
        );
      })}
      {bulk.items.length > 0 ? (
        <>
          <Button label={t('approvals.bulk.selectAll')} variant={ButtonVariant.Outline} onPress={bulk.selectAll} fullWidth />
          <Button label={t('approvals.bulk.clear')} variant={ButtonVariant.Ghost} onPress={bulk.clear} fullWidth />
          <Button
            label={t('approvals.bulk.approve', { count: bulk.selected.length })}
            onPress={bulk.approve}
            loading={bulk.approving}
            disabled={bulk.selected.length === 0}
            fullWidth
            testID="bulk-approve"
          />
        </>
      ) : null}
    </Screen>
  );
}
