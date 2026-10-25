import type { ReactNode } from 'react';
import { Dialog } from 'radix-ui';
import { ExternalLink, X } from 'lucide-react';
import { useT } from '@careerpilot/client-core';
import { Button, buttonVariants } from './button';

export interface DocumentViewerProps {
  url: string;
  title: string;
  subtitle?: string;
  trigger: ReactNode;
}

export function DocumentViewer({ url, title, subtitle, trigger }: DocumentViewerProps) {
  const t = useT();
  return (
    <Dialog.Root>
      <Dialog.Trigger asChild>{trigger}</Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-overlay" />
        <Dialog.Content className="fixed inset-0 z-50 flex flex-col bg-card md:inset-6 md:rounded-card md:shadow-xl" aria-describedby={undefined}>
          <div className="flex items-center gap-3 border-b border-border px-4 py-3">
            <div className="flex min-w-0 flex-1 flex-col">
              <Dialog.Title className="truncate text-lg font-semibold text-foreground">{title}</Dialog.Title>
              {subtitle ? <p className="truncate text-xs text-muted">{subtitle}</p> : null}
            </div>
            <a href={url} target="_blank" rel="noopener noreferrer" className={buttonVariants({ variant: 'outline', size: 'sm' })}>
              <ExternalLink className="size-4" aria-hidden />
              <span className="hidden sm:inline">{t('profile.openInNewTab')}</span>
            </a>
            <Dialog.Close asChild>
              <Button variant="ghost" size="icon" icon={X} aria-label={t('common.close')} />
            </Dialog.Close>
          </div>
          <iframe src={url} title={t('profile.documentViewer')} className="min-h-0 w-full flex-1 bg-surface md:rounded-b-card" />
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
