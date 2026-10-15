import { requireTeam, apiFailure } from "@/lib/team-api";
import { refreshNews } from "@/lib/refresh-news";
export const maxDuration = 150;
export async function POST(request: Request) {
  try { requireTeam(request, true); return Response.json(await refreshNews()); }
  catch (error) { return apiFailure(error); }
}
