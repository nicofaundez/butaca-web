import { createHash, timingSafeEqual } from "node:crypto";

// Next puede normalizar request.url a localhost internamente. Host conserva
// el destino de la solicitud del navegador, sin confiar en X-Forwarded-Host.
export function sameRequestOrigin(request: Request): boolean {
  try {
    const origin = request.headers.get("origin");
    if (!origin || origin === "null") return false;
    const source = new URL(origin);
    const target = new URL(request.url);
    return source.origin === origin && ["http:", "https:"].includes(source.protocol)
      && source.protocol === target.protocol
      && source.host === (request.headers.get("host") ?? target.host);
  } catch { return false; }
}

export function sameSecret(actual: string, expected: string): boolean {
  return timingSafeEqual(createHash("sha256").update(actual).digest(), createHash("sha256").update(expected).digest());
}

export function authorizedTeam(header: string | null, user: string | undefined, password: string | undefined): boolean {
  if (!password || !user || !header?.startsWith("Basic ")) return false;
  try {
    const decoded = Buffer.from(header.slice(6), "base64").toString("utf8");
    const separator = decoded.indexOf(":");
    if (separator < 0) return false;
    const validUser = sameSecret(decoded.slice(0, separator), user);
    const validPassword = sameSecret(decoded.slice(separator + 1), password);
    return validUser && validPassword;
  } catch { return false; }
}

export function authorizedCron(header: string | null, secret: string | undefined): boolean {
  return Boolean(secret && header && sameSecret(header, `Bearer ${secret}`));
}
