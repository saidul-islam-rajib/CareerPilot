import type { LucideIcon } from 'lucide-react';
import { RadioGroup } from 'radix-ui';
import { cn } from './cn';

export interface ChoiceCardOption<T extends string> {
  value: T;
  title: string;
  description?: string;
  icon?: LucideIcon;
}

export interface ChoiceCardsProps<T extends string> {
  options: ChoiceCardOption<T>[];
  value: T;
  onChange: (value: T) => void;
  label: string;
  columns?: 'one' | 'two' | 'three';
}

const COLUMNS = {
  one: 'grid-cols-1',
  two: 'grid-cols-1 sm:grid-cols-2',
  three: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
} as const;

export function ChoiceCards<T extends string>({ options, value, onChange, label, columns = 'two' }: ChoiceCardsProps<T>) {
  return (
    <RadioGroup.Root value={value} onValueChange={(next) => onChange(next as T)} aria-label={label} className={cn('grid gap-3', COLUMNS[columns])}>
      {options.map(({ value: optionValue, title, description, icon: Glyph }) => (
        <RadioGroup.Item
          key={optionValue}
          value={optionValue}
          className={cn(
            'group flex min-h-16 items-start gap-3 rounded-card border bg-card p-4 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus',
            'border-border hover:border-primary hover:bg-surface',
            'data-[state=checked]:border-primary data-[state=checked]:bg-primary-subtle',
          )}
        >
          {Glyph ? (
            <span className="flex size-10 shrink-0 items-center justify-center rounded-control bg-surface text-primary group-data-[state=checked]:bg-primary group-data-[state=checked]:text-primary-foreground">
              <Glyph className="size-5" aria-hidden />
            </span>
          ) : null}
          <span className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="font-semibold text-foreground">{title}</span>
            {description ? <span className="text-sm text-muted">{description}</span> : null}
          </span>
          <span
            aria-hidden
            className="mt-1 flex size-5 shrink-0 items-center justify-center rounded-full border-2 border-input group-data-[state=checked]:border-primary"
          >
            <span className="size-2.5 rounded-full bg-primary opacity-0 group-data-[state=checked]:opacity-100" />
          </span>
        </RadioGroup.Item>
      ))}
    </RadioGroup.Root>
  );
}
