import { DropdownMenu } from 'radix-ui';
import { MoreVertical, type LucideIcon } from 'lucide-react';
import { Button } from './button';
import { cn } from './cn';

export interface MenuItem {
  label: string;
  icon?: LucideIcon;
  onSelect: () => void;
  disabled?: boolean;
  destructive?: boolean;
}

export function OverflowMenu({ label, items }: { label: string; items: MenuItem[] }) {
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <Button variant="ghost" size="icon" icon={MoreVertical} aria-label={label} />
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content align="end" sideOffset={4} className="z-50 min-w-48 rounded-card border border-border bg-card p-1 shadow-xl">
          {items.map(({ label: itemLabel, icon: Glyph, onSelect, disabled, destructive }) => (
            <DropdownMenu.Item
              key={itemLabel}
              disabled={disabled}
              onSelect={onSelect}
              className={cn(
                'flex min-h-11 cursor-pointer select-none items-center gap-3 rounded-control px-3 text-sm outline-none data-[disabled]:pointer-events-none data-[highlighted]:bg-surface data-[disabled]:opacity-50',
                destructive ? 'text-danger' : 'text-foreground',
              )}
            >
              {Glyph ? <Glyph className="size-4" aria-hidden /> : null}
              {itemLabel}
            </DropdownMenu.Item>
          ))}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
