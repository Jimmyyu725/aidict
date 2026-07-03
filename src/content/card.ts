import { LookupResult } from "../shared/types";

export type CardState =
  | { kind: "loading" }
  | { kind: "error"; message: string; canRetry: boolean }
  | { kind: "result"; result: LookupResult };

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

const POS_ABBREVIATIONS: Record<string, string> = {
  noun: "n.",
  n: "n.",
  verb: "v.",
  v: "v.",
  adjective: "adj.",
  adj: "adj.",
  adverb: "adv.",
  adv: "adv.",
  pronoun: "pron.",
  pron: "pron.",
  preposition: "prep.",
  prep: "prep.",
  conjunction: "conj.",
  conj: "conj.",
  determiner: "det.",
  det: "det.",
  article: "art.",
  art: "art.",
  "auxiliary verb": "aux.",
  auxiliary: "aux.",
  aux: "aux.",
  "modal verb": "modal v.",
  modal: "modal v.",
  interjection: "interj.",
  interj: "interj.",
  numeral: "num.",
  number: "num.",
  num: "num.",
  abbreviation: "abbr.",
  abbr: "abbr.",
  phrase: "phr.",
  phr: "phr.",
  "phrasal verb": "phr. v.",
  idiom: "idiom",
  prefix: "pref.",
  pref: "pref.",
  suffix: "suff.",
  suff: "suff.",
  "transitive verb": "vt.",
  transitive: "vt.",
  vt: "vt.",
  "intransitive verb": "vi.",
  intransitive: "vi.",
  vi: "vi.",
};

export function formatPartOfSpeech(pos: string): string {
  const normalized = pos.trim().toLowerCase().replace(/\.+$/, "");
  return POS_ABBREVIATIONS[normalized] ?? pos;
}

export function renderCardHTML(state: CardState): string {
  if (state.kind === "loading") return `<div class="aidict-body">Looking up…</div>`;
  if (state.kind === "error") {
    const retry = state.canRetry ? `<button class="aidict-retry">Retry</button>` : "";
    return `<div class="aidict-body aidict-error">${esc(state.message)} ${retry}</div>`;
  }
  const r = state.result;
  if (r.is_phrase) {
    return `<div class="aidict-body"><div class="aidict-word">${esc(r.word)}</div>` +
      `<div class="aidict-trans">${esc(r.translation ?? "")}</div></div>`;
  }
  const senses = r.senses.map(s =>
    `<li><span class="aidict-pos">${esc(formatPartOfSpeech(s.pos))}</span> ` +
    `<span class="aidict-en">${esc(s.en)}</span> ` +
    `<span class="aidict-zh">${esc(s.zh)}</span></li>`).join("");
  return `<div class="aidict-body">` +
    `<div class="aidict-word">${esc(r.word)} <span class="aidict-ipa">${esc(r.phonetic)}</span></div>` +
    `<ul class="aidict-senses">${senses}</ul></div>`;
}

const STYLE = `
:host { all: initial; }
.aidict-body { font: 14px/1.5 system-ui, sans-serif; color: #1a1a1a; background: #fff;
  border: 1px solid #ddd; border-radius: 10px; box-shadow: 0 6px 24px rgba(0,0,0,.18);
  padding: 12px 14px; max-width: 340px; }
.aidict-word { font-weight: 600; margin-bottom: 6px; }
.aidict-ipa { color: #888; font-weight: 400; }
.aidict-senses { margin: 0; padding-left: 16px; }
.aidict-senses li { margin: 4px 0; }
.aidict-pos { color: #b06; font-style: italic; margin-right: 4px; }
.aidict-zh { color: #06c; }
.aidict-error { color: #a00; }
.aidict-retry { margin-left: 8px; cursor: pointer; }
`;

export class Card {
  private host: HTMLDivElement;
  private root: ShadowRoot;
  private retryCb: (() => void) | null = null;

  constructor(doc: Document = document) {
    this.host = doc.createElement("div");
    this.host.style.cssText = "position:fixed;z-index:2147483647;top:0;left:0;display:none;";
    this.host.setAttribute("data-aidict", "");
    this.root = this.host.attachShadow({ mode: "open" });
    doc.documentElement.appendChild(this.host);
    this.root.addEventListener("click", (e) => {
      if ((e.target as HTMLElement).classList.contains("aidict-retry")) this.retryCb?.();
    });
  }

  showAt(x: number, y: number, state: CardState): void {
    this.host.style.left = `${Math.min(x, window.innerWidth - 360)}px`;
    this.host.style.top = `${Math.max(0, Math.min(y + 8, window.innerHeight - 200))}px`;
    this.host.style.display = "block";
    this.setState(state);
  }

  setState(state: CardState): void {
    this.root.innerHTML = `<style>${STYLE}</style>${renderCardHTML(state)}`;
  }

  /**
   * Reposition while open (scroll-follow). X stays clamped inside the viewport;
   * Y is intentionally unclamped so the card slides along with the anchored
   * text instead of sticking to the viewport edge.
   */
  moveTo(x: number, y: number): void {
    this.host.style.left = `${Math.min(x, window.innerWidth - 360)}px`;
    this.host.style.top = `${y + 8}px`;
  }

  isVisible(): boolean { return this.host.style.display !== "none"; }
  hide(): void { this.host.style.display = "none"; }
  onRetry(cb: () => void): void { this.retryCb = cb; }
}
