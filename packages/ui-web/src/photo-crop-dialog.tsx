import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent, type SyntheticEvent } from 'react';
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, RotateCcw, ZoomIn, ZoomOut, type LucideIcon } from 'lucide-react';
import { useT } from '@careerpilot/client-core';
import { cropFromView, moveView, viewFromCrop, viewPlacement, zoomView, type CropView, type ImageSize, type Offset, type PhotoCrop } from '@careerpilot/domain-ui-logic';
import { photoCrop as cropTuning, zoom as zoomLimits } from '@careerpilot/ui-tokens';
import { Button } from './button';
import { FormDialog } from './form-dialog';

const RANGE = { min: zoomLimits.min, max: zoomLimits.max };
interface Direction {
  key: string;
  label: string;
  icon: LucideIcon;
  offset: Offset;
}

const DIRECTIONS: readonly Direction[] = [
  { key: 'ArrowLeft', label: 'profile.movePhotoLeft', icon: ArrowLeft, offset: { x: -1, y: 0 } },
  { key: 'ArrowUp', label: 'profile.movePhotoUp', icon: ArrowUp, offset: { x: 0, y: -1 } },
  { key: 'ArrowDown', label: 'profile.movePhotoDown', icon: ArrowDown, offset: { x: 0, y: 1 } },
  { key: 'ArrowRight', label: 'profile.movePhotoRight', icon: ArrowRight, offset: { x: 1, y: 0 } },
];

export interface PhotoCropDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  src: string;
  crop?: PhotoCrop;
  saving?: boolean;
  error?: string;
  onSave: (crop: PhotoCrop) => void;
}

interface Pointer {
  x: number;
  y: number;
}

function distance(points: Pointer[]): number {
  const [a, b] = points;
  return a && b ? Math.hypot(a.x - b.x, a.y - b.y) : 0;
}

export function PhotoCropDialog({ open, onOpenChange, src, crop, saving = false, error, onSave }: PhotoCropDialogProps) {
  const t = useT();
  const frame = useRef<HTMLDivElement>(null);
  const pointers = useRef(new Map<number, Pointer>());
  const pinch = useRef(0);
  const [image, setImage] = useState<ImageSize>();
  const [view, setView] = useState<CropView>();

  const update = (change: (current: CropView, size: ImageSize) => CropView) => {
    setView((current) => (current && image ? change(current, image) : current));
  };
  const zoomTo = (zoom: number) => update((current, size) => zoomView(current, zoom, size, RANGE));
  const moveBy = (delta: Offset) => update((current, size) => moveView(current, delta, size));
  const nudge = (direction: Offset) => moveBy({ x: direction.x * cropTuning.nudge, y: direction.y * cropTuning.nudge });

  useEffect(() => {
    const element = frame.current;
    if (!element || !image) {
      return undefined;
    }
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      setView((current) => current && zoomView(current, current.zoom * (1 - event.deltaY * cropTuning.wheelStep), image, RANGE));
    };
    element.addEventListener('wheel', onWheel, { passive: false });
    return () => element.removeEventListener('wheel', onWheel);
  }, [image]);

  const onLoad = (event: SyntheticEvent<HTMLImageElement>) => {
    const size = { width: event.currentTarget.naturalWidth, height: event.currentTarget.naturalHeight };
    if (size.width > 0 && size.height > 0) {
      setImage(size);
      setView(viewFromCrop(crop, size, RANGE));
    }
  };

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    event.currentTarget.setPointerCapture?.(event.pointerId);
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    pinch.current = distance([...pointers.current.values()]);
  };
  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const last = pointers.current.get(event.pointerId);
    const width = frame.current?.clientWidth ?? 0;
    if (!last || width === 0) {
      return;
    }
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (pointers.current.size > 1) {
      const spread = distance([...pointers.current.values()]);
      const previous = pinch.current;
      pinch.current = spread;
      if (previous > 0) {
        update((current, size) => zoomView(current, current.zoom * (spread / previous), size, RANGE));
      }
      return;
    }
    moveBy({ x: (event.clientX - last.x) / width, y: (event.clientY - last.y) / width });
  };
  const onPointerEnd = (event: PointerEvent<HTMLDivElement>) => {
    pointers.current.delete(event.pointerId);
    pinch.current = distance([...pointers.current.values()]);
  };
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const direction = DIRECTIONS.find((d) => d.key === event.key);
    if (direction) {
      event.preventDefault();
      nudge(direction.offset);
    }
  };

  const place = view && image ? viewPlacement(view, image) : undefined;
  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={t('profile.adjustPhoto')}
      description={t('profile.adjustPhotoHint')}
      submitLabel={t('common.save')}
      submitting={saving}
      error={error}
      onSubmit={() => view && image && onSave(cropFromView(view, image))}
    >
      <div
        ref={frame}
        tabIndex={0}
        role="group"
        aria-label={t('profile.photoFrame')}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerEnd}
        onPointerCancel={onPointerEnd}
        onKeyDown={onKeyDown}
        className="relative mx-auto aspect-square w-full max-w-80 shrink-0 cursor-grab touch-none select-none overflow-hidden rounded-card bg-neutral-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus active:cursor-grabbing"
      >
        <img
          src={src}
          alt=""
          draggable={false}
          onLoad={onLoad}
          className="absolute max-w-none"
          style={place ? { width: `${place.width}%`, height: `${place.height}%`, left: `${place.left}%`, top: `${place.top}%` } : { opacity: 0 }}
        />
        <div aria-hidden className="pointer-events-none absolute inset-0 rounded-full shadow-[0_0_0_100vmax_var(--color-overlay)] ring-2 ring-background" />
      </div>
      <div className="mx-auto flex w-full max-w-80 items-center gap-2">
        <Button type="button" variant="ghost" size="icon" icon={ZoomOut} aria-label={t('profile.zoomOut')} onClick={() => zoomTo((view?.zoom ?? RANGE.min) - cropTuning.buttonStep)} />
        <input
          type="range"
          min={RANGE.min}
          max={RANGE.max}
          step={cropTuning.sliderStep}
          value={view?.zoom ?? RANGE.min}
          onChange={(e) => zoomTo(Number(e.target.value))}
          aria-label={t('profile.zoom')}
          className="h-2 min-w-0 flex-1 cursor-pointer accent-primary"
        />
        <Button type="button" variant="ghost" size="icon" icon={ZoomIn} aria-label={t('profile.zoomIn')} onClick={() => zoomTo((view?.zoom ?? RANGE.min) + cropTuning.buttonStep)} />
      </div>
      <div className="mx-auto flex w-full max-w-80 flex-wrap items-center justify-center gap-1">
        {DIRECTIONS.map((direction) => (
          <Button key={direction.key} type="button" variant="ghost" size="icon" icon={direction.icon} aria-label={t(direction.label)} onClick={() => nudge(direction.offset)} />
        ))}
        <Button type="button" variant="ghost" size="sm" icon={RotateCcw} onClick={() => image && setView(viewFromCrop(undefined, image, RANGE))}>
          {t('profile.resetPhotoFrame')}
        </Button>
      </div>
    </FormDialog>
  );
}
