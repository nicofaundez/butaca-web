import { z } from "zod";
import { requireTeam, memberId, apiFailure, ApiError } from "@/lib/team-api";
import { editClaim } from "@/lib/news-store";
const schema = z.object({ id: z.string().min(1).max(80), name: z.string().trim().min(2).max(60), action: z.enum(["take", "release", "publish"]) });
export async function POST(request: Request) {
  try {
    requireTeam(request, true);
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) throw new ApiError("Indica tu nombre (2 a 60 caracteres) y una noticia válida.");
    const { id, name, action } = parsed.data;
    if (process.env.DEMO_MODE !== "true" && !z.string().uuid().safeParse(id).success) throw new ApiError("Noticia inválida");
    if (!await editClaim(id, (await memberId(true))!, name, action)) throw new ApiError("La noticia ya fue tomada o cambió de estado. Actualizamos la lista.", 409);
    return Response.json({ ok: true });
  } catch (error) { return apiFailure(error); }
}
