import { useRouter } from 'expo-router';
import { useT } from '@careerpilot/client-core';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Archive, BadgeCheck, Building2, Clock, FileSearch, KeyRound, Lightbulb, MapPin, PauseCircle, ShieldCheck, Sparkles, UserRound, type LucideIcon } from '@/ui/icons';
import { Routes } from '@/core/navigation/routes';
import { useTheme } from '@/core/theme/theme';
import { BrandMark, Button, ButtonVariant, Card, Icon, IconSize, TeamSoberCredit, Text, TextTone, TextVariant } from '@/ui';

const PREVIEW_SKILLS = ['first', 'second', 'third'] as const;
const HIGHLIGHTS: { key: string; icon: LucideIcon }[] = [
  { key: 'reasons', icon: FileSearch },
  { key: 'skills', icon: Lightbulb },
  { key: 'companies', icon: Building2 },
  { key: 'focus', icon: MapPin },
  { key: 'control', icon: PauseCircle },
  { key: 'proof', icon: Archive },
];
const PROMISES: { key: string; icon: LucideIcon }[] = [
  { key: 'facts', icon: UserRound },
  { key: 'captcha', icon: ShieldCheck },
  { key: 'duplicate', icon: Clock },
  { key: 'secrets', icon: KeyRound },
];

function Preview() {
  const t = useT();
  const theme = useTheme();
  return (
    <Card accessibilityLabel={t('welcome.preview.label')}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: theme.space.sm }}>
        <Text variant={TextVariant.Subheading}>{t('welcome.preview.heading')}</Text>
        <View style={{ paddingHorizontal: theme.space.sm, paddingVertical: theme.space.xxs, borderRadius: theme.radius.pill, backgroundColor: theme.colors.primarySubtle }}>
          <Text variant={TextVariant.Caption} style={{ color: theme.colors.primary }}>
            {t('welcome.preview.track')}
          </Text>
        </View>
      </View>
      <View style={{ gap: theme.space.xs, padding: theme.space.md, borderRadius: theme.radius.control, borderWidth: theme.borderWidth.hairline, borderColor: theme.colors.primary }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: theme.space.sm }}>
          <View style={{ flex: 1 }}>
            <Text variant={TextVariant.Subheading} numberOfLines={1}>
              {t('welcome.preview.jobs.first.title')}
            </Text>
            <Text variant={TextVariant.Caption} tone={TextTone.Muted} numberOfLines={1}>
              {t('welcome.preview.jobs.first.company')} · {t('welcome.preview.jobs.first.place')}
            </Text>
          </View>
          <Text variant={TextVariant.Caption} tone={TextTone.Success}>
            {t('welcome.preview.jobs.first.score')}
          </Text>
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: theme.space.xs }}>
          <Text variant={TextVariant.Caption} tone={TextTone.Muted}>
            {t('welcome.preview.skillsLabel')}
          </Text>
          {PREVIEW_SKILLS.map((skill) => (
            <View
              key={skill}
              style={{
                paddingHorizontal: theme.space.sm,
                paddingVertical: theme.space.xxs,
                borderRadius: theme.radius.pill,
                borderWidth: theme.borderWidth.hairline,
                borderStyle: 'dashed',
                borderColor: theme.colors.input,
              }}
            >
              <Text variant={TextVariant.Caption}>{t(`welcome.preview.skills.${skill}`)}</Text>
            </View>
          ))}
        </View>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.space.sm }}>
        <Icon icon={BadgeCheck} size={IconSize.Small} color={theme.colors.success} />
        <Text variant={TextVariant.Caption}>
          {t('welcome.preview.sentTitle')} · {t('welcome.preview.sentBody')}
        </Text>
      </View>
    </Card>
  );
}

export function WelcomeScreen() {
  const t = useT();
  const theme = useTheme();
  const router = useRouter();
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <ScrollView contentContainerStyle={{ width: '100%', maxWidth: theme.contentMaxWidth, alignSelf: 'center', padding: theme.space.xl, gap: theme.space.xl }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.space.sm }}>
          <BrandMark size={theme.space.xxxl} />
          <Text variant={TextVariant.Heading}>{t('app.name')}</Text>
        </View>
        <View style={{ gap: theme.space.md }}>
          <View
            style={{
              flexDirection: 'row',
              alignSelf: 'flex-start',
              alignItems: 'center',
              gap: theme.space.xs,
              paddingHorizontal: theme.space.md,
              paddingVertical: theme.space.xs,
              borderRadius: theme.radius.pill,
              borderWidth: theme.borderWidth.hairline,
              borderColor: theme.colors.border,
              backgroundColor: theme.colors.card,
            }}
          >
            <Icon icon={Sparkles} size={IconSize.Small} color={theme.colors.primary} />
            <Text variant={TextVariant.Caption} tone={TextTone.Muted} style={{ flexShrink: 1 }}>
              {t('welcome.eyebrow')}
            </Text>
          </View>
          <Text variant={TextVariant.Display} accessibilityRole="header">
            {t('welcome.titleLead')} <Text variant={TextVariant.Display} style={{ color: theme.colors.primary }}>{t('welcome.titleAccent')}</Text>
          </Text>
          <Text tone={TextTone.Muted}>{t('welcome.body')}</Text>
        </View>
        <Preview />
        <View style={{ gap: theme.space.md }}>
          <Text variant={TextVariant.Heading} accessibilityRole="header">
            {t('welcome.highlightsTitle')}
          </Text>
          {HIGHLIGHTS.map(({ key, icon }) => (
            <View key={key} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: theme.space.md }}>
              <View style={{ padding: theme.space.sm, borderRadius: theme.radius.control, backgroundColor: theme.colors.primarySubtle }}>
                <Icon icon={icon} color={theme.colors.primary} />
              </View>
              <View style={{ flex: 1, gap: theme.space.xxs }}>
                <Text variant={TextVariant.Subheading}>{t(`welcome.highlights.${key}.title`)}</Text>
                <Text variant={TextVariant.Label} tone={TextTone.Muted}>
                  {t(`welcome.highlights.${key}.body`)}
                </Text>
              </View>
            </View>
          ))}
        </View>
        <Card>
          <Text variant={TextVariant.Subheading} accessibilityRole="header">
            {t('welcome.promiseTitle')}
          </Text>
          {PROMISES.map(({ key, icon }) => (
            <View key={key} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: theme.space.sm }}>
              <Icon icon={icon} size={IconSize.Small} color={theme.colors.primary} />
              <Text variant={TextVariant.Label} style={{ flex: 1 }}>
                {t(`welcome.promises.${key}`)}
              </Text>
            </View>
          ))}
        </Card>
        <TeamSoberCredit compact />
      </ScrollView>
      <View
        style={{
          width: '100%',
          maxWidth: theme.contentMaxWidth,
          alignSelf: 'center',
          gap: theme.space.sm,
          paddingHorizontal: theme.space.xl,
          paddingVertical: theme.space.md,
          borderTopWidth: theme.borderWidth.hairline,
          borderTopColor: theme.colors.border,
          backgroundColor: theme.colors.background,
        }}
      >
        <Button label={t('auth.createAccount')} fullWidth onPress={() => router.push(Routes.register)} testID="welcome-create-account" />
        <Button label={t('auth.signIn')} variant={ButtonVariant.Outline} fullWidth onPress={() => router.push(Routes.signIn)} testID="welcome-sign-in" />
      </View>
    </SafeAreaView>
  );
}
