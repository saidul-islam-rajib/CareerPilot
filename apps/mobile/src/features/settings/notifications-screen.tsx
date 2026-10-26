import { useRouter } from 'expo-router';
import { Pressable, View } from 'react-native';
import { useFormat, useNotificationsForm, usePublicConfig, useServices, useT } from '@careerpilot/client-core';
import type { DigestTimePreset } from '@careerpilot/api-client';
import { AlertCircle, AlertTriangle, CalendarClock, CheckCircle2, Mail, Send, Sparkles, type LucideIcon } from 'lucide-react-native';
import { StatusTone } from '@careerpilot/domain-ui-logic';
import { Routes } from '@/core/navigation/routes';
import { useTheme } from '@/core/theme/theme';
import { Banner, Button, ButtonVariant, Card, Divider, ErrorState, Icon, LoadingState, Screen, SwitchRow, Text, TextField, TextTone, TextVariant, useSnackbar } from '@/ui';

const PREVIEW_SECTIONS: ReadonlyArray<{ key: string; icon: LucideIcon }> = [
  { key: 'matches', icon: Sparkles },
  { key: 'approvals', icon: CheckCircle2 },
  { key: 'sent', icon: Send },
  { key: 'attention', icon: AlertTriangle },
  { key: 'closing', icon: CalendarClock },
];

function PresetChoices({ presets, value, onSelect }: { presets: DigestTimePreset[]; value: string; onSelect: (time: string) => void }) {
  const t = useT();
  const theme = useTheme();
  const format = useFormat();
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.space.sm }}>
      {presets.map((preset) => {
        const selected = preset.time === value;
        const label = t(`settings.digestPresets.${preset.key}`);
        return (
          <Pressable
            key={preset.key}
            accessibilityRole="radio"
            accessibilityState={{ selected, checked: selected }}
            accessibilityLabel={`${label}, ${format.time(preset.time)}`}
            onPress={() => onSelect(preset.time)}
            style={{
              flexGrow: 1,
              minWidth: theme.touchTarget * 2,
              minHeight: theme.touchTarget,
              paddingHorizontal: theme.space.md,
              paddingVertical: theme.space.sm,
              borderRadius: theme.radius.control,
              borderWidth: theme.borderWidth.hairline,
              borderColor: selected ? theme.colors.primary : theme.colors.border,
              backgroundColor: selected ? theme.colors.primarySubtle : theme.colors.background,
            }}
          >
            <Text variant={TextVariant.Label} tone={selected ? TextTone.Primary : TextTone.Default}>
              {label}
            </Text>
            <Text variant={TextVariant.Caption} tone={selected ? TextTone.Primary : TextTone.Muted}>
              {format.time(preset.time)}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function DigestPreview({ enabled, time }: { enabled: boolean; time: string }) {
  const t = useT();
  const theme = useTheme();
  const format = useFormat();
  const { clock } = useServices();
  const { config } = usePublicConfig();
  return (
    <Card style={{ opacity: enabled ? 1 : theme.opacity.disabled }}>
      <Text variant={TextVariant.Subheading} accessibilityRole="header">
        {t('settings.digestPreviewTitle')}
      </Text>
      <Text tone={TextTone.Muted}>{enabled ? t('settings.digestPreviewWhen', { time: format.time(time) }) : t('settings.digestPreviewOff')}</Text>
      <View style={{ gap: theme.space.md, padding: theme.space.md, borderRadius: theme.radius.control, backgroundColor: theme.colors.surface, borderWidth: theme.borderWidth.hairline, borderColor: theme.colors.border }}>
        <View style={{ gap: theme.space.xs }}>
          <Text variant={TextVariant.Caption} tone={TextTone.Muted}>
            {config.branding.productName}
          </Text>
          <Text variant={TextVariant.Label}>{t('digest.subject', { date: format.date(clock.now().toISOString()) })}</Text>
        </View>
        <Divider />
        {PREVIEW_SECTIONS.map(({ key, icon }) => (
          <View key={key} style={{ flexDirection: 'row', gap: theme.space.sm }}>
            <Icon icon={icon} color={theme.colors.primary} />
            <View style={{ flex: 1 }}>
              <Text variant={TextVariant.Label}>{t(`settings.digestPreviewSections.${key}.title`)}</Text>
              <Text variant={TextVariant.Caption} tone={TextTone.Muted}>
                {t(`settings.digestPreviewSections.${key}.body`)}
              </Text>
            </View>
          </View>
        ))}
      </View>
      <Text variant={TextVariant.Caption} tone={TextTone.Muted}>
        {t('settings.digestPreviewQuiet')}
      </Text>
    </Card>
  );
}

export function NotificationsScreen() {
  const t = useT();
  const theme = useTheme();
  const router = useRouter();
  const snackbar = useSnackbar();
  const form = useNotificationsForm({ onSaved: () => snackbar.show({ message: t('common.saved') }) });
  const { settings, values } = form;

  if (settings.isPending) {
    return <LoadingState />;
  }
  if (settings.isError) {
    return <ErrorState onRetry={() => void settings.refetch()} />;
  }

  const footer = (
    <View style={{ gap: theme.space.sm }}>
      {form.dirty ? (
        <Text variant={TextVariant.Caption} tone={TextTone.Muted} accessibilityLiveRegion="polite">
          {t('settings.unsavedChanges')}
        </Text>
      ) : null}
      <Button label={t('common.save')} onPress={form.submit} loading={form.saving} disabled={!form.dirty} fullWidth testID="notifications-save" />
    </View>
  );

  return (
    <Screen testID="notifications-screen" footer={footer}>
      {form.formError ? <Banner tone={StatusTone.Danger} icon={AlertCircle} title={t(form.formError)} /> : null}
      <Text tone={TextTone.Muted}>{t('settings.notificationsBody')}</Text>
      <Card>
        <SwitchRow label={t('settings.digestEnabled')} description={t('settings.digestBody')} value={values.digestEnabled} onChange={form.setDigestEnabled} testID="digest-enabled" />
        <Divider />
        {values.digestEnabled ? (
          <View style={{ gap: theme.space.md }}>
            <Text variant={TextVariant.Label}>{t('settings.digestTime')}</Text>
            <PresetChoices presets={form.presets} value={values.digestTime} onSelect={form.setDigestTime} />
            <TextField
              label={t('settings.digestCustomTime')}
              value={values.digestTime}
              onChangeText={form.setDigestTime}
              error={form.errors.digestTime}
              hint={t('settings.digestTimeZone', { timeZone: form.timeZone })}
              placeholder={t('settings.timePlaceholder')}
              keyboardType="numbers-and-punctuation"
              testID="digest-time"
            />
            {form.recipient ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.space.sm, padding: theme.space.md, borderRadius: theme.radius.control, backgroundColor: theme.colors.neutralSubtle }}>
                <Icon icon={Mail} color={theme.colors.textMuted} />
                <View style={{ flex: 1 }}>
                  <Text variant={TextVariant.Caption} tone={TextTone.Muted}>
                    {t('settings.digestSentTo')}
                  </Text>
                  <Text variant={TextVariant.Label}>{form.recipient}</Text>
                </View>
                <Button label={t('settings.digestChangeEmail')} variant={ButtonVariant.Ghost} onPress={() => router.push(Routes.profile)} />
              </View>
            ) : null}
          </View>
        ) : (
          <Text tone={TextTone.Muted}>{t('settings.digestOffNote')}</Text>
        )}
      </Card>
      <DigestPreview enabled={values.digestEnabled} time={values.digestTime} />
    </Screen>
  );
}
