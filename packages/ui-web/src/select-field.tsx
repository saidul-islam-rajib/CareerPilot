import { useId, type SelectHTMLAttributes } from 'react';
import { ChevronDown } from 'lucide-react';
import { useT } from '@careerpilot/client-core';
import { cn } from './cn';

export interface SelectOption {
  value: string;
  label: string;
}

export interface SelectFieldProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'id' | 'onChange'> {
  label: string;
  options: SelectOption[];
  placeholder?: string;
  error?: string;
  errorParams?: Record<string, string | number>;
  hint?: string;
  onValueChange: (value: string) => void;
}

export function SelectField({ label, options, placeholder, error, errorParams, hint, onValueChange, className, value, ...props }: SelectFieldProps) {
  const id = useId();
  const t = useT();
  const message = error ? t(error, errorParams) : hint;
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-sm font-medium text-foreground">
        {label}
      </label>
      <div className="relative">
        <select
          id={id}
          value={value}
          onChange={(event) => onValueChange(event.target.value)}
          aria-invalid={error ? true : undefined}
          className={cn(
            'w-full appearance-none rounded-control border bg-background py-2.5 pl-3 pr-10 text-base text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus',
            error ? 'border-danger' : 'border-input',
            className,
          )}
          {...props}
        >
          {placeholder !== undefined ? (
            <option value="" disabled>
              {placeholder}
            </option>
          ) : null}
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-5 -translate-y-1/2 text-muted" aria-hidden />
      </div>
      {message ? (
        <p className={cn('text-xs', error ? 'text-danger' : 'text-muted')} role={error ? 'alert' : undefined}>
          {message}
        </p>
      ) : null}
    </div>
  );
}
