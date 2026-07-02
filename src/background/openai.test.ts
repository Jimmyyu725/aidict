import { test, expect } from "vitest";
import {
  buildMessages,
  parseResponse,
  callOpenAI,
  isSingleWordTerm,
  markTermInContext,
} from "./openai";
import { Settings, DEFAULT_SETTINGS } from "../shared/types";

test("buildMessages embeds term, context, and target language", () => {
  const msgs = buildMessages("bank", "sat on the river bank", "Chinese");
  const joined = msgs.map(m => m.content).join("\n");
  expect(joined).toContain("bank");
  expect(joined).toContain("river [[bank]]");
  expect(joined).toContain("Chinese");
  expect(joined).toContain("n., v., adj., adv.");
  expect(joined).toContain("interj.");
  expect(joined).toContain("SINGLE_WORD");
  expect(joined).toContain("Context only (do not translate)");
});

test("isSingleWordTerm distinguishes words from phrases", () => {
  expect(isSingleWordTerm("rewarding")).toBe(true);
  expect(isSingleWordTerm("well-being")).toBe(true);
  expect(isSingleWordTerm("we're")).toBe(true);
  expect(isSingleWordTerm("rewarding you")).toBe(false);
});

test("markTermInContext highlights the selected term case-insensitively", () => {
  expect(markTermInContext(
    "rewarding",
    "We're Rewarding you with a low rate."
  )).toBe("We're [[Rewarding]] you with a low rate.");
});

test("word prompt requires context-specific grammar classification", () => {
  const joined = buildMessages(
    "rewarding",
    "We're rewarding you with a low rate.",
    "Chinese"
  ).map((message) => message.content).join("\n");
  expect(joined).toContain("We're [[rewarding]] you");
  expect(joined).toContain("is v.");
  expect(joined).toContain("a [[rewarding]] job");
});

test("parseResponse accepts a complete valid response", () => {
  const r = parseResponse('{"word":"bank","phonetic":"/bæŋk/","is_phrase":false,"senses":[{"pos":"n.","en":"a financial institution","zh":"银行"}],"translation":null}');
  expect(r.word).toBe("bank");
  expect(r.senses[0].zh).toBe("银行");
  expect(r.translation).toBeNull();
});

test("parseResponse throws on invalid JSON", () => {
  expect(() => parseResponse("not json")).toThrow();
});

test("parseResponse rejects missing required fields", () => {
  expect(() => parseResponse("{}")).toThrow("invalid response shape");
});

test("parseResponse rejects malformed senses", () => {
  expect(() => parseResponse(
    '{"word":"bank","phonetic":"/b/","is_phrase":false,"senses":[{"pos":"n.","en":42,"zh":"银行"}],"translation":null}'
  )).toThrow("invalid response shape");
});

test("callOpenAI returns parsed result on success", async () => {
  const settings: Settings = { ...DEFAULT_SETTINGS, apiKey: "sk-x" };
  const fakeFetch = async () => new Response(JSON.stringify({
    choices: [{ message: { content: '{"word":"bank","phonetic":"/b/","is_phrase":false,"senses":[{"pos":"n.","en":"a financial institution","zh":"银行"}],"translation":null}' } }],
  }), { status: 200 });
  const r = await callOpenAI(settings, "bank", "ctx", fakeFetch as unknown as typeof fetch);
  expect(r.word).toBe("bank");
});

test("callOpenAI forces a selected word into dictionary mode", async () => {
  const settings: Settings = { ...DEFAULT_SETTINGS, apiKey: "sk-x" };
  const fakeFetch = async () => new Response(JSON.stringify({
    choices: [{ message: { content: '{"word":"rewarding","phonetic":"/rɪˈwɔːrdɪŋ/","is_phrase":true,"senses":[{"pos":"v.","en":"giving something in recognition","zh":"奖励"}],"translation":"整句翻译"}' } }],
  }), { status: 200 });
  const r = await callOpenAI(settings, "rewarding", "We're rewarding you with a low rate.", fakeFetch as unknown as typeof fetch);
  expect(r.is_phrase).toBe(false);
  expect(r.translation).toBeNull();
  expect(r.senses[0].zh).toBe("奖励");
});

test("callOpenAI rejects a sentence translation returned for a selected word", async () => {
  const settings: Settings = { ...DEFAULT_SETTINGS, apiKey: "sk-x" };
  const fakeFetch = async () => new Response(JSON.stringify({
    choices: [{ message: { content: '{"word":"rewarding","phonetic":"","is_phrase":true,"senses":[],"translation":"整句翻译"}' } }],
  }), { status: 200 });
  await expect(callOpenAI(
    settings,
    "rewarding",
    "We're rewarding you with a low rate.",
    fakeFetch as unknown as typeof fetch
  )).rejects.toThrow("no dictionary senses");
});

test("callOpenAI throws NO_API_KEY when key missing", async () => {
  await expect(callOpenAI(DEFAULT_SETTINGS, "bank", "ctx")).rejects.toThrow("NO_API_KEY");
});

test("callOpenAI maps 401 to a clear message", async () => {
  const settings: Settings = { ...DEFAULT_SETTINGS, apiKey: "sk-x" };
  const fakeFetch = async () => new Response("nope", { status: 401 });
  await expect(callOpenAI(settings, "bank", "ctx", fakeFetch as unknown as typeof fetch)).rejects.toThrow("Invalid API key");
});
