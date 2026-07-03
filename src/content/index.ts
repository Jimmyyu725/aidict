import { readSelection, FloatingIcon, SelectionInfo, normalizeTerm, shouldPrefetch } from "./selection";
import { Card, CardState } from "./card";
import { LookupRequest, LookupResponse, OcrResult, ToContentMessage } from "../shared/types";
import { startCapture } from "./capture-mode";

function main(): void {
  const icon = new FloatingIcon();
  const card = new Card();
  let pending: SelectionInfo | null = null;
  let lastLookup: SelectionInfo | null = null;
  // Whether the visible icon/card is anchored to a live text selection (true for
  // select-to-lookup, false for OCR capture results, which have no selection).
  let followSelection = false;
  let prefetchTimer: number | undefined;
  let prefetchedKey = "";

  // Speculatively warm the background result cache the moment text is selected,
  // so the subsequent hover/click returns instantly. Debounced + deduped, and
  // limited to word/short-phrase selections (see shouldPrefetch) to bound cost.
  // The background dedupes an in-flight lookup against the real click, so this
  // never causes a second API call for the same term.
  function schedulePrefetch(info: SelectionInfo): void {
    if (!shouldPrefetch(info.text)) return;
    const term = normalizeTerm(info.text);
    const key = `${term}\x00${info.context}`;
    if (key === prefetchedKey) return;
    if (prefetchTimer !== undefined) clearTimeout(prefetchTimer);
    prefetchTimer = window.setTimeout(() => {
      prefetchedKey = key;
      const req: LookupRequest = { type: "lookup", term, context: info.context };
      void chrome.runtime.sendMessage(req).catch(() => {});
    }, 180);
  }

  async function doLookup(info: SelectionInfo): Promise<void> {
    lastLookup = info;
    card.showAt(info.x, info.y, { kind: "loading" });
    let resp: LookupResponse;
    try {
      const req: LookupRequest = { type: "lookup", term: normalizeTerm(info.text), context: info.context };
      resp = (await chrome.runtime.sendMessage(req)) as LookupResponse;
    } catch {
      card.setState({ kind: "error", message: "Extension error — please retry", canRetry: true });
      return;
    }
    const state: CardState = resp.ok
      ? { kind: "result", result: resp.result }
      : { kind: "error", message: resp.error === "NO_API_KEY" ? "Set your OpenAI key in options" : resp.error, canRetry: resp.error !== "NO_API_KEY" };
    card.setState(state);
  }

  icon.onClick(() => { if (pending) { const info = pending; icon.hide(); void doLookup(info); } });
  card.onRetry(() => { if (lastLookup) void doLookup(lastLookup); });

  document.addEventListener("mouseup", () => {
    setTimeout(() => {
      const info = readSelection(window);
      if (info) { followSelection = true; pending = info; icon.showAt(info.x, info.y); schedulePrefetch(info); }
      else { icon.hide(); if (prefetchTimer !== undefined) clearTimeout(prefetchTimer); }
    }, 0);
  });

  document.addEventListener("mousedown", (e) => {
    const path = e.composedPath();
    if (!path.some((n) => n instanceof HTMLElement && n.hasAttribute("data-aidict"))) card.hide();
  });

  // Keep the icon and card anchored next to the selected text while the page
  // scrolls or resizes. Recomputes the live selection rect (fixed-position
  // coordinates go stale on scroll), rAF-throttled; capture phase also catches
  // scrolling inside nested containers. OCR-origin cards are not re-anchored.
  let repositionQueued = false;
  function repositionToSelection(): void {
    repositionQueued = false;
    if (!followSelection) return;
    if (!icon.isVisible() && !card.isVisible()) return;
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return;
    const rect = sel.getRangeAt(0).getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) return;
    const x = rect.right, y = rect.bottom;
    if (pending) { pending.x = x; pending.y = y; }
    if (lastLookup) { lastLookup.x = x; lastLookup.y = y; }
    if (icon.isVisible()) icon.showAt(x, y);
    if (card.isVisible()) card.moveTo(x, y);
  }
  const queueReposition = (): void => {
    if (repositionQueued) return;
    repositionQueued = true;
    requestAnimationFrame(repositionToSelection);
  };
  document.addEventListener("scroll", queueReposition, { capture: true, passive: true });
  window.addEventListener("resize", queueReposition, { passive: true });

  /**
   * Called after OCR: handle a pipeline result and pick a word to look up.
   * - Pipeline failure (!ok)  → error card: "OCR isn't available on this page".
   * - 0 words (ok, empty)    → error card asking the user to try a tighter box.
   * - 1 word                 → look it up immediately.
   * - ≥2 words               → show a transient clickable picker so the user selects one word.
   *
   * Words come from tokenizeWords() which keeps only [A-Za-z'-] characters,
   * so rendering them via innerHTML carries no injection risk.
   */
  function pickFromResult(result: OcrResult, x: number, y: number): void {
    followSelection = false;
    if (!result.ok) {
      card.showAt(x, y, {
        kind: "error",
        message: "OCR isn't available on this page (it may block the scanner)",
        canRetry: false,
      });
      return;
    }
    const { words } = result;
    if (words.length === 0) {
      card.showAt(x, y, {
        kind: "error",
        message: "No text found — try a tighter box",
        canRetry: false,
      });
      return;
    }
    if (words.length === 1) {
      void doLookup({ text: words[0], context: "", x, y });
      return;
    }

    // Remove any existing picker before showing a new one.
    document.querySelector("[data-aidict-picker]")?.remove();

    const picker = document.createElement("div");
    picker.setAttribute("data-aidict", "1");
    picker.setAttribute("data-aidict-picker", "1");
    picker.style.cssText =
      `position:fixed;left:${Math.min(x, window.innerWidth - 340)}px;top:${y + 8}px;` +
      `z-index:2147483647;background:#fff;border:1px solid #ddd;border-radius:8px;padding:8px;` +
      `box-shadow:0 6px 24px rgba(0,0,0,.18);max-width:340px;font:14px system-ui;`;
    picker.innerHTML = words
      .map((w) => `<button data-aidict class="aidict-pick" style="margin:2px;cursor:pointer;">${w}</button>`)
      .join(" ");
    picker.addEventListener("click", (e) => {
      const t = e.target as HTMLElement;
      if (t.classList.contains("aidict-pick")) {
        picker.remove();
        void doLookup({ text: t.textContent || "", context: "", x, y });
      }
    });
    document.documentElement.appendChild(picker);
  }

  // Wire capture mode: background sends "enter-capture" on Alt+D.
  (window as unknown as { __aidictEnterCapture?: () => void }).__aidictEnterCapture =
    () => startCapture(pickFromResult);

  chrome.runtime.onMessage.addListener((msg: ToContentMessage) => {
    if (msg.type === "enter-capture") {
      // Only the top frame should enter capture mode — sub-frames ignore this message.
      if (window.top !== window) return;
      (window as unknown as { __aidictEnterCapture?: () => void }).__aidictEnterCapture?.();
    }
  });
}

try { main(); } catch (e) { console.error("[AIDict] failed to start:", e); }
