import { z } from "zod";
import { MAX_PER_CATEGORY } from "./news-config";
export const categories = ["Farándula", "Estrenos", "Efemérides", "Breaking News"] as const;
export type Category = (typeof categories)[number];
export const newsSchema = z.object({
  titulo: z.string().trim().min(1).max(200),
  resumen: z.string().trim().min(1).max(1000),
  enlace: z.string().url(), categoria: z.enum(categories),
}).strict();
// Cada noticia de Grok trae un tema clave corto (p. ej. "dune-3-trailer") para detectar repetidos.
export const grokNewsSchema = newsSchema.extend({ tema_clave: z.string().trim().min(3).max(80) }).strict();
// Grok puede devolver menos noticias de las pedidas (incluso ninguna) en vez de inventar para rellenar.
export const batchSchema = z.object({ noticias: z.array(grokNewsSchema).max(MAX_PER_CATEGORY) }).strict();
export type GrokNews = z.infer<typeof grokNewsSchema>;
export type News = z.infer<typeof newsSchema> & {
  id: string; fecha_creacion: string; imagen_url?: string | null;
  tomada_por?: string | null; tomada_en?: string | null;
  publicada?: boolean; mia?: boolean;
};
