import { NextRequest, NextResponse } from "next/server";
import { authorizedCron, authorizedTeam } from "./lib/auth";

// Next.js 16 denomina Proxy al middleware de entrada.
export function proxy(request: NextRequest) {
  const auth = request.headers.get("authorization");
  const cron = request.nextUrl.pathname === "/api/cron";
  const allowed = cron
    ? authorizedCron(auth, process.env.CRON_SECRET)
    : authorizedTeam(auth, process.env.TEAM_USER ?? "equipo", process.env.TEAM_PASSWORD);

  if (!allowed) {
    return new NextResponse("Acceso privado. Se requieren credenciales del equipo.", {
      status: 401,
      headers: {
        ...(cron ? {} : { "WWW-Authenticate": 'Basic realm="BUTACA · Equipo", charset="UTF-8"' }),
        "Cache-Control": "private, no-store",
      },
    });
  }
  const response = NextResponse.next();
  response.headers.set("Cache-Control", "private, no-store");
  response.headers.set("X-Robots-Tag", "noindex, nofollow");
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  return response;
}

// Incluye páginas, API, recursos y solicitudes RSC/prefetch.
export const config = { matcher: ["/:path*"] };
