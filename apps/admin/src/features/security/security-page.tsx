'use client';

import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { ShieldCheck } from 'lucide-react';
import { type MfaEnrolment, type RecoveryCodes } from '@careerpilot/api-client';
import { useT } from '@careerpilot/client-core';
import { Button, Card, PageHeader, TextField } from '@careerpilot/ui-web';
import { useAdminApi } from '@/core/admin-services';

function RecoveryCodeList({ codes, onDone }: { codes: string[]; onDone: () => void }) {
  const t = useT();
  return (
    <Card>
      <div className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">{t('admin.mfa.recoveryTitle')}</h2>
        <p className="text-sm text-muted">{t('admin.mfa.recoveryWarning')}</p>
        <ul className="grid grid-cols-1 gap-2 font-mono text-sm sm:grid-cols-2" data-testid="recovery-codes">
          {codes.map((code) => (
            <li key={code} className="rounded-control bg-surface px-3 py-2">
              {code}
            </li>
          ))}
        </ul>
        <Button onClick={onDone}>{t('admin.mfa.recoveryDone')}</Button>
      </div>
    </Card>
  );
}

function EnrolmentCard({ onCodes }: { onCodes: (codes: RecoveryCodes) => void }) {
  const t = useT();
  const api = useAdminApi();
  const [enrolment, setEnrolment] = useState<MfaEnrolment>();
  const [code, setCode] = useState('');
  const begin = useMutation({ mutationFn: () => api.auth.beginMfaEnrolment(), onSuccess: setEnrolment });
  const confirm = useMutation({
    mutationFn: () => api.auth.confirmMfa(code),
    onSuccess: (codes) => {
      setEnrolment(undefined);
      setCode('');
      onCodes(codes);
    },
  });
  return (
    <Card>
      <div className="flex flex-col gap-3">
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <ShieldCheck className="size-5" aria-hidden />
          {t('admin.mfa.title')}
        </h2>
        <p className="text-sm text-muted">{t('admin.mfa.intro')}</p>
        {enrolment ? (
          <form
            className="flex flex-col gap-3"
            noValidate
            onSubmit={(e) => {
              e.preventDefault();
              confirm.mutate();
            }}
          >
            <p className="text-sm">{t('admin.mfa.setUpStep')}</p>
            <TextField label={t('admin.mfa.secretLabel')} readOnly value={enrolment.secret} />
            <TextField label={t('admin.mfa.uriLabel')} readOnly value={enrolment.otpauthUri} />
            <TextField label={t('admin.mfa.codeLabel')} inputMode="numeric" autoComplete="one-time-code" value={code} onChange={(e) => setCode(e.target.value)} />
            {confirm.isError ? (
              <p role="alert" className="text-sm text-danger">
                {t('admin.mfa.confirmFailed')}
              </p>
            ) : null}
            <Button type="submit" loading={confirm.isPending}>
              {t('admin.mfa.confirm')}
            </Button>
          </form>
        ) : (
          <Button onClick={() => begin.mutate()} loading={begin.isPending}>
            {t('admin.mfa.setUp')}
          </Button>
        )}
      </div>
    </Card>
  );
}

function RegenerateCard({ onCodes }: { onCodes: (codes: RecoveryCodes) => void }) {
  const t = useT();
  const api = useAdminApi();
  const [code, setCode] = useState('');
  const regenerate = useMutation({
    mutationFn: () => api.auth.regenerateRecoveryCodes(code),
    onSuccess: (codes) => {
      setCode('');
      onCodes(codes);
    },
  });
  return (
    <Card>
      <form
        className="flex flex-col gap-3"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          regenerate.mutate();
        }}
      >
        <h2 className="text-lg font-semibold">{t('admin.mfa.regenerateTitle')}</h2>
        <p className="text-sm text-muted">{t('admin.mfa.regenerateHint')}</p>
        <TextField label={t('admin.mfa.codeLabel')} inputMode="numeric" autoComplete="one-time-code" value={code} onChange={(e) => setCode(e.target.value)} />
        {regenerate.isError ? (
          <p role="alert" className="text-sm text-danger">
            {t('admin.mfa.regenerateFailed')}
          </p>
        ) : null}
        <Button type="submit" variant="outline" loading={regenerate.isPending}>
          {t('admin.mfa.regenerate')}
        </Button>
      </form>
    </Card>
  );
}

export function SecurityPage() {
  const t = useT();
  const [codes, setCodes] = useState<RecoveryCodes>();
  return (
    <>
      <PageHeader title={t('admin.mfa.title')} />
      {codes ? (
        <RecoveryCodeList codes={codes.codes} onDone={() => setCodes(undefined)} />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          <EnrolmentCard onCodes={setCodes} />
          <RegenerateCard onCodes={setCodes} />
        </div>
      )}
    </>
  );
}
