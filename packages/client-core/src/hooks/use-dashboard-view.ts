import { useMemo, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { DashboardSummary, OpportunitySummary, TrackDigest } from '@careerpilot/api-client';
import { queryKeys } from '../query/query-keys';
import { useApi, useServices } from '../services/app-services';

export const SuggestionKind = {
  Company: 'company',
  Role: 'role',
} as const;
export type SuggestionKind = (typeof SuggestionKind)[keyof typeof SuggestionKind];

export interface SearchSuggestion {
  kind: SuggestionKind;
  value: string;
}

function folded(value: string): string {
  return value.trim().toLocaleLowerCase();
}

function matches(opportunity: OpportunitySummary, query: string): boolean {
  return folded(opportunity.organization).includes(query) || folded(opportunity.title).includes(query);
}

export function searchSuggestions(tracks: TrackDigest[], rawQuery: string, limit: number): SearchSuggestion[] {
  const query = folded(rawQuery);
  if (!query) {
    return [];
  }
  const seen = new Set<string>();
  const found: SearchSuggestion[] = [];
  const add = (kind: SuggestionKind, value: string) => {
    const key = `${kind}:${folded(value)}`;
    if (!seen.has(key) && folded(value).includes(query) && folded(value) !== query) {
      seen.add(key);
      found.push({ kind, value });
    }
  };
  const all = tracks.flatMap((digest) => digest.opportunities);
  all.forEach((opportunity) => add(SuggestionKind.Company, opportunity.organization));
  all.forEach((opportunity) => add(SuggestionKind.Role, opportunity.title));
  return found.slice(0, limit);
}

export function filterTracks(tracks: TrackDigest[], rawQuery: string): TrackDigest[] {
  const query = folded(rawQuery);
  if (!query) {
    return tracks;
  }
  return tracks.map((digest) => ({ ...digest, opportunities: digest.opportunities.filter((o) => matches(o, query)) }));
}

export function useDashboardView(dashboard: DashboardSummary | undefined) {
  const { config } = useServices();
  const [query, setQuery] = useState('');
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const tracks = useMemo(() => dashboard?.tracks ?? [], [dashboard?.tracks]);
  const suggestions = useMemo(() => searchSuggestions(tracks, query, config.ui.searchSuggestionLimit), [tracks, query, config.ui.searchSuggestionLimit]);
  const visible = useMemo(() => filterTracks(tracks, query), [tracks, query]);
  return {
    query,
    setQuery,
    clear: () => setQuery(''),
    suggestions,
    tracks: visible,
    matchCount: visible.reduce((sum, digest) => sum + digest.opportunities.length, 0),
    isCollapsed: (trackId: string) => collapsed[trackId] === true,
    toggle: (trackId: string) => setCollapsed((current) => ({ ...current, [trackId]: !current[trackId] })),
  };
}

export function useFavoriteCompanies(favorites: string[]) {
  const api = useApi();
  const client = useQueryClient();
  const save = useMutation({
    mutationFn: (companies: string[]) => api.settings.updateFavoriteCompanies(companies),
    onSuccess: async (settings) => {
      client.setQueryData(queryKeys.settings, settings);
      await client.invalidateQueries({ queryKey: queryKeys.dashboard });
    },
  });
  const isFavorite = (company: string) => favorites.some((name) => folded(name) === folded(company));
  return {
    isFavorite,
    toggle: (company: string) =>
      save.mutateAsync(isFavorite(company) ? favorites.filter((name) => folded(name) !== folded(company)) : [...favorites, company]),
    saving: save.isPending,
  };
}
