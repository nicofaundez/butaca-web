import { test } from "node:test";
import assert from "node:assert/strict";
import { authorizedCron, authorizedTeam, sameRequestOrigin } from "../lib/auth";
import { isPreferredSource, safeArticleUrl, pendingSocialSources, webSources } from "../lib/sources";
import { batchSchema } from "../lib/news-schema";
const basic = (value: string) => `Basic ${Buffer.from(value).toString("base64")}`;
test("CSRF: admite el host real tras Next y rechaza origen ajeno o ausente", () => {
  const request = (origin?: string) => new Request("http://localhost:3000/api/news/claim", { headers: { host: "127.0.0.1:3000", ...(origin ? { origin } : {}) } });
  assert.equal(sameRequestOrigin(request("http://127.0.0.1:3000")), true);
  assert.equal(sameRequestOrigin(request("http://evil.example")), false);
  assert.equal(sameRequestOrigin(request("http://127.0.0.1:4000")), false);
  assert.equal(sameRequestOrigin(request("null")), false);
  assert.equal(sameRequestOrigin(request()), false);
});
test("credenciales ausentes, inválidas o malformadas no dan acceso", () => {
  assert.equal(authorizedTeam(null, "equipo", "clave"), false);
  assert.equal(authorizedTeam(basic("equipo:clave"), "equipo", undefined), false);
  assert.equal(authorizedTeam(basic("equipo:incorrecta"), "equipo", "clave"), false);
  assert.equal(authorizedTeam(basic("otro:clave"), "equipo", "clave"), false);
  assert.equal(authorizedTeam("Basic %%%", "equipo", "clave"), false);
});
test("contraseña compartida admite dos puntos y unicode", () => {
  assert.equal(authorizedTeam(basic("equipo:película:123"), "equipo", "película:123"), true);
});
test("la contraseña web no autoriza el cron, que falla cerrado", () => {
  assert.equal(authorizedCron(basic("equipo:clave"), "clave"), false);
  assert.equal(authorizedCron("Bearer undefined", undefined), false);
  assert.equal(authorizedCron("Bearer secreto", "secreto"), true);
});
test("valida dominios sin aceptar suplantaciones o URLs ejecutables", () => {
  assert.equal(isPreferredSource("https://variety.com/2026/film/noticia"), true);
  assert.equal(isPreferredSource("https://editorial.rottentomatoes.com/article/noticia"), true);
  assert.equal(isPreferredSource("https://variety.com.evil.example/noticia"), false);
  assert.equal(isPreferredSource("https://variety.com@evil.example/noticia"), false);
  assert.equal(isPreferredSource("https://variety.com/"), false);
  assert.equal(isPreferredSource("https://x.com/desconocido/status/123"), false);
  assert.equal(safeArticleUrl("javascript:alert(1)"), null);
});
test("preserva todas las fuentes y valida lotes por categoría sin inventar noticias", () => {
  assert.equal(webSources.length + pendingSocialSources.length, 51);
  const item = { titulo: "Título", resumen: "Resumen", enlace: "https://variety.com/nota", categoria: "Estrenos", tema_clave: "prueba-estreno" };
  assert.equal(batchSchema.safeParse({ noticias: [item, item, item] }).success, true);
  assert.equal(batchSchema.safeParse({ noticias: [item] }).success, true);
  assert.equal(batchSchema.safeParse({ noticias: [] }).success, true);
  assert.equal(batchSchema.safeParse({ noticias: Array(6).fill(item) }).success, false);
  assert.equal(batchSchema.safeParse({ noticias: [{ ...item, tema_clave: "" }] }).success, false);
  assert.equal(batchSchema.safeParse({ noticias: [item, item, { ...item, categoria: "Deportes" }] }).success, false);
});
