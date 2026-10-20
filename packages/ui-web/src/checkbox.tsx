import { useId, type ReactNode } from 'react';
import { Checkbox as CheckboxPrimitive } from 'radix-ui';
import { Check } from 'lucide-react';
import { useT } from '@careerpilot/client-core';
import { cn } from './cn';

export interface CheckboxProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  children: ReactNode;
  error?: string;
}

export function Checkbox({ checked, onChange, children, error }: CheckboxProps) {
  const id = useId();
  const t = useT();
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-start gap-3">
        <CheckboxPrimitive.Root
          id={id}
          checked={checked}
          onCheckedChange={(value) => onChange(value === true)}
          aria-invalid={error ? true : undefined}
          className={cn(
            'mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-md border-2 bg-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus data-[state=checked]:border-primary data-[state=checked]:bg-primary',
            error ? 'border-danger' : 'border-neutral',
          )}
        >
          <CheckboxPrimitive.Indicator>
            <Check className="size-4 text-primary-foreground" aria-hidden />
          </CheckboxPrimitive.Indicator>
        </CheckboxPrimitive.Root>
        <label htmlFor={id} className="text-sm text-foreground">
          {children}
        </label>
      </div>
      {error ? (
        <p className="text-xs text-danger" role="alert">
          {t(error)}
        </p>
      ) : null}
    </div>
  );
}
