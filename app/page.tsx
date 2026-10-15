import { headers } from "next/headers";
import { authorizedTeam } from "@/lib/auth";
import { readNews } from "@/lib/news-store";
import { memberId } from "@/lib/team-api";
import type { News } from "@/lib/news-schema";
import { NewsBoard } from "./news-board";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function Home() {
  // No consulta ni serializa datos si el acceso no es válido.
  if (!authorizedTeam((await headers()).get("authorization"), process.env.TEAM_USER ?? "equipo", process.env.TEAM_PASSWORD)) {
    return <main className="access-message"><h1>Acceso privado</h1><p>Inicia sesión con las credenciales del equipo.</p></main>;
  }
  const demo = process.env.DEMO_MODE === "true";
  let news: News[] = [];
  let total = 0;
  let error = false;
    try {
      ({ news, total } = await readNews(await memberId()));
    } catch {
      console.error("No se pudo consultar noticias_cine. Revisa la configuración y los permisos de Supabase.");
      error = true;
    }
  return <NewsBoard news={news} total={total} demo={demo} error={error} />;
}
