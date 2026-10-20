'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { AlertTriangle, Archive, Bookmark, Check, CircleHelp, Minus, Plus, Send, X, type LucideIcon } from 'lucide-react';
import { useDecide, useFormat, useOpportunity, usePrepareApplication, usePublicConfig, useT } from '@careerpilot/client-core';
import { EnumKey, OpportunityDecision, RequirementCheck, StatusTone } from '@careerpilot/domain-ui-logic';
import { Badge, Banner, Button, Card, EnumBadge, ErrorState, ListRow, LoadingState, Section, buttonVariants } from '@careerpilot/ui-web';
import { Routes } from '@/core/routes';
import { matchTone } from './opportunity-card';

const CHECK_ICONS: Record<RequirementCheck, LucideIcon> = { met: Check, not_met: X, unknown: CircleHelp };
const CHECK_CLASSES: Record<RequirementCheck, string> = { met: 'text-success', not_met: 'text-danger', unknown: 'text-warning' };

export function OpportunityPage() {
  const { id } = useParams<{ id: string }>();
  const t = useT();
  const router = useRouter();
  const format = useFormat();
  const { config } = usePublicConfig();
  const opportunity = useOpportunity(id);
  const decide = useDecide(id);
  const prepare = usePrepareApplication(id);

  if (opportunity.isPending) {
    return <LoadingState />;
  }
  if (opportunity.isError) {
    return <ErrorState onRetry={() => void opportunity.refetch()} />;
  }
  const o = opportunity.data;
  const salary = format.money(o.compensation);
  const saved = o.decision === OpportunityDecision.Saved;

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-bold md:text-3xl">{o.title}</h1>
          <p className="text-muted">
            {o.organization} · {o.location}
          </p>
          <div className="flex flex-wrap gap-2">
            <Badge label={t('opportunity.match', { score: o.matchScore })} tone={matchTone(o.matchScore, config.display)} />
            <EnumBadge enumKey={EnumKey.OpportunityType} value={o.type} />
            <EnumBadge enumKey={EnumKey.WorkArrangement} value={o.workArrangement} />
            {o.sponsorship ? <EnumBadge enumKey={EnumKey.SponsorshipEvidence} value={o.sponsorship} /> : null}
          </div>
        </div>
        {prepare.isSuccess ? <Banner tone={StatusTone.Info} icon={Send} title={t('opportunity.preparing')} /> : null}
        {o.hasHardFailure ? <Banner tone={StatusTone.Danger} icon={AlertTriangle} title={t('opportunity.hardFailure')} /> : null}

        <Section title={t('opportunity.matchExplanation')}>
          <Card>
            <ul className="flex flex-col gap-2">
              {o.matchFactors.map((factor) => (
                <li key={factor.text} className="flex items-start gap-2">
                  {factor.positive ? <Plus className="mt-0.5 size-4 text-success" aria-hidden /> : <Minus className="mt-0.5 size-4 text-warning" aria-hidden />}
                  {factor.text}
                </li>
              ))}
            </ul>
          </Card>
        </Section>

        <Section title={t('opportunity.requirements')}>
          <Card>
            <ul className="flex flex-col gap-3">
              {o.requirements.map((requirement) => {
                const Glyph = CHECK_ICONS[requirement.check];
                return (
                  <li key={requirement.text} className="flex items-start gap-2">
                    <Glyph className={`mt-0.5 size-4 ${CHECK_CLASSES[requirement.check]}`} aria-hidden />
                    <span className="flex-1">{requirement.text}</span>
                    <EnumBadge enumKey={EnumKey.RequirementCheck} value={requirement.check} />
                  </li>
                );
              })}
            </ul>
          </Card>
        </Section>

        <Section title={t('opportunity.source')}>
          <Card>
            <p>{o.description}</p>
            <ListRow icon={Archive} title={t('opportunity.viewCircular')} subtitle={t('opportunity.circularArchived', { date: format.date(o.circular.archivedAt) })} href={Routes.circular(o.id)} />
          </Card>
        </Section>
      </div>

      <aside className="flex flex-col gap-4 lg:sticky lg:top-6 lg:self-start">
        <Card>
          <ListRow title={t('opportunity.deadline')} subtitle={o.deadline ? `${format.date(o.deadline)} · ${format.deadline(o.deadline)}` : t('common.notStated')} />
          <ListRow title={t('opportunity.compensation')} subtitle={salary ?? t('common.notStated')} />
          <ListRow title={t('opportunity.route')} trailing={<EnumBadge enumKey={EnumKey.ApplicationRoute} value={o.route} />} />
        </Card>
        {prepare.isSuccess ? (
          <Link href={Routes.approval(prepare.data.id)} className={buttonVariants({ fullWidth: true })}>
            <Send className="size-5" aria-hidden />
            {t('approvals.title')}
          </Link>
        ) : (
          <Button icon={Send} fullWidth onClick={() => prepare.mutate()} loading={prepare.isPending}>
            {t('opportunity.prepareApplication')}
          </Button>
        )}
        <div className="grid grid-cols-2 gap-2">
          <Button variant="outline" icon={Bookmark} disabled={saved} onClick={() => decide.mutate(OpportunityDecision.Saved)}>
            {saved ? t('common.saved') : t('opportunity.save')}
          </Button>
          <Button variant="outline" icon={X} onClick={() => decide.mutate(OpportunityDecision.Dismissed, { onSuccess: () => router.push(Routes.home) })}>
            {t('opportunity.dismiss')}
          </Button>
        </div>
      </aside>
    </div>
  );
}
