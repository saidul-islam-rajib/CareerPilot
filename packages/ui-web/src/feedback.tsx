import type { ReactNode } from 'react';
import { AlertCircle, Inbox, Loader2, type LucideIcon } from 'lucide-react';
import { useT } from '@careerpilot/client-core';
import type { StatusTone } from '@careerpilot/domain-ui-logic';
import { toneClasses } from './badge';
import { Button } from './button';
import { cn } from './cn';

export interface BannerProps {
  tone: StatusTone;
  icon: LucideIcon;
  title: string;
  body?: string;
  action?: ReactNode;
}

export function Banner({ tone, icon: Glyph, title, body, action }: BannerProps) {
  return (
    <div role="status" className={cn('flex items-start gap-3 rounded-card p-4', toneClasses({ tone }))}>
      <Glyph className="mt-0.5 size-5 shrink-0" aria-hidden />
      <div className="flex flex-1 flex-col gap-1">
        <p className="font-semibold">{title}</p>
        {body ? <p className="text-sm">{body}</p> : null}
        {action ? <div className="mt-1">{action}</div> : null}
      </div>
    </div>
  );
}

export function LoadingState({ label }: { label?: string }) {
  const t = useT();
  return (
    <div role="progressbar" aria-label={label ?? t('common.loading')} className="flex flex-col items-center gap-3 p-8 text-muted">
      <Loader2 className="size-8 animate-spin text-primary" aria-hidden />
      <p>{label ?? t('common.loading')}</p>
    </div>
  );
}

export function ErrorState({ onRetry }: { onRetry?: () => void }) {
  const t = useT();
  return (
    <div role="alert" className="flex flex-col items-center gap-3 p-8 text-center">
      <AlertCircle className="size-8 text-danger" aria-hidden />
      <p className="text-lg font-semibold">{t('common.errorTitle')}</p>
      <p className="text-muted">{t('common.errorBody')}</p>
      {onRetry ? (
        <Button variant="outline" onClick={onRetry}>
          {t('common.retry')}
        </Button>
      ) : null}
    </div>
  );
}

export function EmptyState({ title, body }: { title?: string; body?: string }) {
  const t = useT();
  return (
    <div className="flex flex-col items-center gap-2 p-8 text-center">
      <Inbox className="size-8 text-muted" aria-hidden />
      <p className="font-semibold">{title ?? t('common.emptyTitle')}</p>
      {body ? <p className="text-muted">{body}</p> : null}
    </div>
  );
}
