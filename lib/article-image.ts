import "server-only";
import { webSources } from "./sources";
// Solo se descargan páginas de los dominios editoriales exactos. No se siguen
// redirecciones a hosts arbitrarios ni se descargan imágenes desde el servidor.
function allowed(url: URL) {
  return url.protocol === "https:" && !url.username && !url.password && (!url.port || url.port === "443") && webSources.some(([, domain]) => url.hostname === domain || url.hostname === `www.${domain}` || url.hostname === `editorial.${domain}`);
}
export async function articleImage(link: string): Promise<string | null> {
  try {
    let url = new URL(link);
    const signal = AbortSignal.timeout(5000);
    for (let hop = 0; hop < 3; hop++) {
      if (!allowed(url)) return null;
      const response = await fetch(url, { redirect: "manual", signal, headers: { "User-Agent": "ButacaPreview/1.0", Accept: "text/html" } });
      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get("location"); await response.body?.cancel();
        if (!location) return null; url = new URL(location, url); continue;
      }
      if (!response.ok || !response.headers.get("content-type")?.includes("text/html")) { await response.body?.cancel(); return null; }
      const reader = response.body?.getReader(); if (!reader) return null;
      let html = ""; let bytes = 0; const decoder = new TextDecoder();
      try {
        while (bytes < 512_000) { const { done, value } = await reader.read(); if (done) break; bytes += value.byteLength; html += decoder.decode(value, { stream: true }); if (html.includes("</head>")) break; }
      } finally { await reader.cancel(); }
      const tags = html.match(/<meta\b[^>]*>/gi) ?? [];
      for (const tag of tags) {
        const attrs = Object.fromEntries([...tag.matchAll(/([\w:-]+)\s*=\s*["']([^"']*)["']/g)].map((match) => [match[1].toLowerCase(), match[2]]));
        if (!["og:image", "twitter:image"].includes(attrs.property ?? attrs.name ?? "") || !attrs.content) continue;
        const image = new URL(attrs.content.replace(/&amp;/g, "&"), url);
        if (image.protocol === "https:" && !image.username && !image.password && !image.port && !/^(localhost|127\.|10\.|192\.168\.|\[)/i.test(image.hostname)) return image.href;
      }
      return null;
    }
  } catch { /* Una fuente sin imagen no impide guardar la noticia. */ }
  return null;
}
