import { useRouter } from 'expo-router';
import { useT } from '@careerpilot/client-core';
import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BadgeCheck, FileSearch, ShieldCheck } from 'lucide-react-native';
import { Routes } from '@/core/navigation/routes';
import { useTheme } from '@/core/theme/theme';
import { BrandMark, Button, ButtonVariant, Icon, TeamSoberCredit, Text, TextTone, TextVariant } from '@/ui';

export function WelcomeScreen() {
  const t = useT();
  const theme = useTheme();
  const router = useRouter();
  const points = [
    { icon: FileSearch, text: t('auth.pointMatches') },
    { icon: BadgeCheck, text: t('auth.pointApproval') },
    { icon: ShieldCheck, text: t('auth.pointRecord') },
  ];
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <View style={{ flex: 1, width: '100%', maxWidth: theme.contentMaxWidth, alignSelf: 'center', padding: theme.space.xl, justifyContent: 'space-between' }}>
        <View style={{ gap: theme.space.xl, marginTop: theme.space.xxl }}>
          <BrandMark size={theme.space.xxxl + theme.space.xl} />
          <View style={{ gap: theme.space.md }}>
            <Text variant={TextVariant.Display}>{t('auth.welcomeTitle')}</Text>
            <Text tone={TextTone.Muted}>{t('auth.welcomeBody')}</Text>
          </View>
          <View style={{ gap: theme.space.md }}>
            {points.map((point) => (
              <View key={point.text} style={{ flexDirection: 'row', alignItems: 'center', gap: theme.space.md }}>
                <View style={{ padding: theme.space.sm, borderRadius: theme.radius.control, backgroundColor: theme.colors.primarySubtle }}>
                  <Icon icon={point.icon} color={theme.colors.primary} />
                </View>
                <Text variant={TextVariant.Subheading}>{point.text}</Text>
              </View>
            ))}
          </View>
        </View>
        <View style={{ gap: theme.space.md }}>
          <Button label={t('auth.createAccount')} fullWidth onPress={() => router.push(Routes.register)} />
          <Button label={t('auth.signIn')} variant={ButtonVariant.Outline} fullWidth onPress={() => router.push(Routes.signIn)} />
          <TeamSoberCredit compact />
        </View>
      </View>
    </SafeAreaView>
  );
}
