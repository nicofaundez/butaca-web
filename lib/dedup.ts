// Deduplicación editorial: además del enlace exacto (único en la base de datos),
// descarta la misma historia publicada por otro medio o con otra URL.
export type KnownNews = { titulo: string; enlace: string; tema_clave?: string | null };

const STOPWORDS = new Set([
  // Español
  "las", "los", "del", "una", "uno", "unos", "unas", "por", "para", "con", "sin", "sus", "que", "como", "mas", "más",
  "tras", "sobre", "entre", "desde", "hasta", "esta", "este", "estos", "estas", "ese", "esa", "son", "fue", "ser",
  "nuevo", "nueva", "nuevos", "nuevas", "primer", "primera", "segundo", "segunda", "anuncia", "confirma", "revela",
  "oficial", "oficialmente", "pelicula", "peliculas", "serie", "series", "cine", "hollywood",
  // Inglés (títulos y temas a veces llegan sin traducir)
  "the", "and", "for", "with", "from", "new", "first", "official", "movie", "film", "trailer",
]);

export function normalizeText(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

export function topicKey(value: string) {
  return normalizeText(value).replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80);
}

export function tokens(value: string) {
  return new Set(normalizeText(value).split(/[^a-z0-9]+/).filter((word) => word.length > 2 && !STOPWORDS.has(word)));
}

/** Coeficiente de Jaccard entre las palabras significativas de dos textos (0 a 1). */
export function similarity(a: string, b: string) {
  const left = tokens(a);
  const right = tokens(b);
  if (!left.size || !right.size) return 0;
  let shared = 0;
  for (const word of left) if (right.has(word)) shared++;
  return shared / (left.size + right.size - shared);
}

/** Clave comparable de una URL: sin www, sin barra final, sin fragmentos ni parámetros de seguimiento. */
export function urlKey(value: string) {
  try {
    const url = new URL(value);
    url.hash = "";
    for (const key of [...url.searchParams.keys()]) if (/^(utm_|fbclid$|gclid$|mc_|ref$|src$)/i.test(key)) url.searchParams.delete(key);
    const host = url.hostname.toLowerCase().replace(/^www\./, "");
    const path = url.pathname.replace(/\/+$/, "") || "/";
    return `${host}${path}${url.search}`;
  } catch {
    return value.trim().toLowerCase();
  }
}

export const TITLE_THRESHOLD = 0.5;
export const TOPIC_THRESHOLD = 0.6;

export function isDuplicate(item: KnownNews, known: KnownNews[]) {
  const link = urlKey(item.enlace);
  const topic = item.tema_clave ? topicKey(item.tema_clave) : "";
  return known.some((other) => {
    if (urlKey(other.enlace) === link) return true;
    const otherTopic = other.tema_clave ? topicKey(other.tema_clave) : "";
    if (topic && otherTopic && (topic === otherTopic || similarity(topic.replace(/-/g, " "), otherTopic.replace(/-/g, " ")) >= TOPIC_THRESHOLD)) return true;
    return similarity(item.titulo, other.titulo) >= TITLE_THRESHOLD;
  });
}

/** Separa noticias nuevas de repetidas, comparando también entre las del mismo lote. */
export function dedupe<T extends KnownNews>(items: T[], known: KnownNews[]) {
  const seen = [...known];
  const fresh: T[] = [];
  const duplicates: T[] = [];
  for (const item of items) {
    if (isDuplicate(item, seen)) duplicates.push(item);
    else { fresh.push(item); seen.push(item); }
  }
  return { fresh, duplicates };
}
