export interface Sense { pos: string; en: string; zh: string; }

export interface LookupResult {
  word: string;
  phonetic: string;
  is_phrase: boolean;
  senses: Sense[];
  translation: string | null;
}

export interface Settings {
  apiKey: string;
  model: string;
  targetLang: string;
  cacheTtlDays: number;
  selectionEnabled: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  apiKey: "",
  model: "gpt-4o-mini",
  targetLang: "Chinese",
  cacheTtlDays: 30,
  selectionEnabled: true,
};

export type LookupRequest = { type: "lookup"; term: string; context: string };
export type CaptureRequest = { type: "capture" };
export type RuntimeRequest = LookupRequest | CaptureRequest;

export type ToContentMessage = { type: "enter-capture" };

export type LookupResponse =
  | { ok: true; result: LookupResult; cached: boolean }
  | { ok: false; error: string };

export type CaptureResponse =
  | { ok: true; dataUrl: string }
  | { ok: false; error: string };
