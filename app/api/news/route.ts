import { requireTeam, memberId, apiFailure } from "@/lib/team-api";
import { readNews, PAGE_SIZE } from "@/lib/news-store";
import { refreshState } from "@/lib/jobs";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  try {
    requireTeam(request);
    const limit = Number(new URL(request.url).searchParams.get("limit") ?? PAGE_SIZE);
    const { news, total } = await readNews(await memberId(), limit);
    return Response.json({ news, total, refresh: await refreshState() }, { headers: { "Cache-Control": "private, no-store" } });
  }
  catch (error) { return apiFailure(error); }
}
