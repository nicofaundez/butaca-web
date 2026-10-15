import "server-only";
import { getSupabase } from "./supabase";
import { demoNews } from "./demo";
import type { News } from "./news-schema";
import { MAX_VISIBLE_NEWS } from "./news-config";
type StoredNews = News & { owner_id?: string | null };
const demoGlobal = globalThis as typeof globalThis & { butacaDemo?: StoredNews[] };
export function demoRows(): StoredNews[] { return demoGlobal.butacaDemo ??= structuredClone(demoNews); }
export function publicNews(row: StoredNews, member: string | null): News {
  const { owner_id, ...news } = row;
  return { ...news, mia: Boolean(member && owner_id === member) };
}
export const PAGE_SIZE = 60;
export async function readNews(member: string | null, limit = PAGE_SIZE): Promise<{ news: News[]; total: number }> {
  const size = Math.min(MAX_VISIBLE_NEWS, Math.max(1, Math.trunc(limit) || PAGE_SIZE));
  if (process.env.DEMO_MODE === "true") {
    const rows = demoRows();
    return { news: rows.slice(0, size).map((row) => publicNews(row, member)), total: rows.length };
  }
  const { data, error, count } = await getSupabase().from("noticias_cine")
    .select("id,titulo,resumen,enlace,categoria,fecha_creacion,imagen_url,tomada_por,tomada_en,owner_id,publicada", { count: "exact" })
    .order("fecha_creacion", { ascending: false }).order("id", { ascending: true }).limit(size);
  if (error) throw new Error(`Supabase noticias: ${error.code}`);
  return { news: (data as StoredNews[]).map((row) => publicNews(row, member)), total: count ?? data.length };
}
export async function editClaim(id: string, member: string, name: string, action: "take" | "release" | "publish") {
  if (process.env.DEMO_MODE === "true") {
    const row = demoRows().find((item) => item.id === id);
    if (!row || row.publicada || (action === "take" ? Boolean(row.owner_id) : row.owner_id !== member)) return false;
    if (action === "take") Object.assign(row, { owner_id: member, tomada_por: name, tomada_en: new Date().toISOString() });
    if (action === "release") Object.assign(row, { owner_id: null, tomada_por: null, tomada_en: null });
    if (action === "publish") row.publicada = true;
    return true;
  }
  const { data, error } = await getSupabase().rpc("butaca_claim", { p_id: id, p_member: member, p_name: name, p_action: action });
  if (error) throw new Error(`Supabase reserva: ${error.code}`);
  return data === true;
}
