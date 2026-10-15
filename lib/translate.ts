export async function translateToSpanish(text: string): Promise<string> {
  if (!text || !text.trim()) return text;
  try {
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=es&dt=t&q=${encodeURIComponent(text.trim())}`;
    const response = await fetch(url, {
      signal: AbortSignal.timeout(6000),
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; ButacaTranslate/1.0)",
      },
    });

    if (!response.ok) return text;
    const json = await response.json();
    if (Array.isArray(json?.[0])) {
      const translated = json[0].map((chunk: unknown) => (Array.isArray(chunk) ? chunk[0] : "")).join("");
      return translated.trim() || text;
    }
    return text;
  } catch (err) {
    console.warn("Error en traducción automática:", err instanceof Error ? err.message : err);
    return text;
  }
}
