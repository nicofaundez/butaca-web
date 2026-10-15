import { XMLParser } from "fast-xml-parser";
import { categories, type Category } from "./news-schema";
import { dedupe, topicKey, type KnownNews } from "./dedup";
import { newsConfig } from "./news-config";
import { safeArticleUrl } from "./sources";

export interface RssFeedSource {
  name: string;
  url: string;
  lang: "es" | "en";
  defaultCategory?: Category;
}

export const RSS_SOURCES: RssFeedSource[] = [
  { name: "SensaCine", url: "https://www.sensacine.com/rss/noticias.xml", lang: "es", defaultCategory: "Estrenos" },
  { name: "Espinof", url: "https://www.espinof.com/feed", lang: "es", defaultCategory: "Estrenos" },
  { name: "IGN Cine", url: "https://es.ign.com/feed.xml", lang: "es", defaultCategory: "Breaking News" },
  { name: "Variety", url: "https://variety.com/feed/", lang: "en", defaultCategory: "Breaking News" },
  { name: "Deadline", url: "https://deadline.com/feed/", lang: "en", defaultCategory: "Breaking News" },
  { name: "The Hollywood Reporter", url: "https://www.hollywoodreporter.com/feed/", lang: "en", defaultCategory: "Estrenos" },
  { name: "Collider", url: "https://collider.com/feed/", lang: "en", defaultCategory: "Estrenos" },
];

function cleanHtml(raw: string): string {
  return raw
    .replace(/<[^>]+>/g, " ")
    .replace(/&#(\d+);/g, (_, code) => {
      try { return String.fromCharCode(Number(code)); } catch { return ""; }
    })
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => {
      try { return String.fromCharCode(parseInt(code, 16)); } catch { return ""; }
    })
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function cleanLink(value: string): string {
  try {
    const url = new URL(value);
    url.hash = "";
    for (const key of [...url.searchParams.keys()]) {
      if (/^(utm_|fbclid$|gclid$|mc_|ref$|src$)/i.test(key)) url.searchParams.delete(key);
    }
    return url.href;
  } catch {
    return value.trim();
  }
}

function categorizeItem(title: string, summary: string, rawCategories: string[], fallback: Category = "Estrenos"): Category {
  const text = `${title} ${summary} ${rawCategories.join(" ")}`.toLowerCase();

  // Efemérides: aniversarios, recuerdos, hace X años
  if (/aniversario|cumple\b|hace \d+ a[ñn]os|a[ñn]os de su estreno|recordando|retrospectiva|anniversary|years ago/i.test(text)) {
    return "Efemérides";
  }

  // Breaking News: urgencias, fichajes clave, cancelaciones, premios importantes, fallecimientos
  if (/fallece|muere\b|urgente|breaking|cancelada|cancelaci[oó]n|fichaje|adquisici[oó]n|despido|renuncia|exclusiva|alerta/i.test(text)) {
    return "Breaking News";
  }

  // Farándula: parejas, bodas, vida privada, alfombra roja, polémicas, declaraciones personales
  if (/romance|pareja|boda|divorcio|hijos|alfombra roja|red carpet|pol[eé]mica|confiesa|declaraciones|vida privada|celebrity|fandr[aá]ndula/i.test(text)) {
    return "Farándula";
  }

  // Estrenos: trailers, taquilla, fechas de estreno, series, películas
  if (/tr[aá]iler|estreno|taquilla|box office|teaser|primer vistazo|p[oó]ster|cartelera|nueva pel[ií]cula|nueva serie|temporada/i.test(text)) {
    return "Estrenos";
  }

  return fallback;
}

function extractImage(item: Record<string, unknown>, rawXmlChunk: string): string | null {
  // 1. Etiqueta enclosure
  const enclosure = item["enclosure"] as Record<string, unknown> | undefined;
  if (enclosure && typeof enclosure["@_url"] === "string" && enclosure["@_url"].startsWith("http")) {
    return enclosure["@_url"];
  }

  // 2. Media content o media thumbnail
  const mediaContent = item["media:content"] as Record<string, unknown> | undefined;
  if (mediaContent && typeof mediaContent["@_url"] === "string" && mediaContent["@_url"].startsWith("http")) {
    return mediaContent["@_url"];
  }

  const mediaThumbnail = item["media:thumbnail"] as Record<string, unknown> | undefined;
  if (mediaThumbnail && typeof mediaThumbnail["@_url"] === "string" && mediaThumbnail["@_url"].startsWith("http")) {
    return mediaThumbnail["@_url"];
  }

  // 3. Buscar etiquetas <img> dentro del contenido o descripción
  const desc = String(item["description"] || item["content:encoded"] || "");
  const imgMatch = desc.match(/<img[^>]+src=["'](https?:\/\/[^"'>]+)["']/i);
  if (imgMatch && imgMatch[1]) {
    return imgMatch[1];
  }

  // 4. Buscar en el fragmento sin parsear
  const rawMatch = rawXmlChunk.match(/<enclosure[^>]+url=["'](https?:\/\/[^"'>]+)["']/i) ||
                   rawXmlChunk.match(/<media:(?:content|thumbnail)[^>]+url=["'](https?:\/\/[^"'>]+)["']/i);
  if (rawMatch && rawMatch[1]) {
    return rawMatch[1];
  }

  return null;
}

export async function fetchFeedItems(feed: RssFeedSource): Promise<Array<{
  titulo: string;
  resumen: string;
  enlace: string;
  categoria: Category;
  tema_clave: string;
  imagen_url: string | null;
}>> {
  try {
    const response = await fetch(feed.url, {
      signal: AbortSignal.timeout(10_000),
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; ButacaNews/1.0)",
        "Accept": "application/rss+xml, application/xml, text/xml, */*",
      },
    });

    if (!response.ok) return [];
    const xml = await response.text();

    const parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: "@_",
      textNodeName: "#text",
      trimValues: true,
    });

    const parsed = parser.parse(xml);
    const channel = parsed?.rss?.channel || parsed?.feed;
    const itemsRaw = channel?.item || channel?.entry;
    if (!itemsRaw) return [];

    const list = Array.isArray(itemsRaw) ? itemsRaw : [itemsRaw];
    const results: Array<{
      titulo: string;
      resumen: string;
      enlace: string;
      categoria: Category;
      tema_clave: string;
      imagen_url: string | null;
    }> = [];

    for (const item of list.slice(0, 10)) {
      const rawTitle = typeof item.title === "object" ? item.title["#text"] || "" : String(item.title || "");
      const titulo = cleanHtml(rawTitle).slice(0, 200);
      if (!titulo || titulo.length < 5) continue;

      let rawLink = "";
      if (typeof item.link === "string") {
        rawLink = item.link;
      } else if (Array.isArray(item.link)) {
        const found = item.link.find((l: Record<string, unknown>) => l["@_rel"] === "alternate") || item.link[0];
        rawLink = typeof found === "object" ? found["@_href"] || found["#text"] : String(found);
      } else if (typeof item.link === "object" && item.link) {
        rawLink = item.link["@_href"] || item.link["#text"] || "";
      }

      const enlace = cleanLink(rawLink);
      if (!safeArticleUrl(enlace)) continue;

      const rawDesc = typeof item.description === "object" ? item.description["#text"] || "" : String(item.description || item.summary || "");
      let resumen = cleanHtml(rawDesc).slice(0, 600);
      if (!resumen || resumen.length < 10) resumen = titulo;

      const rawCats = Array.isArray(item.category)
        ? item.category.map((c: unknown) => typeof c === "object" && c ? (c as Record<string, unknown>)["#text"] || (c as Record<string, unknown>)["@_term"] : String(c))
        : item.category ? [String(item.category)] : [];

      const categoria = categorizeItem(titulo, resumen, rawCats, feed.defaultCategory);
      const tema_clave = topicKey(titulo);
      const imagen_url = extractImage(item, xml);

      results.push({
        titulo,
        resumen,
        enlace,
        categoria,
        tema_clave,
        imagen_url,
      });
    }

    return results;
  } catch (err) {
    console.error(`Error leyendo feed RSS (${feed.name}):`, err instanceof Error ? err.message : err);
    return [];
  }
}

export async function buscarYGuardarNoticiasRSS() {
  const { getSupabase } = await import("./supabase");
  const { articleImage } = await import("./article-image");
  const db = getSupabase();
  const { dedupDays } = newsConfig();
  const now = new Date();
  const windowStart = new Date(now.getTime() - dedupDays * 24 * 60 * 60 * 1000).toISOString();

  const { data: recent, error: recentError } = await db.from("noticias_cine")
    .select("titulo,enlace,tema_clave").gte("fecha_creacion", windowStart)
    .order("fecha_creacion", { ascending: false }).limit(500);

  if (recentError) throw new Error("No se pudieron consultar noticias anteriores");
  const known = (recent ?? []) as KnownNews[];

  // Traer feeds en paralelo
  const allResults = await Promise.allSettled(RSS_SOURCES.map((source) => fetchFeedItems(source)));
  const collected = allResults.flatMap((res) => res.status === "fulfilled" ? res.value : []);

  if (!collected.length) {
    return {
      encontradas: 0,
      insertadas: 0,
      duplicadas: 0,
      rechazadas: 0,
      fuente: "rss",
    };
  }

  // Deduplicación contra el histórico y dentro del mismo lote
  const { fresh, duplicates } = dedupe(collected, known);

  let inserted = 0;
  if (fresh.length) {
    // Si algún item no trajo imagen directa del RSS, intentar obtener og:image con límite de concurrencia
    const rows = await Promise.all(fresh.map(async (noticia) => {
      let img = noticia.imagen_url;
      if (!img) {
        img = await articleImage(noticia.enlace);
      }
      return {
        ...noticia,
        imagen_url: img,
      };
    }));

    const { data, error } = await db.from("noticias_cine")
      .upsert(rows, { onConflict: "enlace", ignoreDuplicates: true })
      .select("id");

    if (error) throw new Error(`Error de Supabase: ${error.code}`);
    inserted = data?.length ?? 0;
  }

  return {
    encontradas: collected.length,
    insertadas: inserted,
    duplicadas: duplicates.length + (fresh.length - inserted),
    rechazadas: 0,
    fuente: "rss",
  };
}
