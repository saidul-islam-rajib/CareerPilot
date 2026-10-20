import { Minus, Plus } from 'lucide-react';
import { useT } from '@careerpilot/client-core';
import { Button } from './button';

export interface StepperProps {
  name: string;
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
}

export function Stepper({ name, value, min, max, onChange }: StepperProps) {
  const t = useT();
  return (
    <div className="flex items-center gap-3" role="group" aria-label={name}>
      <Button variant="outline" size="icon" icon={Minus} aria-label={t('common.decrease', { name })} disabled={value <= min} onClick={() => onChange(value - 1)} />
      <output aria-live="polite" aria-label={t('common.valueOf', { name, value })} className="min-w-11 text-center text-2xl font-bold">
        {value}
      </output>
      <Button variant="outline" size="icon" icon={Plus} aria-label={t('common.increase', { name })} disabled={value >= max} onClick={() => onChange(value + 1)} />
    </div>
  );
}
