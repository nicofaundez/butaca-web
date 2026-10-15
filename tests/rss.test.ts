import { test } from "node:test";
import assert from "node:assert/strict";
import { fetchFeedItems, type RssFeedSource } from "../lib/rss-news";

test("lector RSS procesa fuentes de cine y extrae campos requeridos", async () => {
  // Test con una fuente activa
  const source: RssFeedSource = {
    name: "SensaCine",
    url: "https://www.sensacine.com/rss/noticias.xml",
    lang: "es",
    defaultCategory: "Estrenos",
  };

  const items = await fetchFeedItems(source);
  // Al consultar el feed público real debe retornar noticias
  assert.ok(items.length > 0, "Debe obtener noticias del feed RSS de SensaCine");

  const first = items[0];
  assert.ok(first.titulo.length >= 5, "Debe tener un título válido");
  assert.ok(first.enlace.startsWith("https://"), "Debe tener un enlace https");
  assert.ok(["Farándula", "Estrenos", "Efemérides", "Breaking News"].includes(first.categoria), "Debe tener una categoría válida");
  assert.ok(first.tema_clave.length >= 2, "Debe generar un tema clave");
});
