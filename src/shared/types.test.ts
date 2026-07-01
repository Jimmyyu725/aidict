import { test, expect } from "vitest";
import { DEFAULT_SETTINGS } from "./types";

test("defaults match the global constraints", () => {
  expect(DEFAULT_SETTINGS.model).toBe("gpt-4o-mini");
  expect(DEFAULT_SETTINGS.targetLang).toBe("Chinese");
  expect(DEFAULT_SETTINGS.cacheTtlDays).toBe(30);
});
