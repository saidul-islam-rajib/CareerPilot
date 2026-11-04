import { useFormat, useT } from '@careerpilot/client-core';
import type { AcademicWarning, AttentionItem } from '@careerpilot/api-client';
import { StatusTone } from '@careerpilot/domain-ui-logic';
import { Info } from '@/ui/icons';
import { Badge, Banner, Text, TextTone, TextVariant } from '@/ui';
import { View } from 'react-native';
import { useTheme } from '@/core/theme/theme';

export function useEnumOptions() {
  const t = useT();
  return (name: string, values: readonly string[]) => values.map((value) => ({ value, label: t(`academic.enums.${name}.${value}`) }));
}

export function useEnumLabel() {
  const t = useT();
  return (name: string, value: string) => t(`academic.enums.${name}.${value}`);
}

export function Notices() {
  const t = useT();
  const theme = useTheme();
  return (
    <View style={{ gap: theme.space.sm }}>
      <Banner tone={StatusTone.Info} icon={Info} title={t('academic.neverSends')} />
      <Text variant={TextVariant.Caption} tone={TextTone.Muted}>
        {t('academic.notAdvice')}
      </Text>
    </View>
  );
}

export function WarningLine({ warning }: { warning: AcademicWarning }) {
  const t = useT();
  const format = useFormat();
  return <Text tone={TextTone.Warning}>{t(`academic.warnings.${warning.kind}`, { date: warning.on ? format.date(warning.on) : '' })}</Text>;
}

export function AttentionBadge({ item }: { item: AttentionItem }) {
  const t = useT();
  return <Badge label={t(`academic.attention.${item.kind}`)} tone={StatusTone.Warning} />;
}
