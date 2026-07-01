import { readSelection, FloatingIcon, SelectionInfo } from "./selection";
import { Card, CardState } from "./card";
import { LookupRequest, LookupResponse, ToContentMessage } from "../shared/types";

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

  chrome.runtime.onMessage.addListener((msg: ToContentMessage) => {
    if (msg.type === "enter-capture") {
      (window as unknown as { __aidictEnterCapture?: () => void }).__aidictEnterCapture?.();
    }
  });
}

try { main(); } catch (e) { console.error("[AIDict] failed to start:", e); }
