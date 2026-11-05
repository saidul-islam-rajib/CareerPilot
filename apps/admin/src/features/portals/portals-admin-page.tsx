'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { PortalHostRecord, ReadinessReport } from '@careerpilot/api-client';
import { hostPolicyKey, hostPolicyTone, stopReasonKey, useT, verdictKey, wallKey } from '@careerpilot/client-core';
import { HostPolicy, StatusTone, Verdict } from '@careerpilot/domain-ui-logic';
import { Badge, Button, Card, EmptyState, ErrorState, LoadingState, PageHeader, Section, TextField, useToast } from '@careerpilot/ui-web';
import { useAdminApi } from '@/core/admin-services';

const KEY = ['admin', 'portals'] as const;

function useHosts() {
  const api = useAdminApi();
  return useQuery({ queryKey: [...KEY, 'hosts'], queryFn: () => api.portals.listHosts() });
}

function useDecide() {
  const api = useAdminApi();
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: { host: string; policy: HostPolicy; note: string }) => api.portals.decideHost(input.host, { policy: input.policy, note: input.note }),
    onSuccess: () => client.invalidateQueries({ queryKey: KEY }),
  });
}

const DECISIONS: { policy: HostPolicy; label: string }[] = [
  { policy: HostPolicy.Allowed, label: 'portal.hosts.allow' },
  { policy: HostPolicy.Blocked, label: 'portal.hosts.block' },
  { policy: HostPolicy.Review, label: 'portal.hosts.review' },
];

function HostRow({ host }: { host: PortalHostRecord }) {
  const t = useT();
  const toast = useToast();
  const decide = useDecide();
  const [note, setNote] = useState(host.note);
  const save = (policy: HostPolicy) =>
    decide.mutate({ host: host.host, policy, note }, { onError: () => toast.show({ message: t('portal.hosts.saveFailed') }) });
  return (
    <Card className="gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="break-all font-semibold">{host.host}</p>
        <Badge tone={hostPolicyTone(host.policy)} label={t(hostPolicyKey(host.policy))} />
      </div>
      <TextField label={t('portal.hosts.note')} value={note} onChange={(event) => setNote(event.target.value)} />
      <div className="flex flex-wrap gap-2">
        {DECISIONS.filter((decision) => decision.policy !== host.policy).map((decision) => (
          <Button key={decision.policy} variant="outline" onClick={() => save(decision.policy)} loading={decide.isPending}>
            {t(decision.label)}
          </Button>
        ))}
      </div>
    </Card>
  );
}

function ReportView({ report }: { report: ReadinessReport }) {
  const t = useT();
  return (
    <Card className="gap-2">
      <p className="break-all font-semibold">{report.host}</p>
      {report.verdict ? <Badge tone={report.verdict === Verdict.CanAutoApply ? StatusTone.Success : StatusTone.Warning} label={t(verdictKey(report.verdict))} /> : null}
      <p>
        {t('portal.readiness.wall')}: {t(wallKey(report.wall))}
      </p>
      <p>
        {t('portal.readiness.captcha')}: {report.captchaSeen ? t('portal.readiness.yes') : t('portal.readiness.no')}
      </p>
      <p>
        {t('portal.readiness.mapped')}: {report.mapped} · {t('portal.readiness.unknown')}: {report.unknown}
      </p>
      {report.reasons.length ? <p className="font-medium">{t('portal.readiness.reasons')}</p> : null}
      <ul className="list-disc pl-5 text-sm">
        {report.reasons.map((reason) => (
          <li key={reason}>{t(stopReasonKey(reason))}</li>
        ))}
      </ul>
      {report.fields.length ? <p className="font-medium">{t('portal.readiness.fields')}</p> : null}
      <ul className="list-disc pl-5 text-sm">
        {report.fields.map((field) => (
          <li key={field.handle}>
            {field.label}: {field.status}
          </li>
        ))}
      </ul>
    </Card>
  );
}

function Readiness() {
  const t = useT();
  const toast = useToast();
  const api = useAdminApi();
  const client = useQueryClient();
  const [url, setUrl] = useState('');
  const [report, setReport] = useState<ReadinessReport | undefined>();
  const run = useMutation({
    mutationFn: (value: string) => api.portals.requestReadiness(value),
    onSuccess: (result) => {
      setReport(result);
      void client.invalidateQueries({ queryKey: KEY });
    },
    onError: () => toast.show({ message: t('portal.readiness.failed') }),
  });
  return (
    <Section title={t('portal.readiness.title')}>
      <p className="text-muted">{t('portal.readiness.intro')}</p>
      <TextField label={t('portal.readiness.url')} value={url} onChange={(event) => setUrl(event.target.value)} />
      <div>
        <Button onClick={() => run.mutate(url.trim())} disabled={!url.trim()} loading={run.isPending}>
          {t('portal.readiness.run')}
        </Button>
      </div>
      {report ? <ReportView report={report} /> : null}
    </Section>
  );
}

export function PortalsAdminPage() {
  const t = useT();
  const query = useHosts();
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t('portal.hosts.title')} description={t('portal.hosts.intro')} />
      {query.isPending ? <LoadingState /> : null}
      {query.isError ? <ErrorState onRetry={() => query.refetch()} /> : null}
      {query.data?.length === 0 ? <EmptyState title={t('portal.hosts.empty')} /> : null}
      {query.data?.map((host) => (
        <HostRow key={`${host.host}-${host.policy}`} host={host} />
      ))}
      <Readiness />
    </div>
  );
}
