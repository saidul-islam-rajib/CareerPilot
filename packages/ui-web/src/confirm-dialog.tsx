import type { ReactNode } from 'react';
import { AlertDialog } from 'radix-ui';
import { useT } from '@careerpilot/client-core';
import { Button } from './button';

export interface ConfirmDialogProps {
  title: string;
  body: string;
  confirmLabel: string;
  onConfirm: () => void;
  trigger: ReactNode;
  destructive?: boolean;
}

export function ConfirmDialog({ title, body, confirmLabel, onConfirm, trigger, destructive = false }: ConfirmDialogProps) {
  const t = useT();
  return (
    <AlertDialog.Root>
      <AlertDialog.Trigger asChild>{trigger}</AlertDialog.Trigger>
      <AlertDialog.Portal>
        <AlertDialog.Overlay className="fixed inset-0 z-40 bg-overlay" />
        <AlertDialog.Content className="fixed left-1/2 top-1/2 z-50 flex w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 flex-col gap-3 rounded-card bg-card p-6 shadow-xl">
          <AlertDialog.Title className="text-lg font-semibold text-foreground">{title}</AlertDialog.Title>
          <AlertDialog.Description className="text-muted">{body}</AlertDialog.Description>
          <div className="mt-2 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <AlertDialog.Cancel asChild>
              <Button variant="outline">{t('common.cancel')}</Button>
            </AlertDialog.Cancel>
            <AlertDialog.Action asChild>
              <Button variant={destructive ? 'destructive' : 'primary'} onClick={onConfirm}>
                {confirmLabel}
              </Button>
            </AlertDialog.Action>
          </div>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}
