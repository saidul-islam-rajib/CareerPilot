'use client';

import { createContext, useCallback, useContext, useMemo, useRef, useState, type PropsWithChildren } from 'react';
import { ApiErrorCode, isApiError } from '@careerpilot/api-client';
import { useT } from '@careerpilot/client-core';
import { FormDialog, TextField } from '@careerpilot/ui-web';
import { useAdminServices } from '@/core/admin-services';

type Action<T> = () => Promise<T>;

interface Pending {
  retry: () => void;
  fail: (error: unknown) => void;
}

interface ReauthValue {
  run<T>(action: Action<T>): Promise<T>;
}

const ReauthContext = createContext<ReauthValue | undefined>(undefined);

export function ReauthProvider({ children }: PropsWithChildren) {
  const t = useT();
  const { api, tokens } = useAdminServices();
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState<string>();
  const [submitting, setSubmitting] = useState(false);
  const pending = useRef<Pending | undefined>(undefined);

  const close = useCallback(() => {
    setOpen(false);
    setPassword('');
    setCode('');
    setError(undefined);
  }, []);

  const run = useCallback(
    function runGuarded<T>(action: Action<T>): Promise<T> {
      return new Promise<T>((resolve, reject) => {
        const attempt = () => {
          action().then(resolve, (failure: unknown) => {
            if (!isApiError(failure, ApiErrorCode.ReauthRequired)) {
              reject(failure);
              return;
            }
            pending.current = { retry: attempt, fail: reject };
            setOpen(true);
          });
        };
        attempt();
      });
    },
    [],
  );

  const submit = async () => {
    setSubmitting(true);
    setError(undefined);
    try {
      const proof = await api.auth.reauthenticate({ password, code });
      tokens.reauthToken = proof.reauthToken;
      const next = pending.current;
      pending.current = undefined;
      close();
      next?.retry();
    } catch (failure) {
      setError(isApiError(failure, ApiErrorCode.MfaRequired) ? t('admin.reauth.mfaMissing') : t('admin.reauth.failed'));
    } finally {
      setSubmitting(false);
    }
  };

  const dismiss = (next: boolean) => {
    if (next) {
      return;
    }
    const current = pending.current;
    pending.current = undefined;
    close();
    current?.fail(new Error(t('admin.reauth.failed')));
  };

  const value = useMemo(() => ({ run }), [run]);
  return (
    <ReauthContext.Provider value={value}>
      {children}
      <FormDialog
        open={open}
        onOpenChange={dismiss}
        title={t('admin.reauth.title')}
        description={t('admin.reauth.body')}
        submitLabel={t('admin.reauth.submit')}
        submitting={submitting}
        error={error}
        onSubmit={() => void submit()}
      >
        <TextField label={t('auth.password')} secret autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
        <TextField label={t('admin.mfa.codeLabel')} inputMode="numeric" autoComplete="one-time-code" value={code} onChange={(e) => setCode(e.target.value)} />
      </FormDialog>
    </ReauthContext.Provider>
  );
}

export function useReauth(): ReauthValue {
  const value = useContext(ReauthContext);
  if (!value) {
    throw new Error('ReauthProvider is missing');
  }
  return value;
}
