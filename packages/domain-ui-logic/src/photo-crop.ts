export interface PhotoCrop {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ImageSize {
  width: number;
  height: number;
}

export interface Offset {
  x: number;
  y: number;
}

export interface CropView {
  zoom: number;
  offset: Offset;
}

export interface ZoomRange {
  min: number;
  max: number;
}

export interface CropPlacement {
  width: number;
  height: number;
  left: number;
  top: number;
}

const FRAME = 1;
const ORIGIN = 0;
const HALF = 0.5;
const PERCENT = 100;
const PRECISION = 6;

function round(value: number): number {
  return Number(value.toFixed(PRECISION));
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function shownSize(image: ImageSize, zoom: number): ImageSize {
  const cover = Math.max(FRAME / image.width, FRAME / image.height) * zoom;
  return { width: image.width * cover, height: image.height * cover };
}

export function clampOffset(offset: Offset, image: ImageSize, zoom: number): Offset {
  const shown = shownSize(image, zoom);
  return { x: clamp(offset.x, FRAME - shown.width, 0), y: clamp(offset.y, FRAME - shown.height, 0) };
}

export function centeredView(image: ImageSize, zoom: number): CropView {
  const shown = shownSize(image, zoom);
  return { zoom, offset: { x: (FRAME - shown.width) * HALF, y: (FRAME - shown.height) * HALF } };
}

export function zoomView(view: CropView, zoom: number, image: ImageSize, range: ZoomRange): CropView {
  const next = clamp(zoom, range.min, range.max);
  const before = shownSize(image, view.zoom);
  const after = shownSize(image, next);
  const focusX = (HALF - view.offset.x) / before.width;
  const focusY = (HALF - view.offset.y) / before.height;
  return { zoom: next, offset: clampOffset({ x: HALF - focusX * after.width, y: HALF - focusY * after.height }, image, next) };
}

export function moveView(view: CropView, delta: Offset, image: ImageSize): CropView {
  return { zoom: view.zoom, offset: clampOffset({ x: view.offset.x + delta.x, y: view.offset.y + delta.y }, image, view.zoom) };
}

export function cropFromView(view: CropView, image: ImageSize): PhotoCrop {
  const shown = shownSize(image, view.zoom);
  const x = clamp(-view.offset.x / shown.width, 0, FRAME);
  const y = clamp(-view.offset.y / shown.height, 0, FRAME);
  return {
    x: round(x),
    y: round(y),
    width: round(Math.min(FRAME / shown.width, FRAME - x)),
    height: round(Math.min(FRAME / shown.height, FRAME - y)),
  };
}

export function viewFromCrop(crop: PhotoCrop | undefined, image: ImageSize, range: ZoomRange): CropView {
  if (!crop) {
    return centeredView(image, range.min);
  }
  const base = shownSize(image, FRAME);
  const zoom = clamp(FRAME / (crop.width * base.width), range.min, range.max);
  const shown = shownSize(image, zoom);
  return { zoom, offset: clampOffset({ x: -crop.x * shown.width, y: -crop.y * shown.height }, image, zoom) };
}

export function cropPlacement(crop: PhotoCrop): CropPlacement {
  return {
    width: (FRAME / crop.width) * PERCENT,
    height: (FRAME / crop.height) * PERCENT,
    left: ORIGIN - (crop.x / crop.width) * PERCENT,
    top: ORIGIN - (crop.y / crop.height) * PERCENT,
  };
}

export function viewPlacement(view: CropView, image: ImageSize): CropPlacement {
  const shown = shownSize(image, view.zoom);
  return { width: shown.width * PERCENT, height: shown.height * PERCENT, left: view.offset.x * PERCENT, top: view.offset.y * PERCENT };
}
