import { useId } from 'react';
import { Switch } from 'radix-ui';
import { cn } from './cn';

export interface SwitchFieldProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  description?: string;
  className?: string;
}

export function SwitchField({ checked, onChange, label, description, className }: SwitchFieldProps) {
  const id = useId();
  const descriptionId = `${id}-description`;
  return (
    <div className={cn('flex items-start justify-between gap-4', className)}>
      <div className="flex min-w-0 flex-col gap-0.5">
        <label htmlFor={id} className="cursor-pointer font-semibold text-foreground">
          {label}
        </label>
        {description ? (
          <p id={descriptionId} className="text-sm text-muted">
            {description}
          </p>
        ) : null}
      </div>
      <Switch.Root
        id={id}
        checked={checked}
        onCheckedChange={onChange}
        aria-describedby={description ? descriptionId : undefined}
        className="relative mt-0.5 inline-flex h-7 w-12 shrink-0 cursor-pointer items-center rounded-pill border-2 border-transparent bg-input transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus data-[state=checked]:bg-primary"
      >
        <Switch.Thumb className="pointer-events-none block size-6 rounded-full bg-background shadow-md transition-transform data-[state=checked]:translate-x-5" />
      </Switch.Root>
    </div>
  );
}
