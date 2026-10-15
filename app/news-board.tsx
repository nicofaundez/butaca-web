"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { MediaSearch } from "./media-search";
import { categories, type News } from "@/lib/news-schema";
import { pendingSocialSources, safeArticleUrl, sourceName, webSources } from "@/lib/sources";
import { MAX_VISIBLE_NEWS } from "@/lib/news-config";

const normalize = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
const dateLabel = (date: string) => Number.isNaN(Date.parse(date)) ? "Sin fecha" : new Intl.DateTimeFormat("es-CL", { day: "numeric", month: "short", timeZone: "America/Santiago" }).format(new Date(date));

const PAGE_SIZE = 60;
const timeLabel = (date: string) => new Date(date).toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit", timeZone: "America/Santiago" });

export function NewsBoard({ news: initialNews, total: initialTotal, demo, error: initialError }: { news: News[]; total: number; demo: boolean; error: boolean }) {
  const [news, setNews] = useState(initialNews);
  const [total, setTotal] = useState(initialTotal);
  const [error, setError] = useState(initialError);
  const [name, setName] = useState("");
  const [status, setStatus] = useState("Todas");
  const [busy, setBusy] = useState(false);
  const [claimBusy, setClaimBusy] = useState(false);
  const [moreBusy, setMoreBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [lastUpdate, setLastUpdate] = useState<string | null>(null);
  const [nextAllowed, setNextAllowed] = useState<string | null>(null);
  const refreshInFlight = useRef(false);
  // Cantidad de noticias que el usuario quiere ver; la sincronización periódica la respeta.
  const limit = useRef(PAGE_SIZE);
  const load = useCallback(async () => {
    const response = await fetch(`/api/news?limit=${limit.current}`, { cache: "no-store" });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error);
    setNews(body.news); setTotal(body.total); setError(false); setLastUpdate(body.refresh.last_success); setNextAllowed(body.refresh.next_allowed ?? null);
    if (body.refresh.failed) setMessage("La última búsqueda falló. Se conservan las noticias anteriores.");
  }, []);
  const refresh = useCallback(async () => {
    if (refreshInFlight.current) return;
    refreshInFlight.current = true; setBusy(true);
    try {
      const response = await fetch("/api/news/refresh", { method: "POST" });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error);
      if (body.status === "demo") setMessage("Demostración: no se realizan búsquedas reales. Las reservas de prueba se comparten mientras este servidor esté activo.");
      else if (body.status === "disabled") setMessage("Búsqueda automática desactivada: falta configurar la clave de xAI en el servidor. Las noticias guardadas y las reservas funcionan con normalidad.");
      else if (body.status === "updated") {
        const parts = [`${body.insertadas} noticias nuevas`];
        if (body.duplicadas) parts.push(`${body.duplicadas} repetidas descartadas`);
        if (body.rechazadas) parts.push(`${body.rechazadas} fuera de las fuentes del equipo`);
        const failed = body.categorias_fallidas?.length ? ` No respondió: ${body.categorias_fallidas.join(", ")}.` : "";
        setMessage(`Actualización completada: ${parts.join(" · ")}.${failed}`);
      }
      else if (body.running) setMessage("Otro miembro ya inició la actualización. Verás los resultados al terminar.");
      else setMessage(body.next_allowed ? `La selección está al día. Próxima búsqueda disponible a las ${timeLabel(body.next_allowed)}.` : "La selección está al día. Vuelve a intentarlo en unos minutos.");
      await load();
    } catch (error) { setMessage(error instanceof Error ? error.message : "No se pudo actualizar"); }
    finally { refreshInFlight.current = false; setBusy(false); }
  }, [load]);
  async function loadMore() {
    setMoreBusy(true);
    limit.current = Math.min(MAX_VISIBLE_NEWS, limit.current + PAGE_SIZE);
    try { await load(); } catch { setMessage("No se pudieron cargar más noticias."); }
    finally { setMoreBusy(false); }
  }
  useEffect(() => {
    setName(localStorage.getItem("butaca-name") ?? "");
    // Al entrar se comprueba si corresponde buscar. El bloqueo compartido en
    // Supabase evita llamadas repetidas aunque entren varias personas a la vez.
    void refresh();
    const poll = setInterval(() => { if (!document.hidden) void load().catch(() => setMessage("No se pudo sincronizar. Comprueba la conexión antes de tomar una noticia.")); }, 15_000);
    const auto = setInterval(() => { if (!document.hidden) void refresh(); }, 60_000);
    const focus = () => { if (!document.hidden) void refresh(); };
    document.addEventListener("visibilitychange", focus);
    return () => { clearInterval(poll); clearInterval(auto); document.removeEventListener("visibilitychange", focus); };
  }, [load, refresh]);
  async function claim(id: string, action: "take" | "release" | "publish") {
    let activeName = name.trim();
    if (action === "take" && activeName.length < 2) {
      const prompted = window.prompt("¿Cuál es tu nombre o apodo para asignarte esta noticia? (Ej: Nicolás):");
      if (!prompted || prompted.trim().length < 2) {
        setMessage("Debes escribir tu nombre para poder tomar la noticia.");
        return;
      }
      activeName = prompted.trim().slice(0, 60);
      setName(activeName);
      localStorage.setItem("butaca-name", activeName);
    }
    setClaimBusy(true);
    try {
      const response = await fetch("/api/news/claim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, action, name: activeName }),
      });
      const body = await response.json();
      await load();
      if (!response.ok) throw new Error(body.error);
      setMessage(
        action === "take"
          ? `Noticia reservada para ${activeName}.`
          : action === "release"
          ? "La noticia vuelve a estar disponible."
          : "Marcada como publicada; no podrá volver a tomarse."
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo reservar");
    } finally {
      setClaimBusy(false);
    }
  }
  const [category, setCategory] = useState("Todas");
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<"news" | "sources" | "media">("news");
  const filtered = news.filter((item) => (status === "Todas" || (status === "Disponibles" && !item.tomada_por && !item.publicada) || (status === "Mis noticias" && item.mia) || (status === "Publicadas" && item.publicada)) && (category === "Todas" || item.categoria === category) && normalize(`${item.titulo} ${item.resumen} ${sourceName(item.enlace)}`).includes(normalize(search)));
  return <>
    <header className="site-header">
      <a href="/" className="brand" aria-label="La Butaca del Abuelo, inicio">
        {/* Imagen original entregada por el equipo. */}
        <img src="/logo-butaca.png" alt="Logo del abuelo con palomitas" width="88" height="66" />
        <span><small>LA</small> BUTACA <small>DEL ABUELO</small></span>
      </a>
      <nav aria-label="Secciones">
        <button className={tab === "news" ? "active" : ""} onClick={() => setTab("news")}>Noticias</button>
        <button className={tab === "sources" ? "active" : ""} onClick={() => setTab("sources")}>Fuentes</button>
        <button className={tab === "media" ? "active" : ""} onClick={() => setTab("media")}>Reels y frases</button>
      </nav>
      <span className="team-tag"><span aria-hidden="true">●</span> {name ? `EQUIPO · ${name}` : "SOLO EQUIPO"}</span>
    </header>
    <main>
      <section className="hero">
        <div><p className="eyebrow">LA COMUNIDAD CINÉFILA DEL ABUELO</p>
          <h1>EL CINE NO PARA.<br /><span>NOSOTROS TAMPOCO.</span></h1>
          <p className="intro">Historias, estrenos y conversaciones que merecen una butaca.</p>
        </div>
        <div className="ticket" aria-hidden="true"><span>ACCESO A LA FUNCIÓN</span><strong>BUTACA</strong><div>FILA <b>01</b><i />ASIENTO <b>03</b></div><span>PELÍCULAS · SERIES · COMUNIDAD</span></div>
      </section>
      {demo && <p className="notice" role="status"><b>VISTA DE DEMOSTRACIÓN</b> · Las tarjetas son ejemplos ficticios. No son noticias publicadas por las fuentes mencionadas.</p>}
      {tab === "news" ? <section aria-labelledby="news-title">
        <div className="section-heading"><div><p className="eyebrow">EN EL RADAR</p><h2 id="news-title">Últimas noticias<span className="count">{total || news.length}</span></h2></div>
          <button className="refresh" disabled={busy} onClick={() => void refresh()}>{busy ? "Buscando novedades…" : "Actualizar"} <span aria-hidden="true">↻</span></button>
        </div>
        <div className="team-controls">
          <label style={{ flex: 1, minWidth: "220px" }}>
            <span style={{ fontWeight: 600, color: "#facc15" }}>👤 Tu nombre de redactor:</span>
            <input
              maxLength={60}
              value={name}
              placeholder="¿Quién eres? (ej. Nicolás, Sofía...)"
              style={{ borderColor: !name ? "#facc15" : undefined }}
              onChange={(event) => {
                setName(event.target.value);
                localStorage.setItem("butaca-name", event.target.value);
              }}
            />
          </label>
          <label>Estado<select value={status} onChange={(event) => setStatus(event.target.value)}>{["Todas", "Disponibles", "Mis noticias", "Publicadas"].map((item) => <option key={item}>{item}</option>)}</select></label>
          <p>Última búsqueda completada:<br /><b>{lastUpdate ? new Date(lastUpdate).toLocaleString("es-CL", { timeZone: "America/Santiago" }) : demo ? "Modo demostración" : "Todavía sin actualización"}</b>{nextAllowed && Date.parse(nextAllowed) > Date.now() && <><br /><small>Próxima búsqueda disponible: {timeLabel(nextAllowed)}</small></>}</p>
        </div>
        <p className="sync-message" role="status">{message}</p>
        <div className="controls"><div className="filters" role="group" aria-label="Filtrar por categoría">
          {["Todas", ...categories].map((item) => <button key={item} aria-pressed={category === item} onClick={() => setCategory(item)}>{item}</button>)}
        </div><label className="search"><span className="sr-only">Buscar noticias</span><span aria-hidden="true">⌕</span><input type="search" placeholder="Buscar una historia…" value={search} onChange={(event) => setSearch(event.target.value)} /></label></div>
        {error ? <div className="empty" role="alert"><h3>No pudimos cargar las noticias</h3><p>La conexión con la fuente de noticias no está disponible. Intenta actualizar en unos minutos.</p><a href="/">Volver a intentar →</a></div> : filtered.length === 0 ? <div className="empty"><h3>{news.length ? "No encontramos esa historia" : "La próxima historia está por llegar"}</h3><p>{news.length ? "Prueba otra búsqueda o categoría." : "Las noticias aparecerán aquí cuando se incorporen a la selección del equipo."}</p>{news.length > 0 && <button onClick={() => { setSearch(""); setCategory("Todas"); }}>Limpiar filtros</button>}</div> : <div className="news-grid">
          {filtered.map((item, index) => {
            const url = safeArticleUrl(item.enlace);
            return <article className={`news-card category-${categories.indexOf(item.categoria)}`} key={item.id}>
              <div className="card-top"><span className="category">{item.categoria}</span><span className="card-index">{String(index + 1).padStart(2, "0")}</span></div>
              {item.imagen_url && safeArticleUrl(item.imagen_url)?.protocol === "https:" && <img className="article-image" src={item.imagen_url} alt="" loading="lazy" referrerPolicy="no-referrer" onError={(event) => { event.currentTarget.style.display = "none"; }} />}
              <div className="card-body"><div className="meta"><span>{demo ? "EJEMPLO EDITORIAL" : sourceName(item.enlace)}</span><time dateTime={item.fecha_creacion}>{dateLabel(item.fecha_creacion)}</time></div>
                <h3>{item.titulo}</h3><p>{item.resumen}</p></div>
              <div className="claim-controls"><span className={item.tomada_por ? "taken" : "available"}>{item.publicada ? `Publicada · ${item.tomada_por}` : item.tomada_por ? `Tomada por ${item.tomada_por}${item.mia ? " (tú)" : ""}` : "Disponible para el equipo"}</span>
                {!item.tomada_por && !item.publicada && <button disabled={claimBusy} onClick={() => void claim(item.id, "take")}>Tomar noticia</button>}
                {item.mia && !item.publicada && <div><button disabled={claimBusy} onClick={() => void claim(item.id, "publish")}>Marcar publicada</button><button className="secondary" disabled={claimBusy} onClick={() => void claim(item.id, "release")}>Liberar</button></div>}
              </div>
              <footer>{url ? <a href={url.href} target="_blank" rel="noopener noreferrer">{demo ? `Visitar ${sourceName(item.enlace)}` : "Leer en la fuente"}<span aria-hidden="true">↗</span></a> : <span>Enlace no disponible</span>}</footer>
            </article>;
          })}
        </div>}
        <p className="results" aria-live="polite">{filtered.length} noticias visibles · Mostrando {news.length} de {total || news.length}. Los filtros buscan entre las noticias cargadas.</p>
        {!error && news.length < total && news.length < MAX_VISIBLE_NEWS && <div className="load-more"><button className="refresh" disabled={moreBusy} onClick={() => void loadMore()}>{moreBusy ? "Cargando…" : "Cargar más noticias"}</button></div>}
      </section> : tab === "media" ? <MediaSearch /> : <section aria-labelledby="sources-title">
        <div className="section-heading"><div><p className="eyebrow">NUESTRA SELECCIÓN EDITORIAL</p><h2 id="sources-title">Las fuentes del equipo</h2></div></div>
        <p className="intro">Medios prioritarios para contrastar y atribuir cada historia.</p>
        <div className="source-grid">{webSources.map(([name, domain]) => <a key={domain} target="_blank" rel="noopener noreferrer" href={`https://${domain}`}><b>{name}</b><span>{domain} ↗</span></a>)}</div>
        <h3 className="pending-title">Cuentas de Instagram y X</h3><p className="intro">Lista del equipo. Pendientes de confirmar sus enlaces y plataforma antes de incorporarlas como fuentes automáticas.</p>
        <div className="source-tags">{pendingSocialSources.map((name) => <span key={name}>{name}</span>)}</div>
      </section>}
    </main>
    <footer className="site-footer"><span>LA BUTACA DEL ABUELO</span><p>Cine para compartir. Historias para conversar.</p><small>ESPACIO PRIVADO DEL EQUIPO</small></footer>
  </>;
}
