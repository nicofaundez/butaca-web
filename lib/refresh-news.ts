import "server-only";
import { beginJob, endJob, refreshState } from "./jobs";
import { buscarYGuardarNoticias } from "./grok";
import { newsConfig } from "./news-config";
export async function refreshNews() {
  if (process.env.DEMO_MODE === "true") return { status: "demo", ...await refreshState() };
  // Sin clave de xAI la web sigue operativa con Supabase (lectura y reservas); solo se desactiva la búsqueda.
  if (!process.env.XAI_API_KEY) return { status: "disabled", ...await refreshState() };
  // La espera se comparte entre el botón y el cron: nunca hay dos búsquedas seguidas.
  const token = await beginJob("news", newsConfig().cooldownSeconds);
  if (!token) return { status: "cached", ...await refreshState() };
  try {
    const result = await buscarYGuardarNoticias();
    await endJob("news", token, true);
    return { status: "updated", ...result, ...await refreshState() };
  } catch (error) {
    await endJob("news", token, false).catch(() => undefined);
    throw error;
  }
}
