# AIDict — AI-Powered Look-Up Dictionary Extension (Design Spec)

- **Date:** 2026-07-01
- **Owner:** Jimmy Yu
- **Status:** Approved design, pending implementation plan

## 1. Purpose

A lightweight Manifest V3 Chrome extension that replaces Google Dictionary with an
AI-powered look-up card. Select an English word or phrase and get a **phonetic
transcription, part of speech, and definitions shown in both English and Chinese**,
context-aware via the surrounding sentence.

The key differentiator over Google Dictionary: **it works on any website**, including
pages where text cannot be selected. When normal text selection is unavailable
(canvas rendering, `user-select: none`, JS that blocks selection, images, scanned
PDFs, cross-origin iframes), the user falls back to a **screenshot-OCR capture mode**
that reads the word off the pixels.

Design priorities, in order: **robustness (few bugs) > low friction > low cost > minimal footprint.**
It is a personal tool for one user; it does not need multi-user, sync, or account features.

## 2. Non-Goals (YAGNI)

- No multiple translation-service providers — OpenAI only (for now).
- No account system, no cloud sync, no server component. Key stays on-device.
- No full-page translation. This is a look-up dictionary, not a page translator.
- No support for languages other than "source → Chinese" at launch (English source
  assumed; target language is configurable but defaults to Chinese).

## 3. Architecture Overview

Vanilla **TypeScript** bundled with **esbuild** (no UI framework — keeps the bundle
small and avoids framework churn). All popup UI is rendered inside a **Shadow DOM**
host so the host page's CSS can never break the card, and the card's CSS can never
leak into the page.

```
┌─ content script  (matches <all_urls>, all_frames, run_at document_idle) ───────┐
│  • Selection watcher: mouseup → window.getSelection() → floating icon near      │
│    the selection → on icon click, request a look-up.                            │
│  • Card renderer: Shadow-DOM host element, positioned next to the selection     │
│    (or capture box), shows loading / result / error states.                     │
│  • Capture mode: crosshair overlay → user drags a rectangle → asks the          │
│    background to screenshot the viewport → crops to the rectangle → OCR →        │
│    tokenizes into clickable words → look-up on click.                           │
└─────────────────────────────────────────────────────────────────────────────────┘
                │  chrome.runtime messages
┌─ background service worker ─────────────────────────────────────────────────────┐
│  • captureVisibleTab(): returns a PNG data-URL of the current viewport.          │
│  • lookup(): calls OpenAI, returns structured JSON (see §6).                     │
│  • cache read/write in chrome.storage.local (see §7).                            │
└─────────────────────────────────────────────────────────────────────────────────┘
                │
┌─ options page ──────────────────────────────────────────────────────────────────┐
│  • OpenAI API key (stored in chrome.storage.local, never logged/displayed back). │
│  • Model (default gpt-4o-mini), target language (default Chinese), feature       │
│    toggles, cache TTL.                                                            │
└─────────────────────────────────────────────────────────────────────────────────┘

OCR: Tesseract.js. The English trained-data (~10-15 MB) is lazy-loaded on first use
of capture mode, not bundled into the initial install, to keep the extension light.
```

### Component responsibilities (isolation boundaries)

| Unit | Does | Used via | Depends on |
|------|------|----------|------------|
| `selection-watcher` | Detect a text selection, place the floating icon | DOM events | browser Selection API |
| `capture-mode` | Draw box, request screenshot, crop, hand image to OCR | activated by hotkey/toolbar | background screenshot, `ocr` |
| `ocr` | Image → text + word boxes | `capture-mode` | Tesseract.js (lazy) |
| `card` | Render loading/result/error in Shadow DOM | `selection-watcher`, `capture-mode` | none (pure view) |
| `background/lookup` | word + context → structured result | `chrome.runtime` message | OpenAI, `cache` |
| `background/capture` | viewport → PNG data-URL | `chrome.runtime` message | `chrome.tabs.captureVisibleTab` |
| `cache` | get/set look-up results with TTL | `background/lookup` | `chrome.storage.local` |
| `options` | edit + persist settings | user | `chrome.storage.local` |

Each unit is independently testable: the pure ones (`card`, `cache`, prompt builder,
response parser, image cropper, word tokenizer) via unit tests; the browser-coupled
ones (`selection-watcher`, `capture-mode`, background handlers) via a thin manual/
integration pass in the automation Chrome.

## 4. Interaction Flows

### 4A. Normal selection (selectable text)
1. User selects a word/phrase → `mouseup`.
2. A small icon appears at the top-right corner of the selection rectangle.
   Selecting text alone does nothing (no accidental look-ups when copying).
3. User clicks the icon → the card opens next to the selection in a loading state.
4. Card fills in with the result. Clicking elsewhere / pressing Esc dismisses it.

### 4B. Capture / OCR mode (unselectable text — the universal fallback)
1. User presses the hotkey (default **Alt+D**) or clicks the toolbar icon → enters
   capture mode; cursor becomes a crosshair, a dim overlay covers the viewport.
2. User drags a rectangle over the word or region.
3. Content script asks background for `captureVisibleTab`, then crops the returned
   PNG to the dragged rectangle (accounting for `window.devicePixelRatio`).
4. Tesseract.js runs OCR on the crop.
   - Exactly one word recognized → look it up directly.
   - Multiple words → render them as a clickable list; user clicks the target word.
5. Result shown in the same card UI.

This path does not depend on DOM text at all, so it covers PDF viewers, `<canvas>`,
images, scanned documents, and cross-origin iframes uniformly.

## 5. Coverage Strategy per Failure Mode

| Failure mode | Handling |
|--------------|----------|
| `user-select:none` / JS blocks selection | Capture/OCR mode (4B) |
| Text is an image / scan / manga / canvas | Capture/OCR mode (4B) |
| Browser or site PDF viewer | Capture/OCR mode (4B) — content scripts can't reach the PDF viewer, screenshot can |
| Cross-origin iframe | Content script runs in `all_frames`; where injection is blocked, capture/OCR mode (4B) covers it |
| Normal selectable text | Selection flow (4A) |

## 6. AI Request Design

- Endpoint: `POST https://api.openai.com/v1/chat/completions`, called from the
  background service worker with the user's key in the `Authorization` header.
- Model: `gpt-4o-mini` by default (cheap, fast), configurable in options.
- The request sends the selected term **plus the sentence it came from** as context,
  and requests structured output with `response_format: { type: "json_object" }`.
- Response contract the front end renders (stable shape, no free-form parsing):

```json
{
  "word": "bank",
  "phonetic": "/bæŋk/",
  "is_phrase": false,
  "senses": [
    { "pos": "n.",  "en": "a financial institution that accepts deposits", "zh": "银行" },
    { "pos": "n.",  "en": "the land alongside a river",                     "zh": "河岸" }
  ],
  "translation": null
}
```

- Single word → `is_phrase:false`, `senses` populated (dictionary card).
- A phrase/sentence → `is_phrase:true`, `translation` holds the Chinese translation,
  `senses` may be empty.
- Context disambiguates polysemes (e.g. "bank" = 银行 vs 河岸) using the sentence.
- The response parser validates the shape and, on malformed output, shows a graceful
  error rather than throwing.

## 7. Caching

- Key: hash of `normalized term + context sentence`.
- Store: `chrome.storage.local`, each entry stamped with a timestamp.
- TTL: configurable (default 30 days); expired entries are ignored and refreshed.
- Purpose: identical look-ups don't re-hit the API — saves money and latency.

## 8. Error Handling

| Situation | Behavior |
|-----------|----------|
| No API key set | Card shows "set your key in options" with a link to the options page |
| OpenAI error / rate limit | Card shows the reason and a Retry button |
| Network offline | Card shows offline message |
| OCR produced nothing | Card prompts to re-capture (try a tighter box) |
| Malformed AI JSON | Card shows a generic "couldn't parse result" with Retry |

The extension must never crash the host page: all content-script code is wrapped so a
failure degrades to a dismissible error card, never an unhandled exception in the page.

## 9. Permissions (justified, minimal)

- `activeTab` + `<all_urls>` host permission — inject the content script and screenshot
  the active tab for OCR.
- `storage` — settings and cache.
- `scripting` / `contextMenus` (optional) — a right-click "look up" entry.
- `commands` — the Alt+D capture hotkey.

No `webRequest`/`declarativeNetRequest` needed (we call OpenAI directly, not spoofing
third-party endpoints), which keeps the permission surface small.

## 10. Tech Stack & Tooling

- TypeScript, bundled with esbuild (fast, tiny config).
- Tesseract.js for OCR (pure client-side, free, English trained-data lazy-loaded).
- No runtime UI framework; Shadow DOM + plain DOM for the card.
- Unit tests for pure logic (prompt builder, response parser, cache, image cropper,
  word tokenizer); a manual/integration pass in the automation Chrome for the
  browser-coupled paths.

## 11. Dev / Test / Deploy

- Source lives at `/srv/appdata/aidict/` (git repo), consistent with the rest of the
  NAS stack.
- During development: load the unpacked build into the persistent automation Chrome
  on `127.0.0.1:9222` via CDP `Extensions.loadUnpacked` for screenshot-based checks.
- For daily use: copy `dist/` to the Windows PC and load it as an unpacked extension
  in the user's normal Chrome; enter the OpenAI key on the options page.
- The API key is entered by the user in options and stored only in
  `chrome.storage.local`. It is never printed, logged, or committed.

## 12. Success Criteria

1. Selecting a word on a normal page shows the icon; clicking it shows a correct
   bilingual dictionary card within ~1-2 s.
2. On a page where text can't be selected (image/canvas/PDF), Alt+D → drag → the same
   card appears from OCR'd text.
3. Context disambiguates a polyseme correctly in at least a couple of hand-checked
   sentences.
4. Repeated look-up of the same word+context is served from cache (no second API call).
5. Missing key / API error / OCR miss each degrade to a clear, dismissible card — the
   host page never breaks.
