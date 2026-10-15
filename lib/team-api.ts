import "server-only";
import { cookies } from "next/headers";
import { randomUUID } from "node:crypto";
import { authorizedTeam, sameRequestOrigin } from "./auth";

export class ApiError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}
export function requireTeam(request: Request, mutation = false) {
  if (!authorizedTeam(request.headers.get("authorization"), process.env.TEAM_USER ?? "equipo", process.env.TEAM_PASSWORD)) throw new ApiError("No autorizado", 401);
  if (mutation && !sameRequestOrigin(request)) throw new ApiError("Origen no permitido", 403);
}
export async function memberId(create = false) {
  const jar = await cookies();
  const existing = jar.get("butaca-member")?.value;
  if (existing && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(existing)) return existing;
  if (!create) return null;
  const id = randomUUID();
  jar.set("butaca-member", id, { httpOnly: true, secure: process.env.VERCEL === "1", sameSite: "strict", path: "/", maxAge: 60 * 60 * 24 * 365 });
  return id;
}
export function apiFailure(error: unknown) {
  if (error instanceof ApiError) return Response.json({ error: error.message }, { status: error.status });
  console.error("BUTACA API:", error instanceof Error ? error.message : "Error desconocido");
  return Response.json({ error: "No se pudo completar la operación. Revisa la conexión y la configuración del servidor." }, { status: 503 });
}
