import { useEffect, useState } from 'react';
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

const WHOLE_NUMBER = /^\d+$/;

export function Stepper({ name, value, min, max, onChange }: StepperProps) {
  const t = useT();
  const [text, setText] = useState(String(value));
  useEffect(() => setText(String(value)), [value]);
  const typed = (next: string) => {
    setText(next);
    const number = Number(next);
    if (WHOLE_NUMBER.test(next) && number >= min && number <= max) {
      onChange(number);
    }
  };
  const settle = () => setText(String(value));
  return (
    <div className="flex items-center gap-3" role="group" aria-label={name}>
      <Button variant="outline" size="icon" icon={Minus} aria-label={t('common.decrease', { name })} disabled={value <= min} onClick={() => onChange(value - 1)} />
      <input
        type="number"
        inputMode="numeric"
        min={min}
        max={max}
        step={1}
        value={text}
        aria-label={t('common.valueOf', { name, value })}
        onChange={(e) => typed(e.target.value)}
        onBlur={settle}
        className="h-11 w-20 rounded-control border border-input bg-card text-center text-2xl font-bold text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
      />
      <Button variant="outline" size="icon" icon={Plus} aria-label={t('common.increase', { name })} disabled={value >= max} onClick={() => onChange(value + 1)} />
      <span className="text-xs text-muted">{t('common.range', { min, max })}</span>
    </div>
  );
}
