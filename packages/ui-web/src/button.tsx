import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { Loader2, type LucideIcon } from 'lucide-react';
import { cn } from './cn';

export const buttonVariants = cva(
  'inline-flex min-h-11 items-center justify-center gap-2 rounded-control border px-4 text-base font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-60',
  {
    variants: {
      variant: {
        primary: 'border-primary bg-primary text-primary-foreground hover:bg-primary-hover',
        secondary: 'border-primary-subtle bg-primary-subtle text-primary hover:bg-border',
        outline: 'border-input bg-background text-foreground hover:bg-surface',
        ghost: 'border-transparent bg-transparent text-primary hover:bg-neutral-subtle',
        destructive: 'border-danger bg-danger text-primary-foreground hover:opacity-90',
      },
      size: {
        md: '',
        sm: 'min-h-9 px-3 text-sm',
        icon: 'size-11 px-0',
      },
      fullWidth: {
        true: 'w-full',
        false: '',
      },
    },
    defaultVariants: { variant: 'primary', size: 'md', fullWidth: false },
  },
);

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  icon?: LucideIcon;
  loading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant, size, fullWidth, icon: Glyph, loading = false, disabled, children, type = 'button', ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={cn(buttonVariants({ variant, size, fullWidth }), className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading ? <Loader2 className="size-5 animate-spin" aria-hidden /> : Glyph ? <Glyph className="size-5" aria-hidden /> : null}
      {children}
    </button>
  );
});
