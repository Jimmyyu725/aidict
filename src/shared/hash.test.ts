import { test, expect } from "vitest";
import { normalize, cacheKey } from "./hash";

test("normalize lowercases, trims, collapses whitespace", () => {
  expect(normalize("  Hello   World ")).toBe("hello world");
});

test("cacheKey is stable and normalization-insensitive", () => {
  expect(cacheKey("Bank", "a River  Bank")).toBe(cacheKey("bank", "a river bank"));
});

test("cacheKey differs for different context", () => {
  expect(cacheKey("bank", "money bank")).not.toBe(cacheKey("bank", "river bank"));
});

test("cacheKey differs for model and target language", () => {
  expect(cacheKey("bank", "ctx", "gpt-4o-mini", "Chinese"))
    .not.toBe(cacheKey("bank", "ctx", "gpt-4o-mini", "Japanese"));
  expect(cacheKey("bank", "ctx", "gpt-4o-mini", "Chinese"))
    .not.toBe(cacheKey("bank", "ctx", "gpt-4.1-mini", "Chinese"));
});
