import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useDecide, useFormat, useOpportunity, usePrepareApplication, usePublicConfig, useT } from '@careerpilot/client-core';
import { View } from 'react-native';
import { AlertTriangle, Archive, Bookmark, Check, CircleHelp, Minus, Plus, Send, X, type LucideIcon } from 'lucide-react-native';
import { EnumKey, OpportunityDecision, RequirementCheck, StatusTone } from '@careerpilot/domain-ui-logic';
import { Routes } from '@/core/navigation/routes';
import { useTheme } from '@/core/theme/theme';
import { Badge, Banner, Button, ButtonVariant, Card, EnumBadge, ErrorState, Icon, IconSize, ListRow, LoadingState, Row, Screen, Section, Text, TextTone, TextVariant } from '@/ui';
import { matchTone } from './opportunity-card';

const CHECK_ICONS: Record<RequirementCheck, LucideIcon> = {
  met: Check,
  not_met: X,
  unknown: CircleHelp,
};

export function OpportunityScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const t = useT();
  const theme = useTheme();
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
  const checkColor: Record<RequirementCheck, string> = {
    met: theme.colors.success,
    not_met: theme.colors.danger,
    unknown: theme.colors.warning,
  };

  return (
    <>
      <Stack.Screen options={{ title: o.organization }} />
      <Screen
        testID="opportunity-screen"
        footer={
          <View style={{ gap: theme.space.sm }}>
            {prepare.isSuccess ? (
              <Button label={t('approvals.title')} icon={Send} fullWidth onPress={() => router.push(Routes.approval(prepare.data.id))} />
            ) : (
              <Button label={t('opportunity.prepareApplication')} icon={Send} fullWidth onPress={() => prepare.mutate()} loading={prepare.isPending} testID="prepare-application" />
            )}
            <Row>
              <Button
                label={saved ? t('common.saved') : t('opportunity.save')}
                icon={Bookmark}
                variant={ButtonVariant.Outline}
                style={{ flex: 1 }}
                disabled={saved}
                onPress={() => decide.mutate(OpportunityDecision.Saved)}
              />
              <Button
                label={t('opportunity.dismiss')}
                icon={X}
                variant={ButtonVariant.Outline}
                style={{ flex: 1 }}
                onPress={() => decide.mutate(OpportunityDecision.Dismissed, { onSuccess: () => router.back() })}
              />
            </Row>
          </View>
        }
      >
        <View style={{ gap: theme.space.sm }}>
          <Text variant={TextVariant.Title}>{o.title}</Text>
          <Text tone={TextTone.Muted}>
            {o.organization} · {o.location}
          </Text>
          <Row wrap>
            <Badge label={t('opportunity.match', { score: o.matchScore })} tone={matchTone(o.matchScore, config.display)} />
            <EnumBadge enumKey={EnumKey.OpportunityType} value={o.type} />
            <EnumBadge enumKey={EnumKey.WorkArrangement} value={o.workArrangement} />
            {o.sponsorship ? <EnumBadge enumKey={EnumKey.SponsorshipEvidence} value={o.sponsorship} /> : null}
          </Row>
        </View>

        {prepare.isSuccess ? <Banner tone={StatusTone.Info} icon={Send} title={t('opportunity.preparing')} /> : null}
        {o.hasHardFailure ? <Banner tone={StatusTone.Danger} icon={AlertTriangle} title={t('opportunity.hardFailure')} /> : null}

        <Card>
          <ListRow title={t('opportunity.deadline')} subtitle={o.deadline ? `${format.date(o.deadline)} · ${format.deadline(o.deadline)}` : t('common.notStated')} />
          <ListRow title={t('opportunity.compensation')} subtitle={salary ?? t('common.notStated')} />
          <ListRow title={t('opportunity.route')} trailing={<EnumBadge enumKey={EnumKey.ApplicationRoute} value={o.route} />} />
        </Card>

        <Section title={t('opportunity.matchExplanation')}>
          <Card>
            {o.matchFactors.map((factor) => (
              <Row key={factor.text} align="flex-start">
                <Icon icon={factor.positive ? Plus : Minus} size={IconSize.Small} color={factor.positive ? theme.colors.success : theme.colors.warning} />
                <Text style={{ flex: 1 }}>{factor.text}</Text>
              </Row>
            ))}
          </Card>
        </Section>

        <Section title={t('opportunity.requirements')}>
          <Card>
            {o.requirements.map((requirement) => (
              <Row key={requirement.text} align="flex-start">
                <Icon icon={CHECK_ICONS[requirement.check]} size={IconSize.Small} color={checkColor[requirement.check]} />
                <Text style={{ flex: 1 }}>{requirement.text}</Text>
                <EnumBadge enumKey={EnumKey.RequirementCheck} value={requirement.check} />
              </Row>
            ))}
          </Card>
        </Section>

        <Section title={t('opportunity.source')}>
          <Card>
            <Text>{o.description}</Text>
            <ListRow
              icon={Archive}
              title={t('opportunity.viewCircular')}
              subtitle={t('opportunity.circularArchived', { date: format.date(o.circular.archivedAt) })}
              onPress={() => router.push(Routes.circular(o.id))}
            />
          </Card>
        </Section>
      </Screen>
    </>
  );
}
