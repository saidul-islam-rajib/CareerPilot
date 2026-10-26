import { cropPlacement, initials, type PhotoCrop } from '@careerpilot/domain-ui-logic';
import { opacity } from '@careerpilot/ui-tokens';
import { usePublicConfig, useT } from '@careerpilot/client-core';
import { cn } from './cn';

export function BrandMark({ className }: { className?: string }) {
  const t = useT();
  return (
    <svg viewBox="0 0 64 64" role="img" aria-label={t('app.name')} className={cn('size-10 shrink-0', className)}>
      <rect width="64" height="64" rx="16" className="fill-primary" />
      <path d="M14 46 C 20 40, 24 38, 30 36" className="stroke-primary-foreground" strokeOpacity={opacity.overlay} strokeWidth={3} strokeLinecap="round" strokeDasharray="1 6" fill="none" />
      <path d="M24 40 L50 16 L42 46 L34 37 Z" className="fill-primary-foreground" />
      <path d="M34 37 L50 16" className="stroke-primary" strokeWidth={2} strokeLinecap="round" />
      <circle cx="48" cy="48" r="5" className="fill-accent" />
    </svg>
  );
}

export function BrandLockup({ className }: { className?: string }) {
  const t = useT();
  return (
    <span className={cn('flex items-center gap-3', className)}>
      <BrandMark />
      <span className="text-xl font-bold text-foreground">{t('app.name')}</span>
    </span>
  );
}

export function TeamSoberCredit({ logoSrc, compact = false }: { logoSrc: string; compact?: boolean }) {
  const t = useT();
  const { config } = usePublicConfig();
  return (
    <a
      href={config.branding.developerUrl}
      target="_blank"
      rel="noreferrer"
      aria-label={`${t('credits.developedBy')}. ${t('credits.visit')}`}
      className="inline-flex items-center justify-center gap-2 rounded-control py-2 text-muted hover:text-foreground"
    >
      <img src={logoSrc} alt="" className={cn('rounded-lg', compact ? 'size-6' : 'size-10')} />
      <span className="flex flex-col text-left">
        <span className={compact ? 'text-xs' : 'text-sm'}>{t('credits.developedBy')}</span>
        {compact ? null : <span className="text-xs text-primary">{t('credits.visit')}</span>}
      </span>
    </a>
  );
}

export function Avatar({ name, src, crop, className }: { name: string; src?: string; crop?: PhotoCrop; className?: string }) {
  if (src && crop) {
    const place = cropPlacement(crop);
    return (
      <span role="img" aria-label={name} className={cn('relative block size-24 shrink-0 overflow-hidden rounded-full bg-neutral-subtle', className)}>
        <img
          src={src}
          alt=""
          draggable={false}
          className="absolute max-w-none select-none"
          style={{ width: `${place.width}%`, height: `${place.height}%`, left: `${place.left}%`, top: `${place.top}%` }}
        />
      </span>
    );
  }
  return src ? (
    <img src={src} alt={name} className={cn('size-24 rounded-full object-cover', className)} />
  ) : (
    <span role="img" aria-label={name} className={cn('flex size-24 items-center justify-center rounded-full bg-primary-subtle text-2xl font-bold text-primary', className)}>
      {initials(name)}
    </span>
  );
}
