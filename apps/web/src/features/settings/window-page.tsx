'use client';

import { useEffect, useState } from 'react';
import { CheckCircle2 } from 'lucide-react';
import { useSchemas, useSettings, useT, useUpdateWindow } from '@careerpilot/client-core';
import { StatusTone, SubmissionWindowKind } from '@careerpilot/domain-ui-logic';
import { validate, type FieldErrors } from '@careerpilot/validation';
import { Banner, Button, Card, ErrorState, LoadingState, PageHeader, Segmented, TextField } from '@careerpilot/ui-web';

export function WindowPage() {
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
    <>
      <PageHeader title={t('settings.submissionWindow')} description={t('settings.submissionWindowBody')} />
      {settings.isPending ? <LoadingState /> : null}
      {settings.isError ? <ErrorState onRetry={() => void settings.refetch()} /> : null}
      {update.isSuccess ? <Banner tone={StatusTone.Success} icon={CheckCircle2} title={t('common.saved')} /> : null}
      {settings.isSuccess ? (
        <Card className="max-w-xl gap-4">
          <Segmented
            options={[
              { value: SubmissionWindowKind.AsSoonAsReady, label: t('settings.asSoonAsReady') },
              { value: SubmissionWindowKind.DailyWindow, label: t('settings.dailyWindow') },
            ]}
            value={kind}
            onChange={setKind}
            label={t('settings.submissionWindow')}
          />
          {kind === SubmissionWindowKind.DailyWindow ? (
            <div className="grid grid-cols-2 gap-3">
              <TextField label={t('settings.windowStart')} value={start} onChange={(e) => setStart(e.target.value)} error={errors.start} placeholder={t('settings.timePlaceholder')} inputMode="numeric" />
              <TextField label={t('settings.windowEnd')} value={end} onChange={(e) => setEnd(e.target.value)} error={errors.end} placeholder={t('settings.timePlaceholder')} inputMode="numeric" />
            </div>
          ) : null}
          <Button onClick={save} loading={update.isPending}>
            {t('common.save')}
          </Button>
        </Card>
      ) : null}
    </>
  );
}
