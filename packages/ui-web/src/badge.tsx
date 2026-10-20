import { cva } from 'class-variance-authority';
import { useEnumDisplay } from '@careerpilot/client-core';
import { StatusTone, type EnumKey } from '@careerpilot/domain-ui-logic';
import { cn } from './cn';

export const toneClasses = cva('', {
  variants: {
    tone: {
      neutral: 'bg-neutral-subtle text-neutral',
      info: 'bg-info-subtle text-info',
      success: 'bg-success-subtle text-success',
      warning: 'bg-warning-subtle text-warning',
      danger: 'bg-danger-subtle text-danger',
      primary: 'bg-primary-subtle text-primary',
    },
  },
  defaultVariants: { tone: 'neutral' },
});

export function Badge({ label, tone = StatusTone.Neutral, className }: { label: string; tone?: StatusTone; className?: string }) {
  return <span className={cn('inline-flex w-fit items-center rounded-pill px-2 py-0.5 text-xs font-semibold', toneClasses({ tone }), className)}>{label}</span>;
}

export function EnumBadge({ enumKey, value }: { enumKey: EnumKey; value: string }) {
  const display = useEnumDisplay()(enumKey, value);
  return <Badge label={display.label} tone={display.tone} />;
}
