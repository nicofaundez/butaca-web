import { test } from "node:test";
import assert from "node:assert/strict";
import { dedupe, isDuplicate } from "../lib/dedup";
import { newsConfig } from "../lib/news-config";

test("reconoce la misma noticia en otro medio y dentro del mismo lote", () => {
  const first = { titulo: "Dune presenta un avance", enlace: "https://variety.com/a", tema_clave: "dune-3-trailer" };
  const second = { titulo: "Las primeras imágenes de la tercera entrega", enlace: "https://deadline.com/b", tema_clave: "dune-3-trailer" };
  assert.equal(isDuplicate(second, [first]), true);
  assert.equal(dedupe([first, second], []).duplicates.length, 1);
  assert.equal(isDuplicate({ ...second, enlace: "https://www.variety.com/a/?utm_source=test", tema_clave: "otra-clave" }, [first]), true);
});

test("conserva temas distintos y limita frecuencia y cantidad de búsquedas", () => {
  const result = dedupe([
    { titulo: "Zendaya protagoniza una comedia", enlace: "https://variety.com/a", tema_clave: "zendaya-comedia" },
    { titulo: "Aniversario de Casablanca", enlace: "https://deadline.com/b", tema_clave: "casablanca-aniversario" },
  ], []);
  assert.equal(result.fresh.length, 2);
  assert.equal(newsConfig({}).cooldownSeconds, 300);
  assert.equal(newsConfig({ NEWS_PER_CATEGORY: "999", REFRESH_COOLDOWN_MINUTES: "0" }).perCategory, 5);
  assert.equal(newsConfig({ REFRESH_COOLDOWN_MINUTES: "0" }).cooldownSeconds, 60);
});
