import { LookupResult } from "./types";
import { StorageArea } from "./settings";

interface CacheEntry { result: LookupResult; ts: number; }
const PREFIX = "cache:";

export async function getCached(
  storage: StorageArea, key: string, ttlDays: number, now: number
): Promise<LookupResult | null> {
  const k = PREFIX + key;
  const got = await storage.get([k]);
  const entry = got[k] as CacheEntry | undefined;
  if (!entry) return null;
  if (now - entry.ts > ttlDays * 24 * 60 * 60 * 1000) return null;
  return entry.result;
}

export async function setCached(
  storage: StorageArea, key: string, result: LookupResult, now: number
): Promise<void> {
  await storage.set({ [PREFIX + key]: { result, ts: now } });
}
