import { computeCropRect, cropDataUrl, Rect } from "./crop";
import { tokenizeWords } from "./tokenize";
import { ocrImage } from "./ocr";
import { CaptureRequest, CaptureResponse } from "../shared/types";

/**
 * Activates a full-screen crosshair overlay; the user drags a rectangle.
 * On mouseup: requests a tab screenshot from the background, crops it to
 * the drag region, runs OCR, and calls onWords() with the recognised tokens.
 * Press Escape to cancel without OCR.
 */
export function startCapture(
  onWords: (words: string[], x: number, y: number) => void
): void {
  const overlay = document.createElement("div");
  overlay.style.cssText =
    "position:fixed;inset:0;z-index:2147483645;cursor:crosshair;background:rgba(0,0,0,.15);";

  const box = document.createElement("div");
  box.style.cssText =
    "position:fixed;border:2px solid #06c;background:rgba(0,102,204,.1);display:none;";
  overlay.appendChild(box);
  document.documentElement.appendChild(overlay);

  let sx = 0, sy = 0, dragging = false;

  let escListener: (ev: KeyboardEvent) => void;

  const cleanup = () => {
    overlay.remove();
    document.removeEventListener("keydown", escListener);
  };

  overlay.addEventListener("mousedown", (e) => {
    dragging = true;
    sx = e.clientX;
    sy = e.clientY;
    box.style.left = `${sx}px`;
    box.style.top = `${sy}px`;
    box.style.width = "0";
    box.style.height = "0";
    box.style.display = "block";
  });

  overlay.addEventListener("mousemove", (e) => {
    if (!dragging) return;
    const x = Math.min(sx, e.clientX);
    const y = Math.min(sy, e.clientY);
    box.style.left = `${x}px`;
    box.style.top = `${y}px`;
    box.style.width = `${Math.abs(e.clientX - sx)}px`;
    box.style.height = `${Math.abs(e.clientY - sy)}px`;
  });

  overlay.addEventListener("mouseup", async (e) => {
    dragging = false;
    const dragRect: Rect = {
      x: Math.min(sx, e.clientX),
      y: Math.min(sy, e.clientY),
      w: Math.abs(e.clientX - sx),
      h: Math.abs(e.clientY - sy),
    };
    cleanup();

    // Ignore accidental clicks (drag smaller than 4px in either dimension).
    if (dragRect.w < 4 || dragRect.h < 4) return;

    const req: CaptureRequest = { type: "capture" };
    let resp: CaptureResponse;
    try {
      resp = (await chrome.runtime.sendMessage(req)) as CaptureResponse;
    } catch {
      onWords([], dragRect.x + dragRect.w, dragRect.y + dragRect.h);
      return;
    }

    if (!resp.ok) {
      onWords([], dragRect.x + dragRect.w, dragRect.y + dragRect.h);
      return;
    }

    const cropRect = computeCropRect(dragRect, window.devicePixelRatio);
    let text: string;
    try {
      const cropped = await cropDataUrl(resp.dataUrl, cropRect);
      text = await ocrImage(cropped);
    } catch {
      onWords([], dragRect.x + dragRect.w, dragRect.y + dragRect.h);
      return;
    }

    onWords(
      tokenizeWords(text),
      dragRect.x + dragRect.w,
      dragRect.y + dragRect.h
    );
  });

  escListener = (ev: KeyboardEvent) => {
    if (ev.key === "Escape") cleanup();
  };
  document.addEventListener("keydown", escListener);
}
