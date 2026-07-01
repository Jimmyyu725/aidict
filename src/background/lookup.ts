import { LookupResult, Settings } from "../shared/types";
import { StorageArea } from "../shared/settings";
import { getCached, setCached } from "../shared/cache";
import { cacheKey } from "../shared/hash";
import { callOpenAI } from "./openai";

export interface LookupDeps {
  storage: StorageArea;
  settings: Settings;
  now: number;
  call?: typeof callOpenAI;
  fetchFn?: typeof fetch;
}

export async function lookup(
  term: string, context: string, deps: LookupDeps
): Promise<{ result: LookupResult; cached: boolean }> {
  const key = cacheKey(term, context);
  const hit = await getCached(deps.storage, key, deps.settings.cacheTtlDays, deps.now);
  if (hit) return { result: hit, cached: true };
  const call = deps.call ?? callOpenAI;
  const result = await call(deps.settings, term, context, deps.fetchFn ?? fetch);
  await setCached(deps.storage, key, result, deps.now);
  return { result, cached: false };
}
