import { Pressable, View } from 'react-native';
import { useSubmissionWindowForm, useT } from '@careerpilot/client-core';
import { StatusTone, SubmissionWindowKind } from '@careerpilot/domain-ui-logic';
import { CheckCircle2, Clock, Zap } from '@/ui/icons';
import { useTheme } from '@/core/theme/theme';
import { Banner, Button, Card, ChoiceList, ErrorState, Icon, IconSize, LoadingState, Row, Screen, Text, TextField, TextTone, TextVariant } from '@/ui';

export function WindowScreen() {
  const t = useT();
  const theme = useTheme();
  const form = useSubmissionWindowForm();
  const { settings } = form;

  if (settings.isPending) {
    return <LoadingState />;
  }
  if (settings.isError) {
    return <ErrorState onRetry={() => void settings.refetch()} />;
  }
  const daily = form.kind === SubmissionWindowKind.DailyWindow;
  const summary =
    daily && form.start && form.end ? t('settings.windowSummaryDaily', { start: form.start, end: form.end, zone: settings.data.timeZone }) : t('settings.windowSummaryNow');

  return (
    <Screen
      testID="window-screen"
      footer={<Button label={t('common.save')} onPress={form.save} loading={form.saving} disabled={!form.dirty} fullWidth testID="window-save" />}
    >
      {form.saved ? <Banner tone={StatusTone.Success} icon={CheckCircle2} title={t('common.saved')} /> : null}
      <Text tone={TextTone.Muted}>{t('settings.submissionWindowBody')}</Text>
      <Card>
        <ChoiceList
          label={t('settings.submissionWindow')}
          value={form.kind}
          onChange={form.chooseKind}
          choices={[
            { value: SubmissionWindowKind.AsSoonAsReady, label: t('settings.asSoonAsReady'), description: t('settings.asSoonAsReadyBody'), icon: Zap },
            { value: SubmissionWindowKind.DailyWindow, label: t('settings.dailyWindow'), description: t('settings.dailyWindowBody'), icon: Clock },
          ]}
        />
      </Card>
      {daily ? (
        <Card>
          <Text variant={TextVariant.Subheading}>{t('settings.windowHours')}</Text>
          <Text variant={TextVariant.Caption} tone={TextTone.Muted}>
            {t('settings.windowPresetsLabel')}
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.space.xs }}>
            {form.presets.map((preset) => {
              const active = form.activePreset === preset.key;
              return (
                <Pressable
                  key={preset.key}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  accessibilityLabel={t(`settings.windowPresets.${preset.key}`)}
                  onPress={() => form.applyPreset(preset)}
                  testID={`window-preset-${preset.key}`}
                  style={{
                    minHeight: theme.touchTarget,
                    justifyContent: 'center',
                    paddingHorizontal: theme.space.md,
                    borderRadius: theme.radius.pill,
                    borderWidth: theme.borderWidth.hairline,
                    borderColor: active ? theme.colors.primary : theme.colors.input,
                    backgroundColor: active ? theme.colors.primary : theme.colors.background,
                  }}
                >
                  <Text variant={TextVariant.Label} tone={active ? TextTone.Inverse : TextTone.Default}>
                    {t(`settings.windowPresets.${preset.key}`)} · {preset.start}–{preset.end}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <Row align="flex-start">
            <TextField label={t('settings.windowStart')} value={form.start} onChangeText={form.setStart} error={form.errors.start} placeholder={t('settings.timePlaceholder')} keyboardType="numbers-and-punctuation" testID="window-start" />
            <TextField label={t('settings.windowEnd')} value={form.end} onChangeText={form.setEnd} error={form.errors.end} placeholder={t('settings.timePlaceholder')} keyboardType="numbers-and-punctuation" testID="window-end" />
          </Row>
        </Card>
      ) : null}
      <View
        style={{
          flexDirection: 'row',
          gap: theme.space.sm,
          padding: theme.space.md,
          borderRadius: theme.radius.control,
          backgroundColor: theme.colors.primarySubtle,
        }}
      >
        <Icon icon={Clock} size={IconSize.Small} color={theme.colors.primary} />
        <Text style={{ flex: 1 }}>{summary}</Text>
      </View>
      {form.dirty ? (
        <Text variant={TextVariant.Caption} tone={TextTone.Muted}>
          {t('settings.unsavedChanges')}
        </Text>
      ) : null}
    </Screen>
  );
}
