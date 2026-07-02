export function normalize(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, " ");
}

export function cacheKey(term: string, context: string, ...dimensions: string[]): string {
  const input = [term, context, ...dimensions].map(normalize).join("\u0000");
  let h = 0x811c9dc5; // FNV-1a 32-bit
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return "k" + (h >>> 0).toString(16);
}
