import { Pressable, View } from 'react-native';
import { useFormat, usePublicConfig, useT } from '@careerpilot/client-core';
import { Building2, CalendarClock, MapPin, Star } from '@/ui/icons';
import { EnumKey, StatusTone } from '@careerpilot/domain-ui-logic';
import type { DisplaySettings, OpportunitySummary } from '@careerpilot/api-client';
import { useTheme } from '@/core/theme/theme';
import { Badge, Card, EnumBadge, Icon, IconSize, Row, Text, TextTone, TextVariant } from '@/ui';

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

export function OpportunityCard({ opportunity, onPress, favorite }: { opportunity: OpportunitySummary; onPress: () => void; favorite?: FavoriteToggle }) {
  const theme = useTheme();
  const t = useT();
  const format = useFormat();
  const { config } = usePublicConfig();
  const salary = format.money(opportunity.compensation);
  const urgent = opportunity.deadline !== undefined && format.daysLeft(opportunity.deadline) <= config.display.urgentDeadlineDays;
  return (
    <Card onPress={onPress} accessibilityLabel={`${opportunity.title}, ${opportunity.organization}, ${t('opportunity.match', { score: opportunity.matchScore })}`}>
      <Row align="flex-start">
        <View style={{ flex: 1, gap: theme.space.xxs }}>
          <Text variant={TextVariant.Subheading}>{opportunity.title}</Text>
          <Row gap={theme.space.xs}>
            <Icon icon={Building2} size={IconSize.Small} color={theme.colors.textMuted} />
            <Text variant={TextVariant.Label} tone={TextTone.Muted}>
              {opportunity.organization}
            </Text>
          </Row>
        </View>
        <Badge label={t('opportunity.match', { score: opportunity.matchScore })} tone={matchTone(opportunity.matchScore, config.display)} />
      </Row>
      <Row gap={theme.space.xs}>
        <Icon icon={MapPin} size={IconSize.Small} color={theme.colors.textMuted} />
        <Text variant={TextVariant.Label} tone={TextTone.Muted} style={{ flexShrink: 1 }}>
          {opportunity.location}
        </Text>
      </Row>
      <Row wrap>
        <EnumBadge enumKey={EnumKey.WorkArrangement} value={opportunity.workArrangement} />
        {opportunity.sponsorship ? <EnumBadge enumKey={EnumKey.SponsorshipEvidence} value={opportunity.sponsorship} /> : null}
        {opportunity.hasHardFailure ? <EnumBadge enumKey={EnumKey.RequirementCheck} value="not_met" /> : null}
      </Row>
      <Row>
        <Row gap={theme.space.xs}>
          <Icon icon={CalendarClock} size={IconSize.Small} color={urgent ? theme.colors.warning : theme.colors.textMuted} />
          <Text variant={TextVariant.Label} tone={urgent ? TextTone.Warning : TextTone.Muted}>
            {format.deadline(opportunity.deadline)}
          </Text>
        </Row>
        {salary ? (
          <Text variant={TextVariant.Label} style={{ marginLeft: 'auto' }}>
            {salary}
          </Text>
        ) : null}
        {favorite ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={favorite.label}
            accessibilityState={{ selected: favorite.active }}
            onPress={favorite.onToggle}
            hitSlop={theme.space.sm}
            style={{ marginLeft: salary ? 0 : 'auto', minWidth: theme.touchTarget, minHeight: theme.touchTarget, alignItems: 'center', justifyContent: 'center' }}
          >
            <Icon icon={Star} color={favorite.active ? theme.colors.warning : theme.colors.textMuted} fill={favorite.active ? theme.colors.warning : undefined} />
          </Pressable>
        ) : null}
      </Row>
    </Card>
  );
}
