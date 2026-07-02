# Final Fixes Report — feat/aidict-mvp

## Fix 1: Top-frame-only capture (belt-and-suspenders)

**Problem:** `all_frames: true` meant `enter-capture` was broadcast to every same-origin
iframe, spawning multiple overlays with wrong crop coordinates.

**Changes:**

- `src/background/index.ts` — `chrome.commands.onCommand` handler now passes `{ frameId: 0 }`
  to `chrome.tabs.sendMessage`, so Chrome delivers the message only to the top frame's
  content-script instance.

- `src/content/index.ts` — `chrome.runtime.onMessage` handler for `enter-capture` now
  guards with `if (window.top !== window) return;` before calling
  `__aidictEnterCapture()`. This second layer means even if the message somehow reaches a
  sub-frame (e.g. cross-origin iframe where frameId filtering doesn't apply), it is
  silently ignored in that frame.

The `mouseup` selection/icon wiring is untouched and still runs in all frames.

## Fix 2: Distinguish OCR pipeline failure from successful-but-empty OCR

**Problem:** Any pipeline error (capture message failure, `cropDataUrl` throw, Tesseract
worker blocked by strict CSP) was collapsed into `onWords([], x, y)`, showing "No text
found — try a tighter box." Users would retry indefinitely with no chance of success.

**Callback shape chosen:**

```typescript
// src/shared/types.ts
export type OcrResult =
  | { ok: true; words: string[] }
  | { ok: false; error: string };

// startCapture signature (src/content/capture-mode.ts)
startCapture(onResult: (result: OcrResult, x: number, y: number) => void): void
```

**Changes:**

- `src/shared/types.ts` — Added `OcrResult` discriminated union export.

- `src/content/capture-mode.ts` — Imported `OcrResult`. Renamed `onWords` → `onResult`.
  All three error paths (sendMessage throw, `!resp.ok`, cropDataUrl/ocrImage throw) now
  call `onResult({ ok: false, error: "..." }, anchorX, anchorY)`. The success path calls
  `onResult({ ok: true, words: tokenizeWords(text) }, anchorX, anchorY)` — even when
  `tokenizeWords` returns an empty array. Extracted `anchorX`/`anchorY` locals to avoid
  repeating the arithmetic.

- `src/content/index.ts` — Imported `OcrResult`. Renamed `pickFromWords` → `pickFromResult`
  with signature `(result: OcrResult, x: number, y: number)`. New dispatch logic:
  - `!result.ok` → error card: "OCR isn't available on this page (it may block the scanner)", `canRetry: false`.
  - `ok` + 0 words → "No text found — try a tighter box", `canRetry: false` (unchanged UX).
  - `ok` + 1 word → `doLookup` directly (unchanged).
  - `ok` + ≥2 words → transient word-picker (unchanged).
  Updated `startCapture(pickFromResult)` call and `__aidictEnterCapture` wrapper.

## Test / build results

```
npm test  → 10 test files, 31 tests — all passed (138ms)
npm run build → dist/background.js 5.6kb, dist/content.js 58.8kb, dist/options.js 1.5kb — succeeded (13ms)
```

TypeScript strict + noUnusedLocals: clean build confirms no dead code or type errors.

## Files changed

- `src/shared/types.ts` — added `OcrResult` export
- `src/content/capture-mode.ts` — new `OcrResult` import; `onWords` → `onResult`; error/success path rewire
- `src/content/index.ts` — new `OcrResult` import; `pickFromWords` → `pickFromResult`; top-frame guard; `startCapture` call updated
- `src/background/index.ts` — `{ frameId: 0 }` added to `sendMessage`
