import { authorizedCron } from "@/lib/auth";
import { refreshNews } from "@/lib/refresh-news";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 150;

export async function GET(request: Request) {
  // Defensa adicional además de Proxy. La contraseña web no ejecuta el cron.
  if (!authorizedCron(request.headers.get("authorization"), process.env.CRON_SECRET)) {
    return Response.json({ error: "No autorizado" }, { status: 401 });
  }
  try {
    const result = await refreshNews();
    if (result.status === "disabled") return Response.json({ error: "Falta XAI_API_KEY en el servidor" }, { status: 503 });
    return Response.json({ ok: true, ...result }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Cron de BUTACA:", error instanceof Error ? error.message : "Error desconocido");
    return Response.json({ error: "No se pudo completar la búsqueda de noticias" }, { status: 500 });
  }
}
