import { describe, expect, it } from 'vitest';
import { centeredView, cropFromView, cropPlacement, moveView, viewFromCrop, zoomView } from './photo-crop';

const portrait = { width: 600, height: 1200 };
const range = { min: 1, max: 5 };

describe('photo crop', () => {
  it('starts centred and covers the frame', () => {
    const view = centeredView(portrait, 1);
    expect(view.offset).toEqual({ x: 0, y: -0.5 });
    expect(cropFromView(view, portrait)).toEqual({ x: 0, y: 0.25, width: 1, height: 0.5 });
  });

  it('frames just the face: zoom in and move to the top', () => {
    const zoomed = zoomView(centeredView(portrait, 1), 4, portrait, range);
    const top = moveView(zoomed, { x: 0, y: 10 }, portrait);
    expect(top.offset.y).toBe(0);
    expect(cropFromView(top, portrait)).toEqual({ x: 0.375, y: 0, width: 0.25, height: 0.125 });
  });

  it('never lets the photo leave the frame or zoom past the limits', () => {
    const view = moveView(centeredView(portrait, 1), { x: 5, y: -5 }, portrait);
    expect(view.offset).toEqual({ x: 0, y: -1 });
    expect(zoomView(view, 99, portrait, range).zoom).toBe(5);
    expect(zoomView(view, 0.1, portrait, range).zoom).toBe(1);
  });

  it('round-trips a saved crop into the editor and into avatar placement', () => {
    const crop = { x: 0.375, y: 0, width: 0.25, height: 0.125 };
    const view = viewFromCrop(crop, portrait, range);
    expect(view.zoom).toBeCloseTo(4);
    expect(cropFromView(view, portrait)).toEqual(crop);
    expect(viewFromCrop(undefined, portrait, range)).toEqual(centeredView(portrait, 1));
    expect(cropPlacement(crop)).toEqual({ width: 400, height: 800, left: -150, top: 0 });
  });
});
