import { test, expect } from "vitest";
import { extractSentence, shouldPrefetch } from "./selection";

test("extractSentence returns the sentence containing the selection", () => {
  const text = "I went to the bank. It was closed. Then I left.";
  expect(extractSentence(text, "bank")).toBe("I went to the bank.");
});

test("extractSentence falls back to the selection when not found", () => {
  expect(extractSentence("unrelated text", "xyz")).toBe("xyz");
});

test("extractSentence handles selection in the first sentence with no leading punctuation", () => {
  expect(extractSentence("Hello world here. Next one.", "world")).toBe("Hello world here.");
});

test("extractSentence uses the selected occurrence when text repeats", () => {
  const text = "I sat on the river bank. Later I visited the bank.";
  expect(extractSentence(text, "bank", text.lastIndexOf("bank"))).toBe("Later I visited the bank.");
});

test("shouldPrefetch accepts a single word and a short phrase", () => {
  expect(shouldPrefetch("bank")).toBe(true);
  expect(shouldPrefetch("break the ice")).toBe(true);
});

test("shouldPrefetch rejects empty, over-long, and letterless selections", () => {
  expect(shouldPrefetch("   ")).toBe(false);
  expect(shouldPrefetch("a".repeat(61))).toBe(false);
  expect(shouldPrefetch("12345 %$#")).toBe(false);
});
