# La Butaca del Abuelo

Next.js 16 (App Router), TypeScript, Supabase y búsqueda con Grok. Paleta amarilla, negra y blanca; logo original suministrado por el equipo. No se modificaron los archivos de `sources/`.

## Iniciar

Requiere Node.js 22+ y pnpm. Ejecutar desde esta carpeta:

```sh
pnpm install
cp .env.example .env.local
```

Completar `.env.local`:

- `TEAM_USER`: usuario compartido (por defecto `equipo`).
- `TEAM_PASSWORD`: contraseña estática del equipo. Sin ella, toda la web queda bloqueada. No usar prefijo NEXT_PUBLIC.
- `SUPABASE_URL` y `SUPABASE_SECRET_KEY`: conexión del servidor. La clave nunca se envía al navegador.
- `XAI_API_KEY`: clave de xAI, solo necesaria para buscar noticias.
- `XAI_MODEL`: `grok-4.7`, compatible con búsquedas y JSON estructurado; debe estar habilitado en tu cuenta.
- `CRON_SECRET`: secreto independiente para el cron. Generar con `openssl rand -hex 32`.
- `DEMO_MODE`: `true` muestra tarjetas ficticias sin consultar Supabase y desactiva las escrituras del cron; `false` muestra noticias reales.

Si no existe la tabla, ejecutar `supabase/schema.sql` en el SQL Editor de Supabase. Si ya ejecutaste el esquema anterior, no repetirlo.

```sh
pnpm dev
```

Abrir la URL local impresa por Next.js (normalmente http://localhost:3000). El navegador solicita usuario y contraseña mediante HTTP Basic Auth. No se necesita una página de login. Las credenciales permanecen en la sesión del navegador; no hay sesiones individuales ni un botón de cierre de sesión fiable con Basic Auth. Usar HTTPS en producción.

## Protección

En Next.js 16, `proxy.ts` es el nombre actual del middleware. Protege todas las rutas, incluidos recursos y solicitudes RSC. La página comprueba también las credenciales antes de consultar la base de datos. No hay caché pública de noticias. `/api/cron` requiere `Bearer CRON_SECRET`, nunca la contraseña web. El handler repite esa comprobación.

## Noticias y fuentes

`app/page.tsx` consulta las últimas 60 filas; los filtros y el buscador operan sobre ese conjunto. Cada tarjeta muestra título, resumen, categoría, fecha de creación y enlace original. Las migraciones agregan imágenes y reservas; consulta la sección de continuación para el comportamiento actual.

`lib/sources.ts` conserva las 51 fuentes entregadas: 16 medios web y 35 nombres sociales pendientes de vincular a sus URLs exactas. Se interpreta Entertainneny Weekly como Entertainment Weekly e Igndotcom como IGN. Los demás nombres se conservan tal cual. La pestaña Fuentes muestra ambos grupos. Algunos medios pueden requerir suscripción o bloquear búsquedas; configurar el dominio no garantiza acceso al texto.

Para activar una cuenta de X, verificar su URL y añadir `{ name, platform: "x", handle, url }` a `confirmedSocialSources`, quitando su nombre de pendientes. Instagram no está conectado: X Search no lee Instagram y las URLs `/p/` no identifican al autor. Hace falta verificar los enlaces y una vía de acceso compatible antes de ingerir esas publicaciones. No se inventan perfiles a partir de nombres.

## Grok y cron

`buscarYGuardarNoticias()` en `lib/grok.ts` usa `POST https://api.x.ai/v1/responses` con `web_search` y `x_search`. Solicita noticias recientes por categoría en español, con JSON Schema estricto y fuentes prioritarias. Valida contenido, categorías y dominios antes de insertar. Rechaza respuestas incompletas y URLs repetidas. `upsert` ignora duplicados por `enlace`; puede insertar menos de tres si ya existían. Compara títulos y temas para reducir duplicados entre URLs; no acredita por sí solo la veracidad de una noticia. La selección de tendencias es editorial, no un ranking oficial de X.

No reintenta automáticamente búsquedas facturables. Un fallo del cron devuelve 500; Vercel no garantiza reintentos. Se conservan las noticias existentes ante errores. Revisar las noticias antes de republicarlas. Las herramientas de búsqueda tienen costes además de los tokens.

## Desplegar en Vercel

Importar esta carpeta como raíz del proyecto Next.js y configurar las variables en Production. Establecer `DEMO_MODE=false` y una contraseña distinta de la usada para previsualización. `vercel.json` programa el cron diariamente a las 12:00 UTC. La duración máxima declarada es 150 segundos y debe ser compatible con el plan. El cron solo se programa en producción.

## Comprobaciones

```sh
pnpm test
pnpm typecheck
pnpm build
```

Las pruebas unitarias cubren autenticación, aislamiento del cron, dominios maliciosos y validación del esquema. Las llamadas reales requieren las credenciales del equipo.

## Referencias

- https://nextjs.org/docs/app/getting-started/proxy
- https://docs.x.ai/developers/model-capabilities/text/structured-outputs
- https://docs.x.ai/developers/tools/x-search
- https://docs.x.ai/developers/tools/web-search
- https://supabase.com/docs/reference/javascript/upsert

## Continuación: trabajo en equipo y búsqueda automática

Estado verificado el 14 de octubre de 2026. La aplicación local aún usa demostración. El esquema y las dos migraciones ya se aplicaron al proyecto remoto BUTACA (`mjmxefwqmgaajapybfeo`). No se han ejecutado búsquedas facturables con xAI.

### Preparar la base de datos

Para una instalación nueva, ejecutar `supabase/schema.sql` y después, en este orden:

1. `supabase/migrations/20261013033710_team_claims_refresh_images.sql`
2. `supabase/migrations/20261013041000_news_topic_key.sql`

Si la tabla ya existe, ejecutar solo las migraciones pendientes. No volver a ejecutar el esquema inicial. Las nuevas funciones son SECURITY INVOKER y solo `service_role` puede ejecutarlas. La tabla de coordinación tiene RLS y no se expone al navegador.

### Reservas

Cada persona indica su nombre y pulsa **Tomar noticia**. El cambio condicional en Postgres permite un solo ganador por noticia. Solo el navegador que hizo la reserva puede liberarla o marcarla como publicada; no se expone el identificador de propietario en las respuestas. Las noticias publicadas no pueden volver a tomarse. La lista se sincroniza cada 15 segundos mientras la pestaña está visible.

La identidad se conserva en una cookie HttpOnly durante un año; no es una cuenta individual. Borrar cookies o cambiar de navegador pierde la capacidad de gestionar esa reserva. En modo demostración las reservas viven en memoria y se reinician al reiniciar el servidor; en producción se guardan en Supabase.

### Actualización e imágenes

Al entrar o volver a la pestaña se comprueba la actualización; también se comprueba cada minuto mientras esté visible. Un bloqueo y un intervalo compartidos en Supabase evitan búsquedas paralelas. El valor por defecto es **5 minutos**, configurable con `REFRESH_COOLDOWN_MINUTES` (1–60). No es una transmisión continua de noticias ni un ranking oficial de tendencias.

Se conservó la búsqueda de Claude por las cuatro categorías: `NEWS_PER_CATEGORY=2` solicita hasta dos resultados por categoría, con hasta cuatro llamadas a xAI por ciclo. Los fallos parciales se indican en la interfaz. `DEDUP_DAYS=7` define la ventana de comparación de temas. La comparación de títulos y temas es heurística: reduce duplicados entre medios pero puede descartar historias distintas o dejar pasar alguna repetida.

Se intenta obtener `og:image` o `twitter:image` de los nuevos artículos. Las imágenes no se inventan: si la fuente no permite consultar sus metadatos o la imagen falla, la tarjeta muestra el texto. No se descargan automáticamente imágenes de noticias históricas. La lectura empieza en 60 noticias y permite cargar hasta 300; los filtros operan sobre las cargadas.

La duración declarada de las rutas de actualización es 150 segundos; comprobar compatibilidad con el plan de Vercel. El cron comparte el mismo intervalo de protección que las visitas y el botón.

### Reels y frases

La pestaña **Reels y frases** busca enlaces públicos mediante xAI cuando sus credenciales están configuradas. Instagram no ofrece cobertura completa a este buscador. Los resultados son enlaces, no descargas de vídeos.

La búsqueda literal de frases funciona localmente sobre texto pegado o archivos TXT/SRT/VTT, sin enviar las transcripciones a xAI. Muestra timestamps únicamente cuando existen en los subtítulos. La extracción y transcripción automática del audio de un vídeo sigue sin estar conectada.

### Verificación

Se ejecutaron diez pruebas: SQL en Postgres embebido, permisos, reservas, recuperación del bloqueo, autenticación, dominios, deduplicación, configuración y transcripciones. Esto no sustituye la prueba posterior contra el proyecto real de Supabase.

### Supabase remoto configurado

Por indicación del usuario, se preparó el proyecto BUTACA ya creado, con URL `https://mjmxefwqmgaajapybfeo.supabase.co`. Migraciones remotas aplicadas: `create_noticias_cine`, `team_claims_refresh_images`, `news_topic_key`. No volver a ejecutar estos scripts en ese proyecto.

Se verificaron con el rol `service_role` las reservas exclusivas, la liberación por propietario, la publicación y el bloqueo de actualizaciones. Las pruebas se revirtieron mediante ROLLBACK, sin dejar noticias de prueba.

Los asesores solo indicaron avisos informativos: [RLS sin políticas](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy), intencional porque el acceso se hace desde el servidor con `service_role`, y [índices aún sin uso](https://supabase.com/docs/guides/database/database-linter?lint=0005_unused_index), esperable en una base nueva.

La URL está configurada en `.env.local`. Falta añadir `SUPABASE_SECRET_KEY` desde el panel de Supabase; el conector solo permite obtener claves públicas. Mantener esa clave exclusivamente en el servidor. La demostración permanece activa hasta completar la conexión. Las búsquedas pagadas siguen pendientes de activación y de configurar `XAI_API_KEY`.
