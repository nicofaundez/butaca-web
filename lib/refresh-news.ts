import "server-only";
import { beginJob, endJob, refreshState } from "./jobs";
import { buscarYGuardarNoticias } from "./grok";
import { buscarYGuardarNoticiasRSS } from "./rss-news";
import { newsConfig } from "./news-config";

export async function refreshNews() {
  if (process.env.DEMO_MODE === "true") return { status: "demo", ...await refreshState() };

  // La espera se comparte entre el botón y el cron: nunca hay dos búsquedas seguidas.
  const token = await beginJob("news", newsConfig().cooldownSeconds);
  if (!token) return { status: "cached", ...await refreshState() };

  try {
    let result;
    // Si hay clave configurada, intenta Grok primero. Si falla (saldo agotado, error) o no hay clave, pasa al lector RSS gratuito.
    if (process.env.XAI_API_KEY) {
      try {
        result = await buscarYGuardarNoticias();
      } catch (grokError) {
        console.warn("Grok no disponible o sin saldo. Pasando al lector RSS gratuito:", grokError instanceof Error ? grokError.message : grokError);
        result = await buscarYGuardarNoticiasRSS();
      }
    } else {
      result = await buscarYGuardarNoticiasRSS();
    }

    await endJob("news", token, true);
    return { status: "updated", ...result, ...await refreshState() };
  } catch (error) {
    await endJob("news", token, false).catch(() => undefined);
    throw error;
  }
}
