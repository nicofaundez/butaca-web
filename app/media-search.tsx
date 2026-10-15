"use client";
import { useState } from "react";
import { findQuotes } from "@/lib/transcripts";

type Result = {
  titulo: string;
  descripcion: string;
  enlace: string;
  tipo: string;
  thumbnail?: string;
  embedUrl?: string;
};

export function MediaSearch() {
  const [q, setQ] = useState("");
  const [kind, setKind] = useState<"Reel" | "Entrevista">("Reel");
  const [results, setResults] = useState<Result[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [activeVideo, setActiveVideo] = useState<string | null>(null);

  const [transcript, setTranscript] = useState("");
  const [phrase, setPhrase] = useState("");
  const matches = findQuotes(transcript, phrase);

  async function search(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    setResults([]);
    setActiveVideo(null);
    try {
      const response = await fetch("/api/media/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ q, tipo: kind }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error);
      setResults(body.resultados || []);
      setMessage(body.notice ?? "");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo buscar");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="media-section">
      <p className="eyebrow">IDEAS VIRALES Y CONTENIDO DE CINE</p>
      <h2>Buscador de Shorts y Entrevistas</h2>
      <p className="intro">
        Encuentra clips virales, momentos destacados y entrevistas de actores o películas directamente desde YouTube para compartir en las redes del equipo.
      </p>

      <form className="media-form" onSubmit={search}>
        <label>
          Actor, director o película
          <input
            minLength={2}
            maxLength={250}
            required
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Ej: Pedro Pascal, Timothée Chalamet, Dune..."
          />
        </label>
        <label>
          Formato
          <select value={kind} onChange={(e) => setKind(e.target.value as "Reel" | "Entrevista")}>
            <option value="Reel">Shorts / Reels (Vertical)</option>
            <option value="Entrevista">Entrevistas completas</option>
          </select>
        </label>
        <button disabled={busy}>{busy ? "Buscando en YouTube…" : "Buscar videos"}</button>
      </form>

      {message && <p role="status" className="sync-message">{message}</p>}

      {/* Reproductor incrustado cuando seleccionan un video */}
      {activeVideo && (
        <div style={{ margin: "24px 0", background: "#111", borderRadius: "10px", padding: "16px", border: "1px solid var(--line)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
            <span style={{ color: "#facc15", fontSize: "13px", fontWeight: "bold" }}>▶ Reproduciendo vista previa</span>
            <button
              onClick={() => setActiveVideo(null)}
              style={{ background: "#222", border: "1px solid #444", color: "#fff", borderRadius: "4px", padding: "4px 10px", cursor: "pointer", fontSize: "12px" }}
            >
              ✕ Cerrar
            </button>
          </div>
          <div style={{ position: "relative", width: "100%", maxWidth: kind === "Reel" ? "380px" : "720px", margin: "0 auto", aspectRatio: kind === "Reel" ? "9/16" : "16/9", background: "#000", borderRadius: "8px", overflow: "hidden" }}>
            <iframe
              src={`${activeVideo}?autoplay=1`}
              style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", border: 0 }}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </div>
        </div>
      )}

      {/* Resultados de videos */}
      {results.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: "20px", marginTop: "24px" }}>
          {results.map((result) => (
            <article
              key={result.enlace}
              style={{
                background: "var(--card)",
                border: "1px solid var(--line)",
                borderRadius: "8px",
                overflow: "hidden",
                display: "flex",
                flexDirection: "column",
              }}
            >
              {result.thumbnail && (
                <div style={{ position: "relative", width: "100%", aspectRatio: kind === "Reel" ? "9/12" : "16/9", background: "#1a1a1a", overflow: "hidden" }}>
                  <img
                    src={result.thumbnail}
                    alt={result.titulo}
                    style={{ width: "100%", height: "100%", objectFit: "cover" }}
                    loading="lazy"
                  />
                  <button
                    type="button"
                    onClick={() => setActiveVideo(result.embedUrl || null)}
                    style={{
                      position: "absolute",
                      inset: 0,
                      margin: "auto",
                      width: "48px",
                      height: "48px",
                      borderRadius: "50%",
                      background: "rgba(0,0,0,0.75)",
                      border: "2px solid #facc15",
                      color: "#facc15",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      cursor: "pointer",
                      fontSize: "18px",
                    }}
                    title="Reproducir clip"
                  >
                    ▶
                  </button>
                </div>
              )}
              <div style={{ padding: "16px", display: "flex", flexDirection: "column", flex: 1, gap: "8px" }}>
                <b style={{ color: "white", fontSize: "14px", lineHeight: 1.4 }}>{result.titulo}</b>
                <span style={{ color: "var(--muted)", fontSize: "12px" }}>{result.descripcion}</span>
                <div style={{ marginTop: "auto", paddingTop: "12px", borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                  <a
                    href={result.enlace}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ color: "#facc15", fontSize: "12px", textDecoration: "none", fontWeight: 500 }}
                  >
                    Abrir en YouTube ↗
                  </a>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      {/* Herramienta de transcripciones */}
      <div className="transcript-tool" style={{ marginTop: "40px" }}>
        <h3>Buscador de frases exactas en transcripciones</h3>
        <p className="intro">
          Pega una transcripción de entrevista o carga subtítulos TXT, SRT o VTT para encontrar el segundo exacto donde un actor dice una frase para tu video. La búsqueda se realiza localmente en tu navegador.
        </p>
        <label className="file-label">
          Cargar archivo de subtítulos
          <input
            type="file"
            accept=".txt,.srt,.vtt"
            onChange={async (event) => {
              const file = event.target.files?.[0];
              if (!file) return;
              if (file.size > 2_000_000) {
                setMessage("La transcripción debe pesar menos de 2 MB.");
                return;
              }
              setTranscript(await file.text());
            }}
          />
        </label>
        <label>
          Transcripción
          <textarea
            maxLength={2_000_000}
            rows={6}
            value={transcript}
            onChange={(e) => setTranscript(e.target.value)}
            placeholder="Pega aquí los subtítulos o el texto de la entrevista…"
          />
        </label>
        <label>
          Frase a encontrar
          <input
            value={phrase}
            onChange={(e) => setPhrase(e.target.value)}
            placeholder="Escribe la palabra o frase que buscas..."
          />
        </label>
        {phrase.trim().length >= 2 && (
          <p className="intro" aria-live="polite">
            {matches.length} coincidencias encontradas.
          </p>
        )}
        {matches.map((match, index) => (
          <blockquote key={index}>
            {match.timestamp && <b>{match.timestamp}</b>}
            <p>{match.text}</p>
          </blockquote>
        ))}
      </div>
    </section>
  );
}
