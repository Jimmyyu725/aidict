import { readSelection, FloatingIcon, SelectionInfo } from "./selection";
import { Card, CardState } from "./card";
import { LookupRequest, LookupResponse, ToContentMessage } from "../shared/types";
import { startCapture } from "./capture-mode";

function main(): void {
  const icon = new FloatingIcon();
  const card = new Card();
  let pending: SelectionInfo | null = null;
  let lastLookup: SelectionInfo | null = null;

  async function doLookup(info: SelectionInfo): Promise<void> {
    lastLookup = info;
    card.showAt(info.x, info.y, { kind: "loading" });
    let resp: LookupResponse;
    try {
      const req: LookupRequest = { type: "lookup", term: info.text, context: info.context };
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
      if (info) { pending = info; icon.showAt(info.x, info.y); }
      else { icon.hide(); }
    }, 0);
  });

  document.addEventListener("mousedown", (e) => {
    const path = e.composedPath();
    if (!path.some((n) => n instanceof HTMLElement && n.hasAttribute("data-aidict"))) card.hide();
  });

  /**
   * Called after OCR: pick a word to look up from the recognized tokens.
   * - 0 words → error card asking the user to try a tighter box.
   * - 1 word  → look it up immediately.
   * - ≥2 words → show a transient clickable picker so the user selects one word.
   *
   * Words come from tokenizeWords() which keeps only [A-Za-z'-] characters,
   * so rendering them via innerHTML carries no injection risk.
   */
  function pickFromWords(words: string[], x: number, y: number): void {
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
    () => startCapture(pickFromWords);

  chrome.runtime.onMessage.addListener((msg: ToContentMessage) => {
    if (msg.type === "enter-capture") {
      (window as unknown as { __aidictEnterCapture?: () => void }).__aidictEnterCapture?.();
    }
  });
}

try { main(); } catch (e) { console.error("[AIDict] failed to start:", e); }
