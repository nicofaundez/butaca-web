import { z } from "zod";
import { ApiError, apiFailure, requireTeam } from "@/lib/team-api";
import { searchYouTubeMedia } from "@/lib/youtube";

export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    requireTeam(request, true);
    const body = await request.json();
    const query = z.object({
      q: z.string().trim().min(2).max(250),
      tipo: z.enum(["Reel", "Entrevista"]),
    }).safeParse(body);

    if (!query.success) {
      throw new ApiError("Escribe una búsqueda de al menos 2 caracteres.");
    }

    const { q, tipo } = query.data;
    const youtubeKind = tipo === "Reel" ? "Short" : "Entrevista";
    const videos = await searchYouTubeMedia(q, youtubeKind);

    const resultados = videos.map((v) => ({
      titulo: v.titulo,
      descripcion: `${v.canal} · ${v.vistas}${v.duracion ? ` · Duración: ${v.duracion}` : ""}`,
      enlace: v.enlace,
      tipo,
      thumbnail: v.thumbnail,
      embedUrl: v.embedUrl,
    }));

    return Response.json({
      resultados,
      notice: resultados.length
        ? `Se encontraron ${resultados.length} videos en YouTube.`
        : "No encontramos videos para esa búsqueda. Intenta con otro término (ej. el nombre del actor o la película).",
    });
  } catch (error) {
    return apiFailure(error);
  }
}
