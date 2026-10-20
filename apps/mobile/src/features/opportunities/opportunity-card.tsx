import { View } from 'react-native';
import { Building2, CalendarClock, MapPin } from 'lucide-react-native';
import { EnumKey, StatusTone } from '@careerpilot/domain-ui-logic';
import type { DisplaySettings, OpportunitySummary } from '@careerpilot/api-client';
import { usePublicConfig } from '@/core/config/public-config';
import { useFormat } from '@/core/format/use-format';
import { useT } from '@/core/i18n/i18n';
import { useTheme } from '@/core/theme/theme';
import { Badge, Card, EnumBadge, Icon, IconSize, Row, Text, TextTone, TextVariant } from '@/ui';

export function matchTone(score: number, display: DisplaySettings): StatusTone {
  if (score >= display.strongMatchScore) {
    return StatusTone.Success;
  }
  return score >= display.fairMatchScore ? StatusTone.Primary : StatusTone.Neutral;
}

export function OpportunityCard({ opportunity, onPress }: { opportunity: OpportunitySummary; onPress: () => void }) {
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
      </Row>
    </Card>
  );
}
