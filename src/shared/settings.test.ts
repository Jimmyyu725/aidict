import { test, expect } from "vitest";
import { loadSettings, saveSettings, StorageArea } from "./settings";

function fakeStorage(): StorageArea & { data: Record<string, unknown> } {
  const data: Record<string, unknown> = {};
  return {
    data,
    async get(keys) { const o: Record<string, unknown> = {}; for (const k of keys) if (k in data) o[k] = data[k]; return o; },
    async set(items) { Object.assign(data, items); },
  };
}

test("loadSettings returns defaults when empty", async () => {
  const s = await loadSettings(fakeStorage());
  expect(s.model).toBe("gpt-4o-mini");
  expect(s.apiKey).toBe("");
});

test("saveSettings merges a patch and persists", async () => {
  const st = fakeStorage();
  const saved = await saveSettings(st, { apiKey: "sk-test", model: "gpt-4o" });
  expect(saved.apiKey).toBe("sk-test");
  expect(saved.model).toBe("gpt-4o");
  const reloaded = await loadSettings(st);
  expect(reloaded.apiKey).toBe("sk-test");
  expect(reloaded.targetLang).toBe("Chinese"); // untouched default
});
