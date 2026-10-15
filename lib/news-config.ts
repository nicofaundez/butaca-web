// Parámetros editoriales configurables por variables de entorno.
// Los límites protegen el gasto en xAI aunque se configure un valor extremo.
export function clampInt(value: string | undefined, fallback: number, min: number, max: number) {
  const parsed = Number.parseInt(value ?? "", 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

export const MAX_PER_CATEGORY = 5;
export const MAX_VISIBLE_NEWS = 300;

export function newsConfig(env: Record<string, string | undefined> = process.env) {
  return {
    // Noticias solicitadas a Grok por cada categoría (4 categorías por actualización).
    perCategory: clampInt(env.NEWS_PER_CATEGORY, 2, 1, MAX_PER_CATEGORY),
    // Ventana para descartar temas repetidos aunque vengan de otro medio.
    dedupDays: clampInt(env.DEDUP_DAYS, 7, 1, 30),
    // Espera mínima entre actualizaciones (botón o cron). La función SQL acepta 30 s a 60 min.
    cooldownSeconds: clampInt(env.REFRESH_COOLDOWN_MINUTES, 5, 1, 60) * 60,
  };
}
