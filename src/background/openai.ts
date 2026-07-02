import { LookupResult, Sense, Settings } from "../shared/types";

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
  let parsed: unknown;
  try { parsed = JSON.parse(raw); } catch { throw new Error("Model returned invalid JSON"); }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new Error("Model returned invalid response shape");
  }
  const obj = parsed as Record<string, unknown>;
  if (
    typeof obj.word !== "string" ||
    typeof obj.phonetic !== "string" ||
    typeof obj.is_phrase !== "boolean" ||
    !Array.isArray(obj.senses) ||
    !(obj.translation === null || typeof obj.translation === "string")
  ) {
    throw new Error("Model returned invalid response shape");
  }
  const senses: Sense[] = obj.senses.map((sense) => {
    if (typeof sense !== "object" || sense === null || Array.isArray(sense)) {
      throw new Error("Model returned invalid response shape");
    }
    const item = sense as Record<string, unknown>;
    if (typeof item.pos !== "string" || typeof item.en !== "string" || typeof item.zh !== "string") {
      throw new Error("Model returned invalid response shape");
    }
    return { pos: item.pos, en: item.en, zh: item.zh };
  });
  return {
    word: obj.word,
    phonetic: obj.phonetic,
    is_phrase: obj.is_phrase,
    senses,
    translation: obj.translation,
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
