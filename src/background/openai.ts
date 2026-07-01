import { LookupResult, Settings } from "../shared/types";

export function buildMessages(term: string, context: string, targetLang: string) {
  const system =
    `You are a bilingual dictionary engine. The user selected a term on a web page. ` +
    `Return ONLY a JSON object with this exact shape: ` +
    `{"word":string,"phonetic":string,"is_phrase":boolean,` +
    `"senses":[{"pos":string,"en":string,"zh":string}],"translation":string|null}. ` +
    `"phonetic" is the English IPA. "zh" and "translation" must be written in ${targetLang}. ` +
    `If the term is a single word: is_phrase=false, fill senses (most relevant first, disambiguated ` +
    `by the context sentence), translation=null. If it is a phrase or sentence: is_phrase=true, put ` +
    `the ${targetLang} translation in "translation", senses may be []. No prose, no markdown.`;
  const user = `Term: ${term}\nContext sentence: ${context || "(none)"}`;
  return [
    { role: "system", content: system },
    { role: "user", content: user },
  ];
}

export function parseResponse(raw: string): LookupResult {
  let obj: any;
  try { obj = JSON.parse(raw); } catch { throw new Error("Model returned invalid JSON"); }
  if (typeof obj !== "object" || obj === null) throw new Error("Model returned non-object");
  const senses = Array.isArray(obj.senses)
    ? obj.senses.filter((s: any) => s && typeof s === "object")
        .map((s: any) => ({ pos: String(s.pos ?? ""), en: String(s.en ?? ""), zh: String(s.zh ?? "") }))
    : [];
  return {
    word: String(obj.word ?? ""),
    phonetic: String(obj.phonetic ?? ""),
    is_phrase: Boolean(obj.is_phrase),
    senses,
    translation: obj.translation == null ? null : String(obj.translation),
  };
}

export async function callOpenAI(
  settings: Settings, term: string, context: string, fetchFn: typeof fetch = fetch
): Promise<LookupResult> {
  if (!settings.apiKey) throw new Error("NO_API_KEY");
  const res = await fetchFn("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${settings.apiKey}` },
    body: JSON.stringify({
      model: settings.model,
      messages: buildMessages(term, context, settings.targetLang),
      response_format: { type: "json_object" },
      temperature: 0.2,
    }),
  });
  if (!res.ok) {
    if (res.status === 401) throw new Error("Invalid API key");
    if (res.status === 429) throw new Error("Rate limited — try again shortly");
    throw new Error(`OpenAI error ${res.status}`);
  }
  const data = await res.json();
  const content = data?.choices?.[0]?.message?.content;
  if (typeof content !== "string") throw new Error("Empty response from model");
  return parseResponse(content);
}
