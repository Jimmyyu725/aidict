import { test, expect } from "vitest";
import { buildMessages, parseResponse, callOpenAI } from "./openai";
import { Settings, DEFAULT_SETTINGS } from "../shared/types";

test("buildMessages embeds term, context, and target language", () => {
  const msgs = buildMessages("bank", "sat on the river bank", "Chinese");
  const joined = msgs.map(m => m.content).join("\n");
  expect(joined).toContain("bank");
  expect(joined).toContain("river bank");
  expect(joined).toContain("Chinese");
});

test("parseResponse fills defaults and coerces senses", () => {
  const r = parseResponse('{"word":"bank","phonetic":"/bæŋk/","is_phrase":false,"senses":[{"pos":"n.","en":"a financial institution","zh":"银行"}]}');
  expect(r.word).toBe("bank");
  expect(r.senses[0].zh).toBe("银行");
  expect(r.translation).toBeNull();
});

test("parseResponse throws on invalid JSON", () => {
  expect(() => parseResponse("not json")).toThrow();
});

test("callOpenAI returns parsed result on success", async () => {
  const settings: Settings = { ...DEFAULT_SETTINGS, apiKey: "sk-x" };
  const fakeFetch = async () => new Response(JSON.stringify({
    choices: [{ message: { content: '{"word":"bank","phonetic":"/b/","is_phrase":false,"senses":[],"translation":null}' } }],
  }), { status: 200 });
  const r = await callOpenAI(settings, "bank", "ctx", fakeFetch as unknown as typeof fetch);
  expect(r.word).toBe("bank");
});

test("callOpenAI throws NO_API_KEY when key missing", async () => {
  await expect(callOpenAI(DEFAULT_SETTINGS, "bank", "ctx")).rejects.toThrow("NO_API_KEY");
});

test("callOpenAI maps 401 to a clear message", async () => {
  const settings: Settings = { ...DEFAULT_SETTINGS, apiKey: "sk-x" };
  const fakeFetch = async () => new Response("nope", { status: 401 });
  await expect(callOpenAI(settings, "bank", "ctx", fakeFetch as unknown as typeof fetch)).rejects.toThrow("Invalid API key");
});
