import { useState, type WheelEvent, type PointerEvent, type ReactNode } from 'react';
import { Dialog } from 'radix-ui';
import { RotateCcw, X, ZoomIn, ZoomOut } from 'lucide-react';
import { useT } from '@careerpilot/client-core';
import { zoom as zoomLimits } from '@careerpilot/ui-tokens';
import { Button } from './button';

export function clampZoom(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

const WHEEL_STEP = 0.0015;

export function ImageViewer({ src, title, trigger }: { src: string; title: string; trigger: ReactNode }) {
  const t = useT();
  const [scale, setScale] = useState<number>(zoomLimits.min);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [drag, setDrag] = useState<{ x: number; y: number } | null>(null);

  const setZoom = (value: number) => {
    const next = clampZoom(value, zoomLimits.min, zoomLimits.max);
    setScale(next);
    if (next === zoomLimits.min) {
      setOffset({ x: 0, y: 0 });
    }
  };
  const onWheel = (e: WheelEvent) => setZoom(scale - e.deltaY * WHEEL_STEP * scale);
  const onPointerDown = (e: PointerEvent) => scale > zoomLimits.min && setDrag({ x: e.clientX - offset.x, y: e.clientY - offset.y });
  const onPointerMove = (e: PointerEvent) => drag && setOffset({ x: e.clientX - drag.x, y: e.clientY - drag.y });

  return (
    <Dialog.Root onOpenChange={(open) => !open && setZoom(zoomLimits.min)}>
      <Dialog.Trigger asChild>{trigger}</Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-overlay" />
        <Dialog.Content className="fixed inset-0 z-50 flex flex-col p-4" aria-describedby={undefined}>
          <div className="flex items-center justify-between">
            <Dialog.Title className="text-lg font-semibold text-primary-foreground">{title}</Dialog.Title>
            <Dialog.Close asChild>
              <Button variant="outline" size="icon" icon={X} aria-label={t('common.close')} />
            </Dialog.Close>
          </div>
          <div
            className="flex flex-1 touch-none items-center justify-center overflow-hidden"
            onWheel={onWheel}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={() => setDrag(null)}
            onPointerLeave={() => setDrag(null)}
            onDoubleClick={() => setZoom(scale > zoomLimits.min ? zoomLimits.min : zoomLimits.doubleTap)}
          >
            <img
              src={src}
              alt={title}
              draggable={false}
              className="max-h-full max-w-full select-none bg-background"
              style={{ transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`, cursor: scale > zoomLimits.min ? 'grab' : 'zoom-in' }}
            />
          </div>
          <p className="text-center text-xs text-primary-foreground">{t('profile.pinchToZoom')}</p>
          <div className="flex justify-center gap-4 p-2">
            <Button variant="outline" size="icon" icon={ZoomOut} aria-label={t('profile.zoomOut')} onClick={() => setZoom(scale - zoomLimits.step)} />
            <Button variant="outline" size="icon" icon={RotateCcw} aria-label={t('profile.resetZoom')} onClick={() => setZoom(zoomLimits.min)} />
            <Button variant="outline" size="icon" icon={ZoomIn} aria-label={t('profile.zoomIn')} onClick={() => setZoom(scale + zoomLimits.step)} />
          </div>
          <output className="sr-only" aria-live="polite">
            {Math.round(scale * 100)}%
          </output>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
