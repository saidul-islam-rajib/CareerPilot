import { ring } from '@careerpilot/ui-tokens';

const FULL = 1;
const HALF = 2;
const PERCENT = 100;

export function ProgressRing({ value, label, caption }: { value: number; label: string; caption: string }) {
  const clamped = Math.max(0, Math.min(FULL, value));
  const radius = (ring.size - ring.stroke) / HALF;
  const circumference = HALF * Math.PI * radius;
  const center = ring.size / HALF;
  return (
    <div role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={PERCENT} aria-valuenow={Math.round(clamped * PERCENT)} className="relative inline-flex">
      <svg width={ring.size} height={ring.size} viewBox={`0 0 ${ring.size} ${ring.size}`} className="-rotate-90" aria-hidden>
        <circle cx={center} cy={center} r={radius} fill="none" strokeWidth={ring.stroke} className="stroke-neutral-subtle" />
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          strokeWidth={ring.stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (FULL - clamped)}
          className="stroke-primary transition-[stroke-dashoffset] duration-300"
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-2xl font-bold text-foreground">{caption}</span>
    </div>
  );
}
