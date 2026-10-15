// Los nombres sociales se conservan como los entregó el equipo.
// No se inventan handles ni se considera que Instagram sea accesible vía X Search.
export const webSources = [
  ["The Hollywood Reporter", "hollywoodreporter.com"],
  ["DiscussingFilm", "discussingfilm.net"], ["Deadline", "deadline.com"],
  ["Variety", "variety.com"], ["Entertainment Weekly", "ew.com"],
  ["Fandango", "fandango.com"], ["IGN (Igndotcom)", "ign.com"],
  ["SensaCine", "sensacine.com"], ["Rotten Tomatoes", "rottentomatoes.com"],
  ["The Wrap", "thewrap.com"], ["ScreenRant", "screenrant.com"],
  ["Collider", "collider.com"], ["Puck", "puck.news"],
  ["IndieWire", "indiewire.com"], ["Page Six", "pagesix.com"],
  ["Empire", "empireonline.com"],
] as const;

export const pendingSocialSources = [
  "Complexpop", "Filmatic", "The Film Zone", "Ciak Club", "Steppingthrougfilms",
  "Bymarinamay", "Cinefilobpliviano", "Bey0ndthescreen", "Cineoculto", "Eatmovies",
  "The_goodfilms", "goosebumpscinema", "Inthenoodforkino", "Theacademy",
  "Paramountpictures", "Holahulu", "Disneyplusla", "Primevideolatam", "Hbomaxlat",
  "Mubilat", "Crunchyroll_la", "Netflixchile", "Hbomaxcl", "Diamondfilmschile",
  "Andesfilmscl", "Wbpictureschile", "Cinecolorchile", "Imagemfilmscl",
  "Bfdistribution", "Cactusmedios", "Dmediachile", "Cdifilmschile",
  "Cinetopiachile", "Plazaespectaculos", "Miradocchile",
];

export const confirmedSocialSources: { name: string; platform: "x" | "instagram"; handle: string; url: string }[] = [];

export function safeArticleUrl(value: string): URL | null {
  try {
    const url = new URL(value);
    if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) return null;
    return url;
  } catch { return null; }
}

export function sourceName(value: string): string {
  const url = safeArticleUrl(value);
  if (!url) return "Fuente no disponible";
  return webSources.find(([, domain]) => url.hostname === domain || url.hostname.endsWith(`.${domain}`))?.[0] ?? url.hostname.replace(/^www\./, "");
}

export function isPreferredSource(value: string): boolean {
  const url = safeArticleUrl(value);
  if (!url || url.pathname === "/") return false;
  if (webSources.some(([, domain]) => url.hostname === domain || url.hostname.endsWith(`.${domain}`))) return true;
  return confirmedSocialSources.some((source) => {
    // Los enlaces de publicaciones de X incluyen su autor. Instagram requiere
    // verificar cada permalink por separado: /p/id no identifica al autor.
    if (source.platform !== "x" || !["x.com", "www.x.com", "twitter.com", "www.twitter.com"].includes(url.hostname)) return false;
    const parts = url.pathname.split("/").filter(Boolean);
    return parts[0]?.toLowerCase() === source.handle.toLowerCase() && parts[1] === "status" && /^\d+$/.test(parts[2] ?? "");
  });
}
