import { useEffect, useState } from 'react';
import { useSchemas, useSettings, useT, useUpdateWindow } from '@careerpilot/client-core';
import { CheckCircle2 } from 'lucide-react-native';
import { StatusTone, SubmissionWindowKind } from '@careerpilot/domain-ui-logic';
import { validate, type FieldErrors } from '@careerpilot/validation';
import { Banner, Button, Card, ErrorState, LoadingState, Row, Screen, Segmented, Text, TextField, TextTone } from '@/ui';

export function WindowScreen() {
  const t = useT();
  const schemas = useSchemas();
  const settings = useSettings();
  const update = useUpdateWindow();
  const [kind, setKind] = useState<SubmissionWindowKind>(SubmissionWindowKind.AsSoonAsReady);
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [errors, setErrors] = useState<FieldErrors>({});

  useEffect(() => {
    const window = settings.data?.submissionWindow;
    if (window) {
      setKind(window.kind);
      setStart(window.start ?? '');
      setEnd(window.end ?? '');
    }
  }, [settings.data?.submissionWindow]);

  if (settings.isPending) {
    return <LoadingState />;
  }
  if (settings.isError) {
    return <ErrorState onRetry={() => void settings.refetch()} />;
  }

  const save = () => {
    if (kind === SubmissionWindowKind.AsSoonAsReady) {
      update.mutate({ kind });
      return;
    }
    const result = validate(schemas.submissionWindow, { start, end });
    if (!result.ok) {
      setErrors(result.errors);
      return;
    }
    setErrors({});
    update.mutate({ kind, ...result.value });
  };

  return (
    <Screen testID="window-screen">
      {update.isSuccess ? <Banner tone={StatusTone.Success} icon={CheckCircle2} title={t('common.saved')} /> : null}
      <Card>
        <Text tone={TextTone.Muted}>{t('settings.submissionWindowBody')}</Text>
        <Segmented
          options={[
            { value: SubmissionWindowKind.AsSoonAsReady, label: t('settings.asSoonAsReady') },
            { value: SubmissionWindowKind.DailyWindow, label: t('settings.dailyWindow') },
          ]}
          value={kind}
          onChange={setKind}
          accessibilityLabel={t('settings.submissionWindow')}
        />
        {kind === SubmissionWindowKind.DailyWindow ? (
          <Row align="flex-start">
            <TextField label={t('settings.windowStart')} value={start} onChangeText={setStart} error={errors.start} placeholder={t('settings.timePlaceholder')} keyboardType="numbers-and-punctuation" testID="window-start" />
            <TextField label={t('settings.windowEnd')} value={end} onChangeText={setEnd} error={errors.end} placeholder={t('settings.timePlaceholder')} keyboardType="numbers-and-punctuation" testID="window-end" />
          </Row>
        ) : null}
        <Button label={t('common.save')} onPress={save} loading={update.isPending} fullWidth testID="window-save" />
      </Card>
    </Screen>
  );
}
