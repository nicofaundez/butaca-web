"use client";
import { useState } from "react";
import { findQuotes } from "@/lib/transcripts";
type Result = { titulo: string; descripcion: string; enlace: string; tipo: string };
export function MediaSearch() {
  const [q, setQ] = useState(""); const [kind, setKind] = useState("Reel");
  const [results, setResults] = useState<Result[]>([]); const [busy, setBusy] = useState(false); const [message, setMessage] = useState("");
  const [transcript, setTranscript] = useState(""); const [phrase, setPhrase] = useState("");
  const matches = findQuotes(transcript, phrase);
  async function search(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setMessage(""); setResults([]);
    try { const response = await fetch("/api/media/search", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ q, tipo: kind }) }); const body = await response.json(); if (!response.ok) throw new Error(body.error); setResults(body.resultados); setMessage(body.notice ?? (body.resultados.length ? "Revisa la publicación original antes de reutilizarla." : "No se encontraron enlaces públicos verificables.")); }
    catch (error) { setMessage(error instanceof Error ? error.message : "No se pudo buscar"); }
    finally { setBusy(false); }
  }
  return <section className="media-section"><p className="eyebrow">IDEAS PARA LA PRÓXIMA PUBLICACIÓN</p><h2>Reels y entrevistas</h2>
    <p className="intro">Encuentra publicaciones públicas por actor, película o tema. La cobertura de Instagram depende de lo que esté disponible públicamente.</p>
    <form className="media-form" onSubmit={search}><label>Tema o persona<input minLength={3} maxLength={250} required value={q} onChange={(e) => setQ(e.target.value)} placeholder="Pedro Pascal hablando de cine" /></label><label>Formato<select value={kind} onChange={(e) => setKind(e.target.value)}><option>Reel</option><option>Entrevista</option></select></label><button disabled={busy}>{busy ? "Buscando…" : "Buscar enlaces"}</button></form>
    <p role="status" className="intro">{message}</p><div className="source-grid">{results.map((result) => <a href={result.enlace} key={result.enlace} target="_blank" rel="noopener noreferrer"><b>{result.titulo}</b><span>{result.descripcion}</span><span>Abrir publicación ↗</span></a>)}</div>
    <div className="transcript-tool"><h3>Encuentra una frase exacta</h3><p className="intro">Pega una transcripción o carga subtítulos TXT, SRT o VTT. La búsqueda se realiza en tu navegador, sin enviar el texto a la IA. Los tiempos aparecen solo si están incluidos en el archivo.</p>
      <label className="file-label">Cargar transcripción<input type="file" accept=".txt,.srt,.vtt" onChange={async (event) => { const file = event.target.files?.[0]; if (!file) return; if (file.size > 2_000_000) { setMessage("La transcripción debe pesar menos de 2 MB."); return; } setTranscript(await file.text()); }} /></label>
      <label>Transcripción<textarea maxLength={2_000_000} rows={7} value={transcript} onChange={(e) => setTranscript(e.target.value)} placeholder="Pega aquí los subtítulos o el texto de la entrevista…" /></label>
      <label>Frase a encontrar<input value={phrase} onChange={(e) => setPhrase(e.target.value)} placeholder="Escribe al menos dos caracteres" /></label>
      {phrase.trim().length >= 2 && <p className="intro" aria-live="polite">{matches.length} coincidencias (máximo 50). La frase debe coincidir con el texto; no se traduce automáticamente.</p>}
      {matches.map((match, index) => <blockquote key={index}>{match.timestamp && <b>{match.timestamp}</b>}<p>{match.text}</p></blockquote>)}
      <p className="intro">La descarga y transcripción automática del audio de vídeos aún no está conectada.</p>
    </div>
  </section>;
}
