import { useId, useState, type DragEvent } from 'react';
import { Loader2, UploadCloud } from 'lucide-react';
import { cn } from './cn';

export const FileRejection = {
  Type: 'type',
  Size: 'size',
  Empty: 'empty',
} as const;
export type FileRejection = (typeof FileRejection)[keyof typeof FileRejection];

export interface FileDropZoneProps {
  label: string;
  hint: string;
  accept: string[];
  maxBytes: number;
  busy?: boolean;
  busyLabel?: string;
  disabled?: boolean;
  compact?: boolean;
  onFile: (file: File) => void;
  onReject: (reason: FileRejection) => void;
}

export function checkFile(file: File, accept: string[], maxBytes: number): FileRejection | undefined {
  if (file.size === 0) {
    return FileRejection.Empty;
  }
  if (!accept.includes(file.type)) {
    return FileRejection.Type;
  }
  return file.size > maxBytes ? FileRejection.Size : undefined;
}

export function FileDropZone({ label, hint, accept, maxBytes, busy = false, busyLabel, disabled = false, compact = false, onFile, onReject }: FileDropZoneProps) {
  const id = useId();
  const [dragging, setDragging] = useState(false);

  const handle = (file: File | undefined) => {
    if (!file) {
      return;
    }
    const rejection = checkFile(file, accept, maxBytes);
    if (rejection) {
      onReject(rejection);
    } else {
      onFile(file);
    }
  };

  const onDrop = (event: DragEvent) => {
    event.preventDefault();
    setDragging(false);
    if (!disabled && !busy) {
      handle(event.dataTransfer.files[0]);
    }
  };

  return (
    <div
      onDragOver={(event) => {
        event.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={onDrop}
      className={cn(
        'relative flex flex-col items-center justify-center gap-2 rounded-card border-2 border-dashed text-center transition-colors',
        compact ? 'px-4 py-4 sm:flex-row sm:gap-3 sm:text-left' : 'px-6 py-8',
        dragging ? 'border-primary bg-primary-subtle' : 'border-input bg-surface',
        (disabled || busy) && 'opacity-60',
      )}
    >
      {busy ? <Loader2 className="size-8 animate-spin text-primary" aria-hidden /> : <UploadCloud className="size-8 text-primary" aria-hidden />}
      <div className="flex flex-col gap-1">
        <label htmlFor={id} className="cursor-pointer font-semibold text-primary underline-offset-4 hover:underline">
          {busy && busyLabel ? busyLabel : label}
        </label>
        <p className="text-xs text-muted">{hint}</p>
      </div>
      <input
        id={id}
        type="file"
        accept={accept.join(',')}
        disabled={disabled || busy}
        className="sr-only"
        onChange={(event) => {
          handle(event.target.files?.[0]);
          event.target.value = '';
        }}
      />
    </div>
  );
}
