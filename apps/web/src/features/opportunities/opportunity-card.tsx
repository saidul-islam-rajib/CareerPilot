'use client';

import Link from 'next/link';
import { Building2, CalendarClock, MapPin, Star } from 'lucide-react';
import type { DisplaySettings, OpportunitySummary } from '@careerpilot/api-client';
import { useFormat, usePublicConfig, useT } from '@careerpilot/client-core';
import { EnumKey, RequirementCheck, StatusTone } from '@careerpilot/domain-ui-logic';
import { Badge, EnumBadge, cn } from '@careerpilot/ui-web';
import { Routes } from '@/core/routes';

export function matchTone(score: number, display: DisplaySettings): StatusTone {
  if (score >= display.strongMatchScore) {
    return StatusTone.Success;
  }
  return score >= display.fairMatchScore ? StatusTone.Primary : StatusTone.Neutral;
}

export interface FavoriteToggle {
  active: boolean;
  label: string;
  onToggle: () => void;
}

export function OpportunityCard({ opportunity, href, favorite }: { opportunity: OpportunitySummary; href?: string; favorite?: FavoriteToggle }) {
  const t = useT();
  const format = useFormat();
  const { config } = usePublicConfig();
  const salary = format.money(opportunity.compensation);
  const urgent = opportunity.deadline !== undefined && format.daysLeft(opportunity.deadline) <= config.display.urgentDeadlineDays;
  return (
    <div className="relative">
    <Link
      href={href ?? Routes.opportunity(opportunity.id)}
      className={cn(
        'flex h-full flex-col gap-2 rounded-card border bg-card p-4 transition-colors hover:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus',
        favorite?.active ? 'border-warning' : 'border-border',
        favorite ? 'pb-12' : undefined,
      )}
    >
      <div className="flex items-start gap-3">
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="font-semibold text-foreground">{opportunity.title}</span>
          <span className="flex items-center gap-1 text-sm text-muted">
            <Building2 className="size-4" aria-hidden />
            {opportunity.organization}
          </span>
        </div>
        <Badge label={t('opportunity.match', { score: opportunity.matchScore })} tone={matchTone(opportunity.matchScore, config.display)} />
      </div>
      <span className="flex items-center gap-1 text-sm text-muted">
        <MapPin className="size-4" aria-hidden />
        {opportunity.location}
      </span>
      <div className="flex flex-wrap gap-2">
        <EnumBadge enumKey={EnumKey.WorkArrangement} value={opportunity.workArrangement} />
        {opportunity.sponsorship ? <EnumBadge enumKey={EnumKey.SponsorshipEvidence} value={opportunity.sponsorship} /> : null}
        {opportunity.hasHardFailure ? <EnumBadge enumKey={EnumKey.RequirementCheck} value={RequirementCheck.NotMet} /> : null}
      </div>
      <div className="flex items-center justify-between gap-2 text-sm">
        <span className={cn('flex items-center gap-1', urgent ? 'text-warning' : 'text-muted')}>
          <CalendarClock className="size-4" aria-hidden />
          {format.deadline(opportunity.deadline)}
        </span>
        {salary ? <span className="font-medium text-foreground">{salary}</span> : null}
      </div>
    </Link>
    {favorite ? (
      <button
        type="button"
        onClick={favorite.onToggle}
        aria-pressed={favorite.active}
        aria-label={favorite.label}
        title={favorite.label}
        className="absolute bottom-2 right-2 flex size-10 items-center justify-center rounded-full text-muted transition-colors hover:bg-surface hover:text-warning focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
      >
        <Star className={cn('size-5', favorite.active ? 'fill-warning text-warning' : undefined)} aria-hidden />
      </button>
    ) : null}
    </div>
  );
}
