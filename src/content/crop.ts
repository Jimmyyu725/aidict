export interface Rect { x: number; y: number; w: number; h: number; }

export function computeCropRect(dragRect: Rect, dpr: number): Rect {
  return {
    x: Math.round(dragRect.x * dpr),
    y: Math.round(dragRect.y * dpr),
    w: Math.round(dragRect.w * dpr),
    h: Math.round(dragRect.h * dpr),
  };
}

export async function cropDataUrl(dataUrl: string, rect: Rect): Promise<string> {
  const img = await new Promise<HTMLImageElement>((res, rej) => {
    const i = new Image();
    i.onload = () => res(i);
    i.onerror = () => rej(new Error("Failed to load capture"));
    i.src = dataUrl;
  });
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, rect.w);
  canvas.height = Math.max(1, rect.h);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("No 2D context");
  ctx.drawImage(img, rect.x, rect.y, rect.w, rect.h, 0, 0, rect.w, rect.h);
  return canvas.toDataURL("image/png");
}
