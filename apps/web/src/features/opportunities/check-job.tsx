'use client';

import { AlertTriangle, CheckCircle2 } from 'lucide-react';
import { readinessSummary, stopReasonKey, usePortalActions, usePortalReadiness, useT } from '@careerpilot/client-core';
import { ReadinessState, StatusTone } from '@careerpilot/domain-ui-logic';
import { Banner, Button, Card } from '@careerpilot/ui-web';

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
      <Button variant="outline" loading={checking} disabled={!url} onClick={() => actions.checkJob.mutate(url)} data-testid="check-job">
        {checking ? t('portal.check.checking') : t('portal.check.button')}
      </Button>
      {!url ? <p className="text-sm text-muted">{t('portal.check.noLink')}</p> : null}
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
