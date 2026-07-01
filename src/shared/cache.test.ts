import { test, expect } from "vitest";
import { getCached, setCached } from "./cache";
import { StorageArea } from "./settings";
import { LookupResult } from "./types";

function fakeStorage(): StorageArea {
  const data: Record<string, unknown> = {};
  return {
    async get(keys) { const o: Record<string, unknown> = {}; for (const k of keys) if (k in data) o[k] = data[k]; return o; },
    async set(items) { Object.assign(data, items); },
  };
}
const R: LookupResult = { word: "bank", phonetic: "/bæŋk/", is_phrase: false, senses: [], translation: null };
const DAY = 24 * 60 * 60 * 1000;

test("miss on empty store", async () => {
  expect(await getCached(fakeStorage(), "k1", 30, 1000)).toBeNull();
});

test("hit within TTL", async () => {
  const st = fakeStorage();
  await setCached(st, "k1", R, 0);
  expect(await getCached(st, "k1", 30, 10 * DAY)).toEqual(R);
});

test("expired entry returns null", async () => {
  const st = fakeStorage();
  await setCached(st, "k1", R, 0);
  expect(await getCached(st, "k1", 30, 31 * DAY)).toBeNull();
});
