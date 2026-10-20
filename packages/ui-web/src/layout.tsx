import type { ReactNode } from 'react';
import { ChevronRight, type LucideIcon } from 'lucide-react';
import { cn } from './cn';

export function PageHeader({ title, description, actions }: { title: string; description?: string; actions?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold text-foreground md:text-3xl">{title}</h1>
        {description ? <p className="text-muted">{description}</p> : null}
      </div>
      {actions}
    </div>
  );
}

export function Section({ title, action, children, className }: { title: string; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cn('flex flex-col gap-3', className)}>
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-lg font-semibold text-foreground">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

export function Separator() {
  return <hr className="border-border" />;
}

export interface ListRowProps {
  title: string;
  subtitle?: string;
  icon?: LucideIcon;
  trailing?: ReactNode;
  onClick?: () => void;
  href?: string;
  destructive?: boolean;
}

export function ListRow({ title, subtitle, icon: Glyph, trailing, onClick, href, destructive = false }: ListRowProps) {
  const interactive = Boolean(onClick || href);
  const content = (
    <>
      {Glyph ? <Glyph className={cn('size-5 shrink-0', destructive ? 'text-danger' : 'text-primary')} aria-hidden /> : null}
      <span className="flex min-w-0 flex-1 flex-col">
        <span className={cn('font-semibold', destructive ? 'text-danger' : 'text-foreground')}>{title}</span>
        {subtitle ? <span className="text-sm text-muted">{subtitle}</span> : null}
      </span>
      {trailing}
      {interactive ? <ChevronRight className="size-5 shrink-0 text-muted" aria-hidden /> : null}
    </>
  );
  const classes = 'flex min-h-11 w-full items-center gap-3 rounded-control py-2 text-left';
  if (href) {
    return (
      <a href={href} className={cn(classes, 'hover:bg-surface')}>
        {content}
      </a>
    );
  }
  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={cn(classes, 'hover:bg-surface')}>
        {content}
      </button>
    );
  }
  return <div className={classes}>{content}</div>;
}

export function ProgressBar({ value, label }: { value: number; label: string }) {
  const clamped = Math.max(0, Math.min(1, value));
  const percent = Math.round(clamped * 100);
  return (
    <div className="flex flex-col gap-1">
      <p className="text-sm text-muted">{label}</p>
      <div role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent} className="h-2 overflow-hidden rounded-pill bg-neutral-subtle">
        <div className="h-full rounded-pill bg-primary" style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}
