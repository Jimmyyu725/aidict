export function extractSentence(containerText: string, selected: string): string {
  const idx = containerText.indexOf(selected);
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

export interface SelectionInfo { text: string; context: string; x: number; y: number; }

export function readSelection(win: Window): SelectionInfo | null {
  const sel = win.getSelection();
  if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return null;
  const text = sel.toString().trim();
  if (!text) return null;
  const range = sel.getRangeAt(0);
  const rect = range.getBoundingClientRect();
  const container = range.startContainer;
  const containerText =
    (container.nodeType === Node.TEXT_NODE ? container.parentElement?.textContent : (container as Element).textContent) ?? text;
  return { text, context: extractSentence(containerText, text), x: rect.right, y: rect.bottom };
}

export class FloatingIcon {
  private el: HTMLDivElement;
  private cb: (() => void) | null = null;

  constructor(doc: Document = document) {
    this.el = doc.createElement("div");
    this.el.textContent = "词";
    this.el.style.cssText =
      "position:fixed;z-index:2147483646;display:none;width:22px;height:22px;line-height:22px;" +
      "text-align:center;font:12px system-ui;color:#fff;background:#06c;border-radius:50%;" +
      "cursor:pointer;box-shadow:0 2px 8px rgba(0,0,0,.3);user-select:none;";
    this.el.addEventListener("mousedown", (e) => { e.preventDefault(); e.stopPropagation(); this.cb?.(); });
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
