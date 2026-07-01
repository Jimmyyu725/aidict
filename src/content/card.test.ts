import { test, expect } from "vitest";
import { renderCardHTML } from "./card";
import { LookupResult } from "../shared/types";

test("loading state shows a spinner label", () => {
  expect(renderCardHTML({ kind: "loading" })).toContain("Looking up");
});

test("error state shows the message and a retry when allowed", () => {
  const html = renderCardHTML({ kind: "error", message: "Invalid API key", canRetry: true });
  expect(html).toContain("Invalid API key");
  expect(html).toContain("Retry");
});

test("single-word result shows phonetic and each sense (en + zh)", () => {
  const result: LookupResult = {
    word: "bank", phonetic: "/bæŋk/", is_phrase: false,
    senses: [{ pos: "n.", en: "a financial institution", zh: "银行" }], translation: null,
  };
  const html = renderCardHTML({ kind: "result", result });
  expect(html).toContain("/bæŋk/");
  expect(html).toContain("a financial institution");
  expect(html).toContain("银行");
});

test("phrase result shows the translation", () => {
  const result: LookupResult = {
    word: "break the ice", phonetic: "", is_phrase: true, senses: [], translation: "打破僵局",
  };
  expect(renderCardHTML({ kind: "result", result })).toContain("打破僵局");
});

test("error state hides retry button when canRetry is false", () => {
  const html = renderCardHTML({ kind: "error", message: "Quota exceeded", canRetry: false });
  expect(html).toContain("Quota exceeded");
  expect(html).not.toContain("Retry");
});

test("result HTML-escapes malicious model text", () => {
  const result: LookupResult = {
    word: "<script>alert(1)</script>", phonetic: "", is_phrase: false,
    senses: [{ pos: "n.", en: "x", zh: "y" }], translation: null,
  };
  const html = renderCardHTML({ kind: "result", result });
  expect(html).not.toContain("<script>alert(1)</script>");
  expect(html).toContain("&lt;script&gt;");
});
