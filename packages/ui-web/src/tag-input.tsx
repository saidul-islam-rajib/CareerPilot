import { useId, useState, type KeyboardEvent } from 'react';
import { Plus, X } from 'lucide-react';
import { useT } from '@careerpilot/client-core';
import { Button } from './button';
import { cn } from './cn';

const SEPARATOR_KEYS = new Set(['Enter', ',']);

export interface TagInputProps {
  label: string;
  values: string[];
  placeholder?: string;
  hint?: string;
  error?: string;
  addLabel: string;
  removeLabel: (value: string) => string;
  onAdd: (values: string[]) => void;
  onRemove: (value: string) => void;
}

export function splitTags(raw: string): string[] {
  return raw
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
}

export function TagInput({ label, values, placeholder, hint, error, addLabel, removeLabel, onAdd, onRemove }: TagInputProps) {
  const id = useId();
  const t = useT();
  const [draft, setDraft] = useState('');

  const commit = () => {
    const tags = splitTags(draft);
    if (tags.length > 0) {
      onAdd(tags);
      setDraft('');
    }
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (SEPARATOR_KEYS.has(event.key)) {
      event.preventDefault();
      commit();
    } else if (event.key === 'Backspace' && draft === '' && values.length > 0) {
      onRemove(values[values.length - 1] as string);
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="text-sm font-medium text-foreground">
        {label}
      </label>
      <div className="flex gap-2">
        <input
          id={id}
          value={draft}
          placeholder={placeholder}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={onKeyDown}
          aria-invalid={error ? true : undefined}
          className={cn(
            'min-w-0 flex-1 rounded-control border bg-background px-3 py-2.5 text-base text-foreground placeholder:text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus',
            error ? 'border-danger' : 'border-input',
          )}
        />
        <Button variant="secondary" icon={Plus} onClick={commit} disabled={!draft.trim()}>
          {addLabel}
        </Button>
      </div>
      {error ? (
        <p role="alert" className="text-xs text-danger">
          {t(error)}
        </p>
      ) : hint ? (
        <p className="text-xs text-muted">{hint}</p>
      ) : null}
      {values.length > 0 ? (
        <ul className="flex flex-wrap gap-2" aria-label={label}>
          {values.map((value) => (
            <li key={value} className="flex items-center gap-1 rounded-full bg-primary-subtle py-1 pl-3 pr-1 text-sm font-medium text-primary">
              {value}
              <button
                type="button"
                aria-label={removeLabel(value)}
                onClick={() => onRemove(value)}
                className="flex size-8 items-center justify-center rounded-full hover:bg-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
              >
                <X className="size-4" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
