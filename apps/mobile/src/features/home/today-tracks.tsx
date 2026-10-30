import { useState } from 'react';
import { useRouter } from 'expo-router';
import { Pressable, TextInput, View } from 'react-native';
import type { DashboardSummary } from '@careerpilot/api-client';
import { SuggestionKind, trackTitle, useDashboardView, useFavoriteCompanies, useT } from '@careerpilot/client-core';
import { StatusTone } from '@careerpilot/domain-ui-logic';
import { ChevronDown, ChevronRight, Search, X } from '@/ui/icons';
import { Routes } from '@/core/navigation/routes';
import { useTheme } from '@/core/theme/theme';
import { OpportunityCard } from '@/features/opportunities/opportunity-card';
import { Badge, Card, EmptyState, Icon, IconSize, Text, TextTone, TextVariant, bareInput, useSnackbar } from '@/ui';

type DashboardView = ReturnType<typeof useDashboardView>;

function JobSearch({ view }: { view: DashboardView }) {
  const t = useT();
  const theme = useTheme();
  const [focused, setFocused] = useState(false);
  const showList = focused && view.suggestions.length > 0;
  return (
    <View style={{ gap: theme.space.xs }}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: theme.space.sm,
          minHeight: theme.touchTarget,
          paddingHorizontal: theme.space.md,
          borderRadius: theme.radius.control,
          borderWidth: theme.borderWidth.hairline,
          borderColor: focused ? theme.colors.primary : theme.colors.input,
          backgroundColor: theme.colors.card,
        }}
      >
        <Icon icon={Search} size={IconSize.Small} color={theme.colors.textMuted} />
        <TextInput
          value={view.query}
          onChangeText={view.setQuery}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder={t('home.searchPlaceholder')}
          placeholderTextColor={theme.colors.textMuted}
          accessibilityLabel={t('home.searchLabel')}
          autoCorrect={false}
          returnKeyType="search"
          style={{ ...bareInput, flex: 1, color: theme.colors.text, fontSize: theme.fontSize.md, paddingVertical: theme.space.sm }}
          testID="today-search"
        />
        {view.query ? (
          <Pressable accessibilityRole="button" accessibilityLabel={t('home.searchClear')} onPress={view.clear} hitSlop={theme.space.sm}>
            <Icon icon={X} size={IconSize.Small} color={theme.colors.textMuted} />
          </Pressable>
        ) : null}
      </View>
      {showList ? (
        <Card style={{ paddingVertical: theme.space.xs }}>
          {view.suggestions.map((suggestion) => (
            <Pressable
              key={`${suggestion.kind}-${suggestion.value}`}
              accessibilityRole="button"
              accessibilityLabel={suggestion.value}
              onPress={() => {
                view.setQuery(suggestion.value);
                setFocused(false);
              }}
              style={{ flexDirection: 'row', alignItems: 'center', gap: theme.space.sm, minHeight: theme.touchTarget }}
              testID={`suggestion-${suggestion.value}`}
            >
              <Text style={{ flex: 1 }} numberOfLines={1}>
                {suggestion.value}
              </Text>
              <Text variant={TextVariant.Caption} tone={TextTone.Muted}>
                {suggestion.kind === SuggestionKind.Company ? t('home.suggestionCompany') : t('home.suggestionRole')}
              </Text>
            </Pressable>
          ))}
        </Card>
      ) : null}
      {view.query ? (
        <Text variant={TextVariant.Caption} tone={TextTone.Muted}>
          {view.matchCount > 0 ? t('home.searchResults', { count: view.matchCount, query: view.query }) : t('home.searchEmpty', { query: view.query })}
        </Text>
      ) : null}
    </View>
  );
}

export function TodayTracks({ dashboard }: { dashboard: DashboardSummary }) {
  const t = useT();
  const theme = useTheme();
  const router = useRouter();
  const snackbar = useSnackbar();
  const view = useDashboardView(dashboard);
  const favorites = useFavoriteCompanies(dashboard.favoriteCompanies);
  const toggleFavorite = (company: string) => {
    const was = favorites.isFavorite(company);
    void favorites.toggle(company).then(() => snackbar.show({ message: t(was ? 'home.favoriteRemoved' : 'home.favoriteAdded', { company }) }));
  };
  return (
    <View style={{ gap: theme.space.lg }}>
      <JobSearch view={view} />
      {view.tracks.map(({ track, opportunities }) => {
        if (view.query && opportunities.length === 0) {
          return null;
        }
        const title = trackTitle(track, t, dashboard.homeCountry);
        const collapsed = view.isCollapsed(track.id);
        return (
          <View key={track.id} style={{ gap: theme.space.sm }}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={collapsed ? t('home.expand', { track: title }) : t('home.collapse', { track: title })}
              accessibilityState={{ expanded: !collapsed }}
              onPress={() => view.toggle(track.id)}
              style={{ flexDirection: 'row', alignItems: 'center', gap: theme.space.sm, minHeight: theme.touchTarget }}
              testID={`track-toggle-${track.id}`}
            >
              <Icon icon={collapsed ? ChevronRight : ChevronDown} size={IconSize.Small} color={theme.colors.textMuted} />
              <Text variant={TextVariant.Heading} style={{ flexShrink: 1 }}>
                {title}
              </Text>
              <Badge label={t('home.trackCount', { count: opportunities.length })} tone={StatusTone.Neutral} />
            </Pressable>
            {collapsed ? null : opportunities.length === 0 ? (
              <EmptyState body={t('home.trackEmpty')} />
            ) : (
              opportunities.map((opportunity) => {
                const active = favorites.isFavorite(opportunity.organization);
                return (
                  <OpportunityCard
                    key={opportunity.id}
                    opportunity={opportunity}
                    onPress={() => router.push(Routes.opportunity(opportunity.id))}
                    favorite={{
                      active,
                      label: t(active ? 'home.unfavorite' : 'home.favorite', { company: opportunity.organization }),
                      onToggle: () => toggleFavorite(opportunity.organization),
                    }}
                  />
                );
              })
            )}
          </View>
        );
      })}
    </View>
  );
}
