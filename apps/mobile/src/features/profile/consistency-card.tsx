import { Pressable, View } from 'react-native';
import { useRouter } from 'expo-router';
import type { ConsistencyWarning } from '@careerpilot/api-client';
import { useT } from '@careerpilot/client-core';
import { AlertTriangle } from '@/ui/icons';
import { Routes } from '@/core/navigation/routes';
import { useTheme } from '@/core/theme/theme';
import { Card, Icon, Text, TextTone, TextVariant } from '@/ui';

const BASICS_SECTION = 'profile';
const CONTACTS_SECTION = 'contacts';

function routeOf(warning: ConsistencyWarning) {
  if (warning.section === BASICS_SECTION) {
    return Routes.editBasics;
  }
  if (warning.section === CONTACTS_SECTION) {
    return Routes.editContact(warning.entryId);
  }
  return Routes.editEntry(warning.section, warning.entryId);
}

export function ConsistencyCard({ warnings }: { warnings: ConsistencyWarning[] }) {
  const t = useT();
  const theme = useTheme();
  const router = useRouter();
  if (warnings.length === 0) {
    return null;
  }
  return (
    <Card style={{ borderColor: theme.colors.warning, backgroundColor: theme.colors.warningSubtle }} testID="consistency-card">
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.space.sm }}>
        <Icon icon={AlertTriangle} color={theme.colors.warning} />
        <Text variant={TextVariant.Subheading} accessibilityRole="header" style={{ flex: 1 }}>
          {t('profile.consistency.title')}
        </Text>
      </View>
      <Text tone={TextTone.Muted}>{t('profile.consistency.body')}</Text>
      {warnings.map((warning) => {
        const message = t(`profile.consistency.${warning.kind}`, { expected: warning.expected, found: warning.found });
        return (
          <Pressable
            key={`${warning.kind}-${warning.entryId}-${warning.field}`}
            accessibilityRole="button"
            accessibilityLabel={`${message} ${t('profile.consistency.fix')}`}
            onPress={() => router.push(routeOf(warning))}
            style={{ flexDirection: 'row', alignItems: 'center', gap: theme.space.sm, minHeight: theme.touchTarget }}
          >
            <Text style={{ flex: 1 }}>{message}</Text>
            <Text tone={TextTone.Primary} variant={TextVariant.Label}>
              {t('profile.consistency.fix')}
            </Text>
          </Pressable>
        );
      })}
    </Card>
  );
}
