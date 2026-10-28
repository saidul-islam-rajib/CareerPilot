'use client';

import { useId, useState } from 'react';
import { ChevronDown, Search, X } from 'lucide-react';
import type { DashboardSummary } from '@careerpilot/api-client';
import { SuggestionKind, trackTitle, useDashboardView, useFavoriteCompanies, useT } from '@careerpilot/client-core';
import { StatusTone } from '@careerpilot/domain-ui-logic';
import { Badge, EmptyState, cn, useToast } from '@careerpilot/ui-web';
import { OpportunityCard } from '@/features/opportunities/opportunity-card';

type View = ReturnType<typeof useDashboardView>;

function JobSearch({ view }: { view: View }) {
  const t = useT();
  const listId = useId();
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const showList = open && view.suggestions.length > 0;
  const choose = (value: string) => {
    view.setQuery(value);
    setOpen(false);
    setActive(-1);
  };
  const move = (step: number) => {
    const count = view.suggestions.length;
    setOpen(true);
    setActive((index) => (index + step + count) % count);
  };
  return (
    <div className="relative w-full max-w-xl">
      <label className="sr-only" htmlFor={`${listId}-input`}>
        {t('home.searchLabel')}
      </label>
      <Search className="pointer-events-none absolute left-3 top-1/2 size-5 -translate-y-1/2 text-muted" aria-hidden />
      <input
        id={`${listId}-input`}
        type="search"
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={showList}
        aria-controls={listId}
        aria-activedescendant={showList && active >= 0 ? `${listId}-${active}` : undefined}
        placeholder={t('home.searchPlaceholder')}
        value={view.query}
        onChange={(e) => {
          view.setQuery(e.target.value);
          setOpen(true);
          setActive(-1);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown' && view.suggestions.length > 0) {
            e.preventDefault();
            move(1);
          } else if (e.key === 'ArrowUp' && view.suggestions.length > 0) {
            e.preventDefault();
            move(-1);
          } else if (e.key === 'Enter' && showList && active >= 0) {
            e.preventDefault();
            const picked = view.suggestions[active];
            if (picked) {
              choose(picked.value);
            }
          } else if (e.key === 'Escape') {
            setOpen(false);
          }
        }}
        className="h-12 w-full rounded-control border border-input bg-card pl-10 pr-10 text-foreground placeholder:text-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-focus [&::-webkit-search-cancel-button]:appearance-none"
      />
      {view.query ? (
        <button
          type="button"
          onClick={view.clear}
          aria-label={t('home.searchClear')}
          className="absolute right-2 top-1/2 flex size-9 -translate-y-1/2 items-center justify-center rounded-full text-muted hover:bg-surface"
        >
          <X className="size-4" aria-hidden />
        </button>
      ) : null}
      {showList ? (
        <ul
          id={listId}
          role="listbox"
          aria-label={t('home.searchLabel')}
          className="absolute z-20 mt-1 max-h-80 w-full overflow-auto rounded-card border border-border bg-card p-1 shadow-lg"
        >
          {view.suggestions.map((suggestion, index) => (
            <li
              key={`${suggestion.kind}-${suggestion.value}`}
              id={`${listId}-${index}`}
              role="option"
              aria-selected={index === active}
              onMouseDown={(e) => {
                e.preventDefault();
                choose(suggestion.value);
              }}
              className={cn(
                'flex cursor-pointer items-center justify-between gap-3 rounded-control px-3 py-2 text-sm',
                index === active ? 'bg-primary-subtle' : 'hover:bg-surface',
              )}
            >
              <span className="truncate text-foreground">{suggestion.value}</span>
              <span className="shrink-0 text-xs text-muted">
                {suggestion.kind === SuggestionKind.Company ? t('home.suggestionCompany') : t('home.suggestionRole')}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

export function TodayTracks({ dashboard }: { dashboard: DashboardSummary }) {
  const t = useT();
  const toast = useToast();
  const view = useDashboardView(dashboard);
  const favorites = useFavoriteCompanies(dashboard.favoriteCompanies);
  const toggleFavorite = (company: string) => {
    const was = favorites.isFavorite(company);
    void favorites.toggle(company).then(() => toast.show({ message: t(was ? 'home.favoriteRemoved' : 'home.favoriteAdded', { company }) }));
  };
  return (
    <div className="flex flex-col gap-4">
      <JobSearch view={view} />
      {view.query ? (
        <p className="text-sm text-muted" aria-live="polite">
          {view.matchCount > 0 ? t('home.searchResults', { count: view.matchCount, query: view.query }) : t('home.searchEmpty', { query: view.query })}
        </p>
      ) : null}
      {view.tracks.map(({ track, opportunities }) => {
        const title = trackTitle(track, t, dashboard.homeCountry);
        const collapsed = view.isCollapsed(track.id);
        const regionId = `track-${track.id}`;
        if (view.query && opportunities.length === 0) {
          return null;
        }
        return (
          <section key={track.id} className="flex flex-col gap-3" aria-labelledby={`${regionId}-title`}>
            <button
              type="button"
              onClick={() => view.toggle(track.id)}
              aria-expanded={!collapsed}
              aria-controls={regionId}
              aria-label={collapsed ? t('home.expand', { track: title }) : t('home.collapse', { track: title })}
              className="flex min-h-11 items-center gap-3 rounded-control text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
            >
              <ChevronDown className={cn('size-5 shrink-0 text-muted transition-transform', collapsed ? '-rotate-90' : undefined)} aria-hidden />
              <h2 id={`${regionId}-title`} className="text-lg font-semibold text-foreground">
                {title}
              </h2>
              <Badge label={t('home.trackCount', { count: opportunities.length })} tone={StatusTone.Neutral} />
            </button>
            {collapsed ? null : (
              <div id={regionId}>
                {opportunities.length === 0 ? (
                  <EmptyState body={t('home.trackEmpty')} />
                ) : (
                  <div className="grid gap-3 md:grid-cols-2">
                    {opportunities.map((opportunity) => {
                      const active = favorites.isFavorite(opportunity.organization);
                      return (
                        <OpportunityCard
                          key={opportunity.id}
                          opportunity={opportunity}
                          favorite={{
                            active,
                            label: t(active ? 'home.unfavorite' : 'home.favorite', { company: opportunity.organization }),
                            onToggle: () => toggleFavorite(opportunity.organization),
                          }}
                        />
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}
