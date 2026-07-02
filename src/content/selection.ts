export function extractSentence(containerText: string, selected: string, selectedStart?: number): string {
  const validOffset =
    selectedStart != null &&
    selectedStart >= 0 &&
    selectedStart + selected.length <= containerText.length &&
    containerText.slice(selectedStart, selectedStart + selected.length) === selected;
  const idx = validOffset ? selectedStart : containerText.indexOf(selected);
  if (idx < 0) return selected;
  const before = containerText.slice(0, idx);
  const startMatch = before.match(/[.!?\n][^.!?\n]*$/);
  const start = startMatch ? idx - (startMatch[0].length - 1) : 0;
  let end = containerText.length;
  for (const p of [".", "!", "?", "\n"]) {
    const e = containerText.indexOf(p, idx + selected.length);
    if (e >= 0 && e + 1 < end) end = e + 1;
  }
  return containerText.slice(start, end).trim();
}

/**
 * Whether a selection is worth prefetching a lookup for. Prefetch warms the
 * result cache the moment text is selected so the icon click is instant, but it
 * costs an API call — so limit it to word / short-phrase selections that contain
 * at least one letter (skip long paragraph drags and pure numbers/symbols).
 */
export function shouldPrefetch(text: string): boolean {
  const t = text.trim();
  return t.length > 0 && t.length <= 60 && /[A-Za-z]/.test(t);
}

/**
 * Normalize a selected term for dictionary lookup: strip surrounding punctuation
 * and a possessive suffix ("continent's" / "continent’s" → "continent") so
 * inflected selections still get a full dictionary entry and share the result
 * cache with the base form. Interior apostrophes (don't, o'clock) are kept.
 * Falls back to the trimmed original when stripping would leave nothing.
 */
export function normalizeTerm(raw: string): string {
  const t = raw.trim();
  const stripped = t
    .replace(/^[\s"'“”‘’()[\]{}.,;:!?…«»]+/, "")
    .replace(/[\s"'“”‘’()[\]{}.,;:!?…«»]+$/, "")
    .replace(/['’][sS]$/, "");
  return stripped.length > 0 ? stripped : t;
}

export interface SelectionInfo { text: string; context: string; x: number; y: number; }

export function readSelection(win: Window): SelectionInfo | null {
  const sel = win.getSelection();
  if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return null;
  const rawText = sel.toString();
  const text = rawText.trim();
  if (!text) return null;
  const range = sel.getRangeAt(0);
  const rect = range.getBoundingClientRect();
  const container = range.startContainer;
  const contextElement = container.nodeType === Node.TEXT_NODE
    ? container.parentElement
    : container instanceof Element ? container : null;
  const containerText = contextElement?.textContent ?? text;
  let selectedStart: number | undefined;
  if (contextElement) {
    try {
      const prefix = range.cloneRange();
      prefix.selectNodeContents(contextElement);
      prefix.setEnd(range.startContainer, range.startOffset);
      selectedStart = prefix.toString().length + rawText.indexOf(text);
    } catch {
      // Fall back to a text search when the DOM changes during selection.
    }
  }
  return {
    text,
    context: extractSentence(containerText, text, selectedStart),
    x: rect.right,
    y: rect.bottom,
  };
}

export class FloatingIcon {
  private el: HTMLDivElement;
  private cb: (() => void) | null = null;

  constructor(doc: Document = document) {
    this.el = doc.createElement("div");
    this.el.textContent = "词";
    this.el.title = "Hover to look up";
    this.el.style.cssText =
      "position:fixed;z-index:2147483646;display:none;width:22px;height:22px;line-height:22px;" +
      "text-align:center;font:12px system-ui;color:#fff;background:#06c;border-radius:50%;" +
      "cursor:pointer;box-shadow:0 2px 8px rgba(0,0,0,.3);user-select:none;";
    this.el.addEventListener("mousedown", (e) => { e.preventDefault(); e.stopPropagation(); this.cb?.(); });
    this.el.addEventListener("mouseenter", () => this.cb?.());
    doc.documentElement.appendChild(this.el);
  }

  showAt(x: number, y: number): void {
    this.el.style.left = `${x + 4}px`;
    this.el.style.top = `${y + 4}px`;
    this.el.style.display = "block";
  }
  hide(): void { this.el.style.display = "none"; }
  onClick(cb: () => void): void { this.cb = cb; }
}
