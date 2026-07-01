export function tokenizeWords(text: string): string[] {
  return (text.match(/[A-Za-z]+(?:[-'][A-Za-z]+)*/g) ?? []).filter((w) => w.length > 0);
}
