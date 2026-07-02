import { test, expect, vi } from "vitest";
import { lookup } from "./lookup";
import { StorageArea } from "../shared/settings";
import { DEFAULT_SETTINGS, LookupResult } from "../shared/types";

function fakeStorage(): StorageArea {
  const data: Record<string, unknown> = {};
  return {
    async get(keys) { const o: Record<string, unknown> = {}; for (const k of keys) if (k in data) o[k] = data[k]; return o; },
    async set(items) { Object.assign(data, items); },
  };
}
const R: LookupResult = { word: "bank", phonetic: "/b/", is_phrase: false, senses: [], translation: null };
const settings = { ...DEFAULT_SETTINGS, apiKey: "sk-x" };

test("miss calls the model and stores the result", async () => {
  const call = vi.fn(async () => R);
  const st = fakeStorage();
  const out = await lookup("bank", "ctx", { storage: st, settings, now: 0, call });
  expect(out.cached).toBe(false);
  expect(call).toHaveBeenCalledOnce();
});

test("second identical lookup is served from cache", async () => {
  const call = vi.fn(async () => R);
  const st = fakeStorage();
  await lookup("bank", "ctx", { storage: st, settings, now: 0, call });
  const out = await lookup("bank", "ctx", { storage: st, settings, now: 1000, call });
  expect(out.cached).toBe(true);
  expect(call).toHaveBeenCalledOnce(); // not called again
});

test("changing target language bypasses the old cache entry", async () => {
  const call = vi.fn(async () => R);
  const st = fakeStorage();
  await lookup("bank", "ctx", { storage: st, settings, now: 0, call });
  const changed = { ...settings, targetLang: "Japanese" };
  const out = await lookup("bank", "ctx", { storage: st, settings: changed, now: 1000, call });
  expect(out.cached).toBe(false);
  expect(call).toHaveBeenCalledTimes(2);
});
