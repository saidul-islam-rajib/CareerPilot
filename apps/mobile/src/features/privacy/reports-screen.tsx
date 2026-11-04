import { useState } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { shiftReportDate, useFormat, useReport, useRequestExport, useT } from '@careerpilot/client-core';
import { ExportFormat, ExportKind, ReportPeriod, StatusTone } from '@careerpilot/domain-ui-logic';
import { Routes } from '@/core/navigation/routes';
import { useTheme } from '@/core/theme/theme';
import { Badge, Button, ButtonVariant, Card, ErrorState, LoadingState, Screen, Segmented, SnackbarTone, Text, TextTone, TextVariant, useSnackbar } from '@/ui';

const TODAY_LENGTH = 10;

export function ReportsScreen() {
  const t = useT();
  const format = useFormat();
  const theme = useTheme();
  const router = useRouter();
  const snackbar = useSnackbar();
  const [period, setPeriod] = useState<ReportPeriod>(ReportPeriod.Daily);
  const [date, setDate] = useState<string | undefined>(undefined);
  const report = useReport(period, date);
  const exportReport = useRequestExport();
  const anchor = date ?? report.data?.startDate ?? new Date().toISOString().slice(0, TODAY_LENGTH);
  const ask = (file: ExportFormat) =>
    exportReport.mutate(
      { kind: ExportKind.Report, format: file, period, date: anchor },
      {
        onSuccess: () => snackbar.show({ message: t('reports.exportQueued') }),
        onError: () => snackbar.show({ message: t('privacy.exports.limit'), tone: SnackbarTone.Danger }),
      },
    );
  return (
    <Screen testID="reports-screen">
      <Segmented
        accessibilityLabel={t('reports.screenTitle')}
        value={period}
        onChange={(next) => {
          setPeriod(next);
          setDate(undefined);
        }}
        options={[
          { value: ReportPeriod.Daily, label: t('reports.daily') },
          { value: ReportPeriod.Weekly, label: t('reports.weekly') },
        ]}
      />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.space.sm }}>
        <Button label={t('reports.previous')} variant={ButtonVariant.Secondary} onPress={() => setDate(shiftReportDate(anchor, period, -1))} />
        <Button label={t('reports.next')} variant={ButtonVariant.Secondary} onPress={() => setDate(shiftReportDate(anchor, period, 1))} />
        <Button label={t('reports.thisPeriod')} variant={ButtonVariant.Ghost} onPress={() => setDate(undefined)} />
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.space.sm }}>
        <Button label={t('reports.exportCsv')} variant={ButtonVariant.Secondary} onPress={() => ask(ExportFormat.Csv)} testID="report-export-csv" />
        <Button label={t('reports.exportPdf')} variant={ButtonVariant.Secondary} onPress={() => ask(ExportFormat.Pdf)} />
      </View>
      {report.isLoading ? <LoadingState /> : null}
      {report.isError ? <ErrorState onRetry={() => void report.refetch()} /> : null}
      {report.data ? (
        <>
          <Text tone={TextTone.Muted}>{t('reports.range', { start: report.data.startDate, end: report.data.endDate })}</Text>
          <Card>
            {report.data.buckets.map((bucket) => (
              <View key={bucket.bucket} style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text>{t(`reports.bucket.${bucket.bucket}`)}</Text>
                <Text variant={TextVariant.Subheading}>{bucket.count}</Text>
              </View>
            ))}
            <Text>{t('reports.responses', { count: report.data.responses })}</Text>
          </Card>
          {report.data.rows.length === 0 ? <Text tone={TextTone.Muted}>{t('reports.nothing')}</Text> : null}
          {report.data.rows.map((row) => (
            <Card key={row.applicationId}>
              <Text variant={TextVariant.Subheading}>{row.title}</Text>
              <Text tone={TextTone.Muted}>{row.organization}</Text>
              <Badge label={t(`reports.bucket.${row.bucket}`)} tone={StatusTone.Neutral} />
              <Button label={t('reports.openRecord')} variant={ButtonVariant.Ghost} onPress={() => router.push(Routes.application(row.applicationId))} />
            </Card>
          ))}
          {report.data.upcoming.length > 0 ? (
            <Card>
              <Text variant={TextVariant.Heading}>{t('reports.upcoming')}</Text>
              {report.data.upcoming.map((item) => (
                <Text key={`${item.applicationId}-${item.dueAt}`}>
                  {t('reports.upcomingLine', { when: format.dateTime(item.dueAt), organization: item.organization, title: item.taskTitle })}
                </Text>
              ))}
            </Card>
          ) : null}
        </>
      ) : null}
    </Screen>
  );
}
