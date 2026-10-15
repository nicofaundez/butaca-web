import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { findQuotes } from "../lib/transcripts";

test("SQL: una sola reserva, liberación solo del dueño, publicada no se reasigna, permisos y bloqueo compartido", async () => {
  const db = new PGlite();
  try {
    await db.exec("create role anon; create role authenticated; create role service_role bypassrls;");
    await db.exec(await readFile(new URL("../supabase/schema.sql", import.meta.url), "utf8"));
    await db.exec(await readFile(new URL("../supabase/migrations/20261013033710_team_claims_refresh_images.sql", import.meta.url), "utf8"));
    await db.exec(await readFile(new URL("../supabase/migrations/20261013041000_news_topic_key.sql", import.meta.url), "utf8"));
    await db.exec("insert into noticias_cine (id,titulo,resumen,enlace,categoria) values ('11111111-1111-4111-8111-111111111111','Prueba','Resumen','https://variety.com/prueba','Estrenos'); set role service_role;");
    const id = "11111111-1111-4111-8111-111111111111";
    const one = "22222222-2222-4222-8222-222222222222";
    const two = "33333333-3333-4333-8333-333333333333";
    const claim = async (member: string, action: string) => (await db.query<{ ok: boolean }>("select public.butaca_claim($1,$2,'Equipo',$3) as ok", [id, member, action])).rows[0].ok;
    assert.deepEqual(await Promise.all([claim(one, "take"), claim(two, "take")]), [true, false]);
    assert.equal(await claim(two, "release"), false);
    assert.equal(await claim(one, "release"), true);
    assert.equal(await claim(two, "take"), true);
    assert.equal(await claim(two, "publish"), true);
    assert.equal(await claim(two, "release"), false);
    assert.equal(await claim(one, "take"), false);
    const begin = async (token: string) => (await db.query<{ ok: boolean }>("select butaca_begin_job('news',$1,300) as ok", [token])).rows[0].ok;
    assert.deepEqual(await Promise.all([begin(one), begin(two)]), [true, false]);
    await db.query("select butaca_end_job('news',$1,true)", [two]);
    assert.equal((await db.query<{ token: string }>("select token from butaca_jobs")).rows[0].token, one);
    await db.query("select butaca_end_job('news',$1,true)", [one]);
    assert.equal(await begin(two), false); // Cooldown survives completion.
    await db.exec("update butaca_jobs set next_allowed=now()-interval '1 second',lease_until=now()-interval '1 second'");
    assert.equal(await begin(two), true);
    await db.query("select butaca_end_job('news',$1,false)", [two]);
    const state = (await db.query<{ last_failed: boolean; last_success: string }>("select last_failed,last_success from butaca_jobs")).rows[0];
    assert.equal(state.last_failed, true); assert.ok(state.last_success);
    await db.exec("reset role");
    const security = (await db.query<{ allowed: boolean; rls: boolean }>("select has_function_privilege('anon','public.butaca_claim(uuid,uuid,text,text)','execute') as allowed, relrowsecurity as rls from pg_class where relname='butaca_jobs'")).rows[0];
    assert.equal(security.allowed, false); assert.equal(security.rls, true);
    await db.exec("set role anon");
    await assert.rejects(db.query("select * from public.butaca_jobs"));
  } finally { await db.close(); }
});

test("frases literales en SRT/VTT conservan el timestamp; no inventa citas", () => {
  const srt = "1\n00:00:03,000 --> 00:00:07,000\nEl cine nos une\ny nos hace pensar.\n\n2\n00:00:08,000 --> 00:00:10,000\nOtra idea.";
  assert.deepEqual(findQuotes(srt, "cine nos une y"), [{ text: "El cine nos une y nos hace pensar.", timestamp: "00:00:03,000" }]);
  assert.equal(findQuotes(srt, "algo que nadie dijo").length, 0);
  assert.equal(findQuotes("Una frase sin tiempo", "sin tiempo")[0].timestamp, null);
  assert.equal(findQuotes(srt, "").length, 0);
});
