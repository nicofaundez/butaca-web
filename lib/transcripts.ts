export type QuoteMatch = { text: string; timestamp: string | null };
export function findQuotes(transcript: string, phrase: string): QuoteMatch[] {
  const needle = phrase.trim().toLocaleLowerCase();
  if (needle.length < 2) return [];
  const normalized = transcript.replace(/\r\n?/g, "\n");
  const blocks = normalized.split(/\n\s*\n/);
  const results: QuoteMatch[] = [];
  for (const block of blocks) {
    const lines = block.split("\n");
    const stamp = lines.find((line) => /\d{1,2}:\d{2}(?::\d{2})?[.,]\d{3}\s*-->/.test(line))?.split(" -->")[0].trim() ?? null;
    const text = lines.filter((line) => !/^\d+$/.test(line.trim()) && !line.includes("-->") && !/^(WEBVTT|NOTE)/.test(line)).join(" ").replace(/<[^>]*>/g, "").trim();
    if (text.toLocaleLowerCase().includes(needle)) results.push({ text: text.slice(0, 3000), timestamp: stamp });
    if (results.length >= 50) break;
  }
  return results;
}
