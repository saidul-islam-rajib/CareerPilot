import { stopReasonKey, readinessSummary, usePortalActions, usePortalReadiness, useT } from '@careerpilot/client-core';
import { ReadinessState, StatusTone } from '@careerpilot/domain-ui-logic';
import { AlertTriangle, CheckCircle2 } from '@/ui/icons';
import { Banner, Button, ButtonVariant, Card, Text } from '@/ui';

export function CheckJob({ url }: { url: string }) {
  const t = useT();
  const actions = usePortalActions();
  const report = usePortalReadiness(actions.checkJob.data?.id);
  const finished = report.data?.state === ReadinessState.Done;
  const failed = actions.checkJob.isError || report.data?.state === ReadinessState.Failed;
  const summary = finished && report.data ? readinessSummary(report.data) : null;
  const checking = actions.checkJob.isPending || (!!actions.checkJob.data && !finished && !failed);
  return (
    <Card>
      <Button
        label={checking ? t('portal.check.checking') : t('portal.check.button')}
        variant={ButtonVariant.Outline}
        fullWidth
        loading={checking}
        disabled={!url}
        onPress={() => actions.checkJob.mutate(url)}
        testID="check-job"
      />
      {!url ? <Text>{t('portal.check.noLink')}</Text> : null}
      {failed ? <Banner tone={StatusTone.Danger} icon={AlertTriangle} title={t('portal.check.failed')} /> : null}
      {summary?.canAutoApply ? <Banner tone={StatusTone.Success} icon={CheckCircle2} title={t('portal.check.canAutoApply')} /> : null}
      {summary && !summary.canAutoApply ? (
        <Banner
          tone={StatusTone.Warning}
          icon={AlertTriangle}
          title={t('portal.check.willStop', { reasons: summary.reasons.map((reason) => t(stopReasonKey(reason))).join(', ') })}
        />
      ) : null}
    </Card>
  );
}
