export interface YouTubeVideoResult {
  id: string;
  titulo: string;
  canal: string;
  vistas: string;
  duracion?: string;
  enlace: string;
  thumbnail: string;
  embedUrl: string;
  tipo: "Short" | "Entrevista";
}

export async function searchYouTubeMedia(
  query: string,
  kind: "Short" | "Entrevista" = "Short"
): Promise<YouTubeVideoResult[]> {
  const cleanQ = query.trim();
  if (!cleanQ || cleanQ.length < 2) return [];

  // Ajustar términos de búsqueda según el formato
  let searchTerms = cleanQ;
  if (kind === "Short") {
    if (!/short/i.test(cleanQ)) searchTerms = `${cleanQ} shorts`;
  } else {
    if (!/entrevista|interview/i.test(cleanQ)) searchTerms = `${cleanQ} entrevista cine`;
  }

  // 1. Si existe clave oficial de YouTube Data API v3, usarla
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (apiKey) {
    try {
      const url = new URL("https://www.googleapis.com/youtube/v3/search");
      url.searchParams.set("part", "snippet");
      url.searchParams.set("q", searchTerms);
      url.searchParams.set("type", "video");
      url.searchParams.set("maxResults", "10");
      if (kind === "Short") {
        url.searchParams.set("videoDuration", "short");
      }
      url.searchParams.set("key", apiKey);

      const res = await fetch(url.href, { signal: AbortSignal.timeout(8000) });
      if (res.ok) {
        const json = await res.json();
        if (Array.isArray(json.items)) {
          return json.items
            .filter((item: any) => item.id?.videoId)
            .map((item: any) => {
              const videoId = item.id.videoId;
              return {
                id: videoId,
                titulo: item.snippet.title || "Video de cine",
                canal: item.snippet.channelTitle || "YouTube",
                vistas: "Disponible en YouTube",
                enlace: kind === "Short" ? `https://www.youtube.com/shorts/${videoId}` : `https://www.youtube.com/watch?v=${videoId}`,
                thumbnail: item.snippet.thumbnails?.high?.url || `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
                embedUrl: `https://www.youtube-nocookie.com/embed/${videoId}`,
                tipo: kind,
              };
            });
        }
      }
    } catch (err) {
      console.warn("YouTube API error, usando buscador público:", err instanceof Error ? err.message : err);
    }
  }

  // 2. Buscador público directo de YouTube (100% gratuito)
  try {
    const searchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(searchTerms)}`;
    const response = await fetch(searchUrl, {
      signal: AbortSignal.timeout(10_000),
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept-Language": "es-419,es;q=0.9,en;q=0.8",
      },
    });

    if (!response.ok) return [];
    const html = await response.text();

    const match = html.match(/ytInitialData\s*=\s*({[\s\S]*?});\s*<\/script>/);
    if (!match || !match[1]) return [];

    const data = JSON.parse(match[1]);
    const seenIds = new Set<string>();
    const results: YouTubeVideoResult[] = [];

    const walk = (obj: any) => {
      if (!obj || typeof obj !== "object") return;

      // Video regular
      if (obj.videoRenderer) {
        const v = obj.videoRenderer;
        const videoId = v.videoId;
        if (videoId && !seenIds.has(videoId)) {
          const rawTitle = v.title?.runs?.[0]?.text || v.title?.simpleText || "";
          if (rawTitle) {
            seenIds.add(videoId);
            results.push({
              id: videoId,
              titulo: rawTitle,
              canal: v.ownerText?.runs?.[0]?.text || "YouTube",
              vistas: v.viewCountText?.simpleText || v.viewCountText?.runs?.[0]?.text || "Viral",
              duracion: v.lengthText?.simpleText,
              enlace: kind === "Short" ? `https://www.youtube.com/shorts/${videoId}` : `https://www.youtube.com/watch?v=${videoId}`,
              thumbnail: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
              embedUrl: `https://www.youtube-nocookie.com/embed/${videoId}`,
              tipo: kind,
            });
          }
        }
      }

      // Reel o Short clásico
      if (obj.reelItemRenderer) {
        const r = obj.reelItemRenderer;
        const videoId = r.videoId;
        if (videoId && !seenIds.has(videoId)) {
          const rawTitle = r.headline?.simpleText || r.title?.runs?.[0]?.text || "";
          if (rawTitle) {
            seenIds.add(videoId);
            results.push({
              id: videoId,
              titulo: rawTitle,
              canal: "YouTube Shorts",
              vistas: r.viewCountText?.simpleText || "Viral",
              duracion: "< 60s",
              enlace: `https://www.youtube.com/shorts/${videoId}`,
              thumbnail: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
              embedUrl: `https://www.youtube-nocookie.com/embed/${videoId}`,
              tipo: "Short",
            });
          }
        }
      }

      // Shorts en nuevo formato de YouTube
      if (obj.shortsLockupViewModel) {
        const s = obj.shortsLockupViewModel;
        const rawTitle = s.overlayMetadata?.primaryText?.content || "";
        const idMatch = JSON.stringify(s).match(/videoId["\']?\s*:\s*["\']([a-zA-Z0-9_-]{11})["\']/);
        if (idMatch && idMatch[1] && !seenIds.has(idMatch[1]) && rawTitle) {
          const videoId = idMatch[1];
          seenIds.add(videoId);
          results.push({
            id: videoId,
            titulo: rawTitle,
            canal: "YouTube Shorts",
            vistas: s.overlayMetadata?.secondaryText?.content || "Viral",
            duracion: "< 60s",
            enlace: `https://www.youtube.com/shorts/${videoId}`,
            thumbnail: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
            embedUrl: `https://www.youtube-nocookie.com/embed/${videoId}`,
            tipo: "Short",
          });
        }
      }

      for (const k of Object.keys(obj)) {
        walk(obj[k]);
      }
    };

    walk(data);
    return results.slice(0, 10);
  } catch (error) {
    console.error("Error buscando videos en YouTube:", error instanceof Error ? error.message : error);
    return [];
  }
}
