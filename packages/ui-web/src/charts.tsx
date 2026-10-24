import { useId, useState, type ReactNode } from 'react';
import { cn } from './cn';

export interface BarDatum {
  label: string;
  value: number;
}

export interface BarChartProps {
  title: string;
  data: BarDatum[];
  formatLabel?: (label: string) => string;
  heightClass?: string;
}

export function BarChart({ title, data, formatLabel = (l) => l, heightClass = 'h-48' }: BarChartProps) {
  const id = useId();
  const [active, setActive] = useState<number>();
  const max = Math.max(1, ...data.map((d) => d.value));
  const focused = active === undefined ? undefined : data[active];
  return (
    <figure className="flex flex-col gap-3" aria-labelledby={`${id}-title`}>
      <figcaption id={`${id}-title`} className="flex items-baseline justify-between gap-2">
        <span className="font-semibold text-foreground">{title}</span>
        <span className="text-sm text-muted" aria-live="polite">
          {focused ? `${formatLabel(focused.label)} · ${focused.value}` : null}
        </span>
      </figcaption>
      <div className={cn('flex items-end gap-0.5 border-b border-border', heightClass)} role="presentation">
        {data.map((d, i) => (
          <button
            key={d.label}
            type="button"
            aria-label={`${formatLabel(d.label)}: ${d.value}`}
            onMouseEnter={() => setActive(i)}
            onMouseLeave={() => setActive(undefined)}
            onFocus={() => setActive(i)}
            onBlur={() => setActive(undefined)}
            className="group flex h-full flex-1 items-end focus-visible:outline-none"
          >
            <span
              className={cn('w-full rounded-t-[4px] bg-primary transition-opacity', active !== undefined && active !== i && 'opacity-40', 'group-focus-visible:ring-2 group-focus-visible:ring-focus')}
              style={{ height: `${(d.value / max) * 100}%`, minHeight: d.value > 0 ? '2px' : 0 }}
            />
          </button>
        ))}
      </div>
      <div className="flex justify-between text-xs text-muted" aria-hidden>
        <span>{data[0] ? formatLabel(data[0].label) : null}</span>
        <span>{data.at(-1) ? formatLabel(data.at(-1)!.label) : null}</span>
      </div>
      <table className="sr-only">
        <caption>{title}</caption>
        <tbody>
          {data.map((d) => (
            <tr key={d.label}>
              <th scope="row">{formatLabel(d.label)}</th>
              <td>{d.value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}

export interface BreakdownItem {
  key: string;
  label: ReactNode;
  value: number;
}

export function Breakdown({ title, items }: { title: string; items: BreakdownItem[] }) {
  const max = Math.max(1, ...items.map((i) => i.value));
  return (
    <section className="flex flex-col gap-3" aria-label={title}>
      <h3 className="font-semibold text-foreground">{title}</h3>
      <ul className="flex flex-col gap-2">
        {items.map((item) => (
          <li key={item.key} className="grid grid-cols-[minmax(6rem,45%)_1fr_2.5rem] items-center gap-3 text-sm">
            <span className="truncate">{item.label}</span>
            <span className="h-2 overflow-hidden rounded-pill bg-neutral-subtle">
              <span className="block h-full rounded-pill bg-primary" style={{ width: `${(item.value / max) * 100}%` }} />
            </span>
            <span className="text-right font-semibold tabular-nums text-foreground">{item.value}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function MetricTile({ label, value, tone }: { label: string; value: number | string; tone?: 'default' | 'warning' | 'danger' }) {
  return (
    <div className="flex flex-col gap-1 rounded-card border border-border bg-card p-4">
      <span className={cn('text-2xl font-bold tabular-nums', tone === 'danger' ? 'text-danger' : tone === 'warning' ? 'text-warning' : 'text-foreground')}>{value}</span>
      <span className="text-sm text-muted">{label}</span>
    </div>
  );
}
