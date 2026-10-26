'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { AlertTriangle, CheckCircle2, FileText, ShieldCheck, XCircle } from 'lucide-react';
import { useApproval, useApprovalActions, useFormat, useT } from '@careerpilot/client-core';
import { ApprovalState, EnumKey, StatusTone } from '@careerpilot/domain-ui-logic';
import { Banner, Button, Card, ConfirmDialog, EnumBadge, ErrorState, ListRow, LoadingState, PageHeader, Section, buttonVariants } from '@careerpilot/ui-web';
import { Routes } from '@/core/routes';
import { OpportunityCard } from '@/features/opportunities/opportunity-card';
import { AnswerEditor } from './answer-editor';

export function ApprovalPage() {
  const { id } = useParams<{ id: string }>();
  const t = useT();
  const format = useFormat();
  const approval = useApproval(id);
  const actions = useApprovalActions(id);

  if (approval.isPending) {
    return <LoadingState />;
  }
  if (approval.isError) {
    return <ErrorState onRetry={() => void approval.refetch()} />;
  }
  const a = approval.data;
  const pending = a.state === ApprovalState.Pending;
  const unanswered = a.materials.answers.some((item) => !item.answer.trim());

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
      <div className="flex flex-col gap-6">
        <PageHeader title={t('approvals.title')} description={pending ? t('approvals.expiresOn', { date: format.dateTime(a.expiresAt) }) : undefined} />
        {a.state === ApprovalState.Approved ? (
          <Banner
            tone={StatusTone.Success}
            icon={ShieldCheck}
            title={t('approvals.approvedNote', { window: a.submissionWindowLabel ?? t('approvals.sendWindowNow') })}
            action={
              <Link href={Routes.applications} className={buttonVariants({ variant: 'outline', size: 'sm' })}>
                {t('applications.title')}
              </Link>
            }
          />
        ) : null}
        {a.state === ApprovalState.Rejected ? <Banner tone={StatusTone.Neutral} icon={XCircle} title={t('approvals.rejectedNote')} /> : null}
        <OpportunityCard opportunity={a.opportunity} />
        <Section title={t('approvals.coverLetter')}>
          <Card>
            <p className="whitespace-pre-wrap">{a.materials.coverLetter}</p>
          </Card>
        </Section>
        {a.materials.answers.length > 0 ? (
          <Section title={t('approvals.answers')}>
            <Card className="divide-y divide-border py-1">
              {a.materials.answers.map((item) => (
                <AnswerEditor key={item.id} item={item} editable={pending} saving={actions.updateAnswer.isPending} onSave={(answer, saveForReuse) => actions.updateAnswer.mutate({ answerId: item.id, answer, saveForReuse })} />
              ))}
            </Card>
          </Section>
        ) : null}
      </div>
      <aside className="flex flex-col gap-4 lg:sticky lg:top-6 lg:self-start">
        <Card>
          <h2 className="font-semibold">{t('approvals.materials')}</h2>
          <ListRow icon={FileText} title={t('approvals.cv')} subtitle={`${a.materials.cv.name} · ${t('profile.version', { version: a.materials.cv.version })}`} />
          <ListRow title={t('opportunity.route')} trailing={<EnumBadge enumKey={EnumKey.ApplicationRoute} value={a.route} />} />
        </Card>
        {pending ? (
          <>
            {unanswered ? <Banner tone={StatusTone.Warning} icon={AlertTriangle} title={t('approvals.unansweredQuestions')} /> : null}
            <ConfirmDialog
              title={t('approvals.confirmApproveTitle')}
              body={t('approvals.confirmApproveBody', { employer: a.opportunity.organization })}
              confirmLabel={t('common.confirm')}
              onConfirm={() => actions.approve.mutate()}
              trigger={
                <Button icon={CheckCircle2} fullWidth loading={actions.approve.isPending} disabled={unanswered}>
                  {t('approvals.approveAndSend')}
                </Button>
              }
            />
            <Button variant="outline" icon={XCircle} fullWidth onClick={() => actions.reject.mutate()} loading={actions.reject.isPending}>
              {t('approvals.reject')}
            </Button>
          </>
        ) : null}
      </aside>
    </div>
  );
}
