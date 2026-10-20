import { useId, useState, type InputHTMLAttributes, type TextareaHTMLAttributes } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { useT } from '@careerpilot/client-core';
import { cn } from './cn';

const fieldClasses =
  'w-full rounded-control border bg-background px-3 py-2.5 text-base text-foreground placeholder:text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus';

interface FieldMessageProps {
  error?: string;
  errorParams?: Record<string, string | number>;
  hint?: string;
}

function useFieldMessage({ error, errorParams, hint }: FieldMessageProps) {
  const t = useT();
  return error ? t(error, errorParams) : hint;
}

export interface TextFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'id'>, FieldMessageProps {
  label: string;
  secret?: boolean;
}

export function TextField({ label, error, errorParams, hint, secret = false, className, ...props }: TextFieldProps) {
  const id = useId();
  const t = useT();
  const [revealed, setRevealed] = useState(false);
  const message = useFieldMessage({ error, errorParams, hint });
  const messageId = `${id}-message`;
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-sm font-medium text-foreground">
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          type={secret && !revealed ? 'password' : props.type ?? 'text'}
          aria-invalid={error ? true : undefined}
          aria-describedby={message ? messageId : undefined}
          className={cn(fieldClasses, error ? 'border-danger' : 'border-input', secret && 'pr-12', className)}
          {...props}
        />
        {secret ? (
          <button
            type="button"
            onClick={() => setRevealed((v) => !v)}
            aria-label={revealed ? t('common.hidePassword') : t('common.showPassword')}
            className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-muted"
          >
            {revealed ? <EyeOff className="size-5" aria-hidden /> : <Eye className="size-5" aria-hidden />}
          </button>
        ) : null}
      </div>
      {message ? (
        <p id={messageId} className={cn('text-xs', error ? 'text-danger' : 'text-muted')} role={error ? 'alert' : undefined}>
          {message}
        </p>
      ) : null}
    </div>
  );
}

export interface TextAreaFieldProps extends Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'id'>, FieldMessageProps {
  label: string;
}

export function TextAreaField({ label, error, errorParams, hint, className, ...props }: TextAreaFieldProps) {
  const id = useId();
  const message = useFieldMessage({ error, errorParams, hint });
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-sm font-medium text-foreground">
        {label}
      </label>
      <textarea id={id} aria-invalid={error ? true : undefined} className={cn(fieldClasses, 'min-h-24', error ? 'border-danger' : 'border-input', className)} {...props} />
      {message ? <p className={cn('text-xs', error ? 'text-danger' : 'text-muted')}>{message}</p> : null}
    </div>
  );
}
