import { useState } from 'react';
import { View } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import type { ExportInput } from '@careerpilot/api-client';
import { exportKb, useExports, useFormat, useRequestExport, useT } from '@careerpilot/client-core';
import { ExportFormat, ExportKind, ExportStatus, ReportPeriod, StatusTone } from '@careerpilot/domain-ui-logic';
import { useTheme } from '@/core/theme/theme';
import { Badge, Button, ButtonVariant, Card, ErrorState, LoadingState, Screen, SnackbarTone, Text, TextField, TextTone, TextVariant, useSnackbar } from '@/ui';

const QUICK: { label: string; input: ExportInput }[] = [
  { label: 'privacy.exports.applicationsCsv', input: { kind: ExportKind.Applications, format: ExportFormat.Csv } },
  { label: 'privacy.exports.applicationsPdf', input: { kind: ExportKind.Applications, format: ExportFormat.Pdf } },
  { label: 'privacy.exports.weeklyReportPdf', input: { kind: ExportKind.Report, format: ExportFormat.Pdf, period: ReportPeriod.Weekly } },
];

function statusTone(status: ExportStatus) {
  if (status === ExportStatus.Ready) {
    return StatusTone.Success;
  }
  return status === ExportStatus.Failed ? StatusTone.Danger : StatusTone.Neutral;
}

export function ExportsScreen() {
  const t = useT();
  const format = useFormat();
  const theme = useTheme();
  const snackbar = useSnackbar();
  const exports = useExports();
  const request = useRequestExport();
  const [password, setPassword] = useState('');
  const ask = (input: ExportInput) =>
    request.mutate(input, {
      onSuccess: () => snackbar.show({ message: t('privacy.exports.requested') }),
      onError: () => snackbar.show({ message: t('privacy.exports.limit'), tone: SnackbarTone.Danger }),
    });
  return (
    <Screen testID="exports-screen">
      <Text tone={TextTone.Muted}>{t('privacy.exports.intro')}</Text>
      <Card>
        {QUICK.map((item) => (
          <Button key={item.label} label={t(item.label)} variant={ButtonVariant.Secondary} onPress={() => ask(item.input)} fullWidth />
        ))}
      </Card>
      <Card>
        <Text variant={TextVariant.Heading}>{t('privacy.exports.archiveTitle')}</Text>
        <Text tone={TextTone.Muted}>{t('privacy.exports.archiveBody')}</Text>
        <TextField label={t('privacy.exports.passwordLabel')} value={password} onChangeText={setPassword} secureTextEntry testID="archive-password" />
        <Button
          label={t('privacy.exports.archiveAction')}
          disabled={password.length === 0}
          loading={request.isPending}
          onPress={() => {
            ask({ kind: ExportKind.Archive, format: ExportFormat.Zip, password });
            setPassword('');
          }}
          fullWidth
        />
      </Card>
      <Text variant={TextVariant.Heading}>{t('privacy.exports.history')}</Text>
      {exports.isLoading ? <LoadingState /> : null}
      {exports.isError ? <ErrorState onRetry={() => void exports.refetch()} /> : null}
      {exports.data?.length === 0 ? <Text tone={TextTone.Muted}>{t('privacy.exports.empty')}</Text> : null}
      {exports.data?.map((item) => (
        <Card key={item.id}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: theme.space.md }}>
            <Text variant={TextVariant.Subheading}>
              {t(`privacy.exports.kind.${item.kind}`)} ({item.format.toUpperCase()})
            </Text>
            <Badge label={t(`privacy.exports.status.${item.status}`)} tone={statusTone(item.status)} />
          </View>
          {item.failure ? <Text tone={TextTone.Danger}>{t(`privacy.exports.failure.${item.failure}`)}</Text> : null}
          {item.downloadUrl ? (
            <>
              <Button label={t('privacy.exports.download')} onPress={() => void WebBrowser.openBrowserAsync(item.downloadUrl ?? '')} fullWidth />
              <Text tone={TextTone.Muted}>{t('privacy.exports.size', { size: exportKb(item.sizeBytes) })}</Text>
              {item.expiresAt ? <Text tone={TextTone.Muted}>{t('privacy.exports.availableUntil', { date: format.dateTime(item.expiresAt) })}</Text> : null}
            </>
          ) : null}
        </Card>
      ))}
    </Screen>
  );
}
