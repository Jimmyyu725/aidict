import { Rect } from "../content/crop";

export function computeImageCropRect(
  dragRect: Rect,
  imageRect: Rect,
  naturalWidth: number,
  naturalHeight: number
): Rect {
  const left = Math.max(imageRect.x, Math.min(dragRect.x, imageRect.x + imageRect.w));
  const top = Math.max(imageRect.y, Math.min(dragRect.y, imageRect.y + imageRect.h));
  const right = Math.max(left, Math.min(dragRect.x + dragRect.w, imageRect.x + imageRect.w));
  const bottom = Math.max(top, Math.min(dragRect.y + dragRect.h, imageRect.y + imageRect.h));
  const scaleX = naturalWidth / imageRect.w;
  const scaleY = naturalHeight / imageRect.h;
  return {
    x: Math.round((left - imageRect.x) * scaleX),
    y: Math.round((top - imageRect.y) * scaleY),
    w: Math.round((right - left) * scaleX),
    h: Math.round((bottom - top) * scaleY),
  };
}
