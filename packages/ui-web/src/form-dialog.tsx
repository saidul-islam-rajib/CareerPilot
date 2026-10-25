import type { FormEvent, ReactNode } from 'react';
import { Dialog } from 'radix-ui';
import { X } from 'lucide-react';
import { useT } from '@careerpilot/client-core';
import { Button } from './button';

export interface FormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  submitLabel: string;
  submitting?: boolean;
  error?: string;
  onSubmit: () => void;
  extraAction?: ReactNode;
  children: ReactNode;
}

export function FormDialog({ open, onOpenChange, title, description, submitLabel, submitting = false, error, onSubmit, extraAction, children }: FormDialogProps) {
  const t = useT();
  const submit = (event: FormEvent) => {
    event.preventDefault();
    onSubmit();
  };
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-overlay" />
        <Dialog.Content
          className="fixed inset-x-0 bottom-0 z-50 flex max-h-[92dvh] flex-col rounded-t-card bg-card shadow-xl focus:outline-none sm:inset-x-auto sm:bottom-auto sm:left-1/2 sm:top-1/2 sm:max-h-[85dvh] sm:w-[calc(100%-2rem)] sm:max-w-lg sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-card"
          {...(description ? {} : { 'aria-describedby': undefined })}
        >
          <form onSubmit={submit} noValidate className="flex min-h-0 flex-1 flex-col">
            <div className="flex items-start justify-between gap-3 border-b border-border px-5 pb-3 pt-5">
              <div className="flex min-w-0 flex-col gap-1">
                <Dialog.Title className="text-lg font-semibold text-foreground">{title}</Dialog.Title>
                {description ? <Dialog.Description className="text-sm text-muted">{description}</Dialog.Description> : null}
              </div>
              <Dialog.Close asChild>
                <Button variant="ghost" size="icon" icon={X} aria-label={t('common.close')} />
              </Dialog.Close>
            </div>
            <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-5 py-4">{children}</div>
            {error ? (
              <p role="alert" className="mx-5 mb-2 rounded-control bg-danger-subtle px-3 py-2 text-sm text-danger">
                {error}
              </p>
            ) : null}
            <div className="flex flex-col-reverse gap-2 border-t border-border px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-3 sm:flex-row sm:items-center sm:justify-end">
              {extraAction ? <div className="sm:mr-auto">{extraAction}</div> : null}
              <Dialog.Close asChild>
                <Button variant="outline">{t('common.cancel')}</Button>
              </Dialog.Close>
              <Button type="submit" loading={submitting}>
                {submitLabel}
              </Button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
