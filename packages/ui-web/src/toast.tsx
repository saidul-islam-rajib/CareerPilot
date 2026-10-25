import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type PropsWithChildren } from 'react';
import { CheckCircle2, AlertCircle, X } from 'lucide-react';
import { useT } from '@careerpilot/client-core';
import { feedback } from '@careerpilot/ui-tokens';
import { cn } from './cn';

export const ToastTone = {
  Success: 'success',
  Danger: 'danger',
} as const;
export type ToastTone = (typeof ToastTone)[keyof typeof ToastTone];

export interface ToastInput {
  message: string;
  tone?: ToastTone;
  actionLabel?: string;
  onAction?: () => void;
}

interface Toast extends ToastInput {
  id: number;
}

interface ToastApi {
  show: (toast: ToastInput) => void;
}

const ToastContext = createContext<ToastApi | undefined>(undefined);

function ToastItem({ toast, onClose }: { toast: Toast; onClose: (id: number) => void }) {
  const t = useT();
  const Glyph = toast.tone === ToastTone.Danger ? AlertCircle : CheckCircle2;
  useEffect(() => {
    const timer = setTimeout(() => onClose(toast.id), toast.onAction ? feedback.undoToastMs : feedback.toastMs);
    return () => clearTimeout(timer);
  }, [onClose, toast.id, toast.onAction]);
  return (
    <li className="pointer-events-auto flex items-center gap-3 rounded-card bg-foreground px-4 py-3 text-background shadow-xl">
      <Glyph className={cn('size-5 shrink-0', toast.tone === ToastTone.Danger ? 'text-danger-subtle' : 'text-success-subtle')} aria-hidden />
      <p className="min-w-0 flex-1 text-sm">{toast.message}</p>
      {toast.actionLabel && toast.onAction ? (
        <button
          type="button"
          className="min-h-11 rounded-control px-3 text-sm font-semibold underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
          onClick={() => {
            toast.onAction?.();
            onClose(toast.id);
          }}
        >
          {toast.actionLabel}
        </button>
      ) : null}
      <button
        type="button"
        aria-label={t('common.close')}
        className="flex size-11 items-center justify-center rounded-control focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
        onClick={() => onClose(toast.id)}
      >
        <X className="size-4" aria-hidden />
      </button>
    </li>
  );
}

export function ToastProvider({ children }: PropsWithChildren) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(0);
  const close = useCallback((id: number) => setToasts((current) => current.filter((toast) => toast.id !== id)), []);
  const api = useMemo<ToastApi>(
    () => ({
      show: (toast) => {
        nextId.current += 1;
        const id = nextId.current;
        setToasts((current) => [...current, { ...toast, id }].slice(-feedback.maxToasts));
      },
    }),
    [],
  );
  return (
    <ToastContext.Provider value={api}>
      {children}
      <ol
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-0 z-[60] mx-auto flex w-full max-w-md flex-col gap-2 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] md:bottom-4 md:left-auto md:right-4 md:mx-0"
      >
        {toasts.map((toast) => (
          <ToastItem key={toast.id} toast={toast} onClose={close} />
        ))}
      </ol>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  const value = useContext(ToastContext);
  if (!value) {
    throw new Error('ToastProvider is missing');
  }
  return value;
}
