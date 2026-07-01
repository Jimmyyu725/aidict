import { Settings, DEFAULT_SETTINGS } from "./types";

export interface StorageArea {
  get(keys: string[]): Promise<Record<string, unknown>>;
  set(items: Record<string, unknown>): Promise<void>;
}

const KEY = "settings";

export async function loadSettings(storage: StorageArea): Promise<Settings> {
  const got = await storage.get([KEY]);
  return { ...DEFAULT_SETTINGS, ...((got[KEY] as Partial<Settings> | undefined) ?? {}) };
}

export async function saveSettings(storage: StorageArea, patch: Partial<Settings>): Promise<Settings> {
  const next = { ...(await loadSettings(storage)), ...patch };
  await storage.set({ [KEY]: next });
  return next;
}
