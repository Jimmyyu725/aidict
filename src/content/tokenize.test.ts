import { test, expect } from "vitest";
import { tokenizeWords } from "./tokenize";

test("tokenizeWords extracts alphabetic words", () => {
  expect(tokenizeWords("The quick, brown fox!")).toEqual(["The", "quick", "brown", "fox"]);
});

test("tokenizeWords keeps hyphens and apostrophes inside words", () => {
  expect(tokenizeWords("well-being isn't easy")).toEqual(["well-being", "isn't", "easy"]);
});

test("tokenizeWords drops numbers and symbols", () => {
  expect(tokenizeWords("price 42$ up")).toEqual(["price", "up"]);
});
