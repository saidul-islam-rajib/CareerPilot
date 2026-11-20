import { useRef, useState, type PointerEvent } from 'react';
import { Eraser, Undo2 } from 'lucide-react';
import { useT } from '@careerpilot/client-core';
import { encodeSignaturePng, hasInk, type StrokePoint } from '@careerpilot/domain-ui-logic';
import { signaturePad } from '@careerpilot/ui-tokens';
import { Button } from './button';
import { FormDialog } from './form-dialog';

export interface SignaturePadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  saving?: boolean;
  error?: string;
  onSave: (png: Uint8Array) => void;
}

const toPath = (stroke: StrokePoint[]) => stroke.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');

export function SignaturePadDialog({ open, onOpenChange, saving = false, error, onSave }: SignaturePadDialogProps) {
  const t = useT();
  const surface = useRef<SVGSVGElement>(null);
  const [strokes, setStrokes] = useState<StrokePoint[][]>([]);
  const drawing = useRef(false);

  const point = (event: PointerEvent<SVGSVGElement>): StrokePoint => {
    const box = surface.current?.getBoundingClientRect();
    const width = box?.width || signaturePad.width;
    const height = box?.height || signaturePad.height;
    return {
      x: ((event.clientX - (box?.left ?? 0)) / width) * signaturePad.width,
      y: ((event.clientY - (box?.top ?? 0)) / height) * signaturePad.height,
    };
  };
  const begin = (event: PointerEvent<SVGSVGElement>) => {
    event.currentTarget.setPointerCapture?.(event.pointerId);
    drawing.current = true;
    const start = point(event);
    setStrokes((current) => [...current, [start]]);
  };
  const extend = (event: PointerEvent<SVGSVGElement>) => {
    if (!drawing.current) {
      return;
    }
    const next = point(event);
    setStrokes((current) => current.map((stroke, i) => (i === current.length - 1 ? [...stroke, next] : stroke)));
  };
  const finish = () => {
    drawing.current = false;
  };

  const save = () => {
    if (hasInk(strokes)) {
      onSave(encodeSignaturePng(strokes, signaturePad));
    }
  };

  return (
    <FormDialog open={open} onOpenChange={onOpenChange} title={t('profile.drawSignature')} description={t('profile.drawSignatureHint')} submitLabel={t('common.save')} submitting={saving} error={error} onSubmit={save}>
      <svg
        ref={surface}
        role="img"
        aria-label={t('profile.signaturePad')}
        viewBox={`0 0 ${signaturePad.width} ${signaturePad.height}`}
        onPointerDown={begin}
        onPointerMove={extend}
        onPointerUp={finish}
        onPointerCancel={finish}
        className="w-full cursor-crosshair touch-none select-none rounded-control border border-input bg-surface text-foreground"
      >
        {strokes.map((stroke, index) => (
          <path key={index} d={toPath(stroke)} fill="none" stroke="currentColor" strokeWidth={signaturePad.strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
        ))}
      </svg>
      <div className="flex gap-2">
        <Button type="button" variant="ghost" size="sm" icon={Undo2} disabled={strokes.length === 0} onClick={() => setStrokes((current) => current.slice(0, -1))}>
          {t('profile.undoStroke')}
        </Button>
        <Button type="button" variant="ghost" size="sm" icon={Eraser} disabled={strokes.length === 0} onClick={() => setStrokes([])}>
          {t('profile.clearSignature')}
        </Button>
      </div>
    </FormDialog>
  );
}
