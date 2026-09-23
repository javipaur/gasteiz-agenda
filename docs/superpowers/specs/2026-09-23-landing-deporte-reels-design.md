# Gasteiz Click — Landing editorial, Deporte pro y Reels semanales (diseño)

Fecha: 2026-09-23
Estado: aprobado por el usuario en brainstorming — pendiente de revisión de este spec

## Contexto

Gasteiz Click es la agenda cultural de Vitoria-Gasteiz (Next.js 16 App Router,
TypeScript estricto, Tailwind v4 con tokens CSS, identidad editorial
Fraunces/Montserrat/JetBrains, acento de temporada, scrapers + caché en disco,
push, PWA, despliegue en Dokploy). La home actual tiene 14 secciones (hero +
hub de 8 categorías + franja hoy + próximos 7 días + moods + top 10 +
carruseles + cifras + newsletter). `/deporte` cubre agenda municipal, carreras
e inscripciones, pero **no hay datos de los equipos profesionales** y **no hay
contenido promocional en redes**.

El usuario quiere:
1. Una portada **bonita, atractiva, actual y útil** donde se vean de un
   vistazo todas las categorías y eventos.
2. Un apartado de deportes con los **próximos partidos de Baskonia, Alavés y
   Araski**.
3. **Reels automáticos semanales** con Higgsfield (mascota ilustrada que
   cuenta en formato diario los eventos de la semana y lugares de Vitoria)
   para dar visibilidad en Instagram.

### Decisiones de alcance acordadas (del brainstorming)

- Datos de partidos: **híbrido** — scraping del CMS oficial del grupo
  Baskonia-Alavés (Strapi REST público, verificado funcionando) para Baskonia
  y Alavés + **JSON manual** `data/partidos/araski.json` para Kutxabank Araski
  (LF Endesa no publica un feed scrapeable).
- Ubicación de partidos: **home + /deporte**.
- Dirección de la home: **Editorial premium** (mantiene la identidad actual,
  no la rompe; eleva hero, franja "de un vistazo", hub fotográfico, cifras
  reales y cabeceras unificadas).
- Reels: **generación semanal automática** (cron en el servidor) con
  **publicación manual** y **revisión del guion por el usuario antes de
  renderizar y publicar** (requisito añadido al aprobar el plan).
- Personaje: **mascota cronista** ilustrada (no fotorrealista), recurrente,
  que recorre lugares reales de Vitoria-Gasteiz.
- Herramienta: **MCP de Higgsfield** configurado en opencode (úso en
  desarrollo) + **cliente REST propio** (`lib/higgsfield.ts`) para el cron del
  servidor.

---

# Parte 1 — Deporte pro (Baskonia, Alavés, Araski)

## 1.1 Fuente de datos

**Nuevo `lib/sources/clubCms.ts`** siguiendo el patrón de `lib/sources/*` y con
caché `getCachedOrFetch` de `lib/cache.ts` (TTL 5 min).

Endpoints verificados hoy (sin autenticación):

| Equipo | Filtro team | Season id (2026/27) | Competiciones vistas |
|---|---|---|---|
| Baskonia | `Kosner Baskonia` | `25` | Liga Endesa, Euroleague, Supercopa |
| Alavés | `Deportivo Alavés` | `19` | LaLiga EA Sports, Copa del Rey |

Configuración por club:

```ts
const CLUB_CONFIG = {
  baskonia: { site: "baskonia", team: "Kosner Baskonia", seasonId: 25 },
  alaves:   { site: "alaves",   team: "Deportivo Alavés", seasonId: 19 },
};
```

Request:

```
GET https://cms.deportivoalaves.com/api/games-items
  populate[homeTeam][populate]=shield
  populate[awayTeam][populate]=shield
  populate[competition][populate]=logo
  populate[seasons]=*&populate[link]=*&populate[buttons]=*
  filters[seasons][id][$eq]=<seasonId>
  filters[$or][0][homeTeam][name][$eq]=<team>
  filters[$or][1][awayTeam][name][$eq]=<team>
  sort[0]=gameDate:asc
  pagination[pageSize]=100
  locale=es
```

**Auto-curación de temporada:** si el CMS cambia `season.id`, una consulta
probe (`sort gameDate:desc`, `pageSize=1`, solo filtro de equipo) devuelve el
`seasons.id` del último partido; se usa ese id para el re-filtro. El resultado
del probe se cachea (15 min) para no martillear el CMS.

**Mapeo a `Partido`:**

```ts
type Escudo = { nombre: string; url?: string };

type Partido = {
  id: string;                  // `${equipo}-${gameId}`
  equipo: "baskonia" | "alaves" | "araski";
  club: string;                // "Kosner Baskonia" | "Deportivo Alavés" | "Kutxabank Araski"
  competicion: string;         // competition.name; fallback stage
  fecha: string | null;        // ISO combinando gameDate+gameTime (null si TBD)
  local: Escudo;
  visitante: Escudo;
  estadio: string | null;      // stadiumName
  marcador: { local: number; visitante: number } | null; // solo partidos jugados
  link: string | null;         // link.url o buttons[0]
  fuente: "cms" | "manual";
};
```

- Los `shield.url` y `logo` del CMS vienen relativos (`/uploads/...`) → se
  completan con el origen `https://cms.deportivoalaves.com`.
- Si falta `gameTime` (horario "Por confirmar"), `fecha` queda null y el UI
  muestra el día + "hora por confirmar".

## 1.2 Capa de negocio

**Nuevo `lib/partidos.ts`:**

- `getPartidosCMS(): Promise<Partido[]>` — `Promise.all` de Baskonia + Alavés
  a través de `getCachedOrFetch("partidos-cms", 5 min, fetcher)`.
- `getPartidosAraski(): Promise<Partido[]>` — lee `data/partidos/araski.json`
  (disco + caché corta) y normaliza a `Partido[]`.
- `getProximosPartidos(nPorEquipo = 1): Promise<Partido[]>` — fusiona ambas
  fuentes, filtra `fecha >= ahora` (omite sin fecha), ordena asc por fecha y
  toma los `nPorEquipo` primeros de cada equipo. Las jugadas (marcador !=
  null) quedan disponibles para el futuro, fuera del MVP.
- Fallbacks: si el CMS falla, devuelve lo cacheado; si no hay nada, devuelve
  solo Araski o `[]`. El UI muestra empty state elegante.

**Nuevo `data/partidos/araski.json`** (curado a mano por el usuario):

```json
{
  "equipo": "Kutxabank Araski",
  "actualizado": "2026-09-23",
  "partidos": [
    {
      "fecha": "2026-09-25T19:00:00+02:00",
      "competicion": "Liga Femenina Endesa",
      "local": { "nombre": "Kutxabank Araski", "escudo": "/img/partidos/araski.png" },
      "visitante": { "nombre": "IDK Euskotren", "escudo": null },
      "estadio": "Mendizorrotza",
      "link": "https://kutxabankaraski.com"
    }
  ]
}
```

## 1.3 UI

- **Home** → nuevo `app/components/PartidosSection.tsx` (server):
  - Kicker con acento de temporada ("Partidos de los nuestros") + cabecera
    `SectionHead` + enlace "Ver agenda deportiva → /deporte".
  - 3 tarjetas (una por club), cada una con: nombre del club y competición,
    fecha/día, `local vs visitante` con escudos, estadio, hora. Enlace a la
    web del club (entradas).
  - Envuelto en `<Suspense>` con skeleton; empty state discreto si no hay
    partidos.
  - Se coloca justo después del hub de categorías (ver Parte 2).
- **/deporte** → nuevo `app/components/ProMatchesBlock.tsx` (server):
  - 3 próximos partidos por club en fila, con el tint verde de la sección
    (`SECTION_TINT.deporte`).
  - Se renderiza por encima de `SportPageClient` sin tocar la agenda
    municipal existente.
- Ambas leen `getProximosPartidos()` directamente en el server (`revalidate
  300`), sin API extra.

---

# Parte 2 — Home editorial premium

## 2.1 Estructura objetivo

```
1. Hero (upgraded)          → kicker + H1 + HeroSearch + tarjeta "Plan destacado de hoy"
2. Franja "de un vistazo"   → fecha viva + contadores + chips de categorías   [NUEVA]
3. Hub de categorías        → tarjetas fotográficas con counts vivos           [UPGRADE]
4. PartidosSection          → 3 clubes, 1 partido c/u                            [NUEVA]
5. Hoy en Gasteiz           → se mantiene
6. Próximos 7 días          → se mantiene
7. Moods                    → se mantiene
8. Top 10                   → se mantiene
9. Carruseles               → se mantienen (ritmo de cabecera unificado)
10. Cifras                  → datos reales + frescura + métrica de deporte     [UPGRADE]
11. Próximos eventos        → se mantiene
12. Newsletter              → restyle de panel
```

## 2.2 Cambios concretos

1. **Hero (`HeroSection`)** — se conserva el hero actual y se añade (solo
   desktop, oculto en móvil) una tarjeta editorial **"Plan destacado de hoy"**:
   el mejor evento de hoy/mañana según `lib/popularity.ts` (ya puntúa por
   fuente, categoría, imagen, precio y recencia). Imagen, categoría con su
   color, enlace al evento.
2. **Franja "de un vistazo" (nueva, `AtAGlanceStrip`)** — debajo del hero:
   - Fecha viva servidor ("miércoles 23 sep").
   - Contadores reales: "X planes hoy", "Y este finde", "Z partidos de los
     nuestros" (de `getProximosPartidos(1)`).
   - Chips-enlace a cada categoría del hub.
3. **Hub de categorías (`SectionsHub`)** — upgrade de tarjetas: repite el
   patrón fotográfico que ya usa Gastronomía donde haya imagen de cabecera;
   counts vivos calculados desde los datos (semana) en vez de estáticos;
   micro-tags. Retícula 2/3/4 se mantiene.
4. **`SectionHead` común (nuevo)** — componente del patrón
   kicker (eyebrow serif itálica + título + enlace "ver todo"); se aplica a
   las cabeceras de todas las secciones para un ritmo uniforme.
5. **Cifras (`SocialProof` → "Gasteiz Click en cifras")** — datos reales:
   planes esta semana, fuentes activas, `FreshnessBadge` (Actualizado hace
   Ns, ya existente) y nueva métrica de deporte ("3 clubes · 2 deportes ·
   1 ciudad").
6. **Newsletter** — restyle a panel de dos tonos con cabecera serif; la
   lógica (email + honeypot) no cambia.

## 2.3 Conservación (anti-regresión)

- Se mantienen intactos `EventCard`, `NextDaysSection`, `MoodFilter`,
  `TopEventsSection` y su lógica de datos.
- Los tests e2e de home existentes (`e2e/homepage.spec.ts`: título, banner,
  nav, enlaces `/evento/`, /conciertos) deben seguir pasando. Se añaden
  asserts nuevos para la franja y la sección de partidos.
- `revalidate 300` se mantiene.

---

# Parte 3 — Reels semanales con Higgsfield

## 3.1 Acceso a Higgsfield

- **Cron (servidor):** nuevas env vars `HIGGSFIELD_API_KEY` y
  `HIGGSFIELD_API_SECRET` (cloud.higgsfield.ai/api-keys). **Nuevo
  `lib/higgsfield.ts`**, cliente REST con `axios` contra el mismo backend que
  usa el CLI oficial. Modelos: `seed_audio` (voz), `gemini_omni` (clip 10 s),
  `explainer_video` (ensamblado), `nano_banana_2` (style key), listado de
  voces.
- **Tarea explícita de fase 1:** validar el contrato HTTP real (la API interna
  no está 100% documentada en público). Se hace un *probe* con curl desde
  desarrollo y se fija el cliente contra el resultado real, cubriéndolo con
  tests de mapeo. Si el plan de Higgsfield no permite API key por contrato,
  alternativa: instalar el CLI dentro del contenedor y llamar a sus comandos,
  delegando el auth al documento de despliegue.
- **MCP en opencode (desarrollo):** añadir a
  `~/.config/opencode/opencode.json` el servidor oficial
  `https://mcp.higgsfield.ai/mcp` (`type: "remote"` + OAuth una vez) para
  poder generar/inspeccionar reels en la sesión de desarrollo. Fallback si el
  OAuth remoto falla: local `npx -y higgsfield-mcp` con la misma API key.

## 3.2 Guion (LLM)

**Nuevo `lib/llm.ts`** — provider abierto por env (`LLM_API_KEY` +
`LLM_MODEL`, API compatible con chat completions estilo OpenAI) con
**fallback a una plantilla** basada en texto si no hay clave.

- Entrada del prompt: eventos destacados de la semana (lunes→domingo) de las
  categorías Música, Deporte/Senderismo, Cine, Infantil, Gastronomía, Fiestas
  — top N por `popularity`, con título, fecha, lugar.
- Salida esperada (JSON): `N` líneas de narración-diario del cronista en
  español (una por bloque, 20–24 palabras, < 9.5 s; hook → despliegue de
  eventos con sitios reales: Plaza de la Virgen Blanca, La Florida,
  Mendizorrotza, Buesa Arena… → cierre saludando) + `N` prompts visuales en
  inglés con el estilo ilustrado no fotorrealista recurrente.
- Parseo estricto con validación; si el LLM falla o devuelve algo inválido →
  plantilla.

## 3.3 Flujo con revisión del usuario (requisito nuevo)

```
Cron lunes 08:00 (Europe/Madrid)
  ├─ 1. Recolectar eventos de la semana
  ├─ 2. LLM escribe guion (draft) ─────────────┐
  └─ 3. Guarda draft + estado=DRAFT             │  NO se renderiza todavía
       + push de aviso "Guion listo"           │  (no consume créditos)
                                               ▼
Revisión del usuario en /reels
  ├─ Lee la historia / guion (texto plano)
  ├─ Decide: aprobar / regenerar (gasta 1 guion nuevo)
  ▼
Aprobación  →  RENDER (botón "Renderizar reel")
  ├─ 4. seed_audio  ×N (voz fija)
  ├─ 5. gemini_omni ×N (clips 10 s, 9:16, style key mascota)
  ├─ 6. explainer_video 720×1280 (+ subtítulos patrick opcionales)
  ├─ 7. MP4 → .data/reels/reel-YYYY-MM-DD/reel.mp4 + metadata.json
  └─ 8. estado=READY + push de aviso
▼
Publicación manual por el usuario
  ├─ /reels: reproductor, Descargar, "Copiar caption IG" (hashtags)
  └─ botón "Marcar publicado"
```

- El botón "Renderizar ahora" desde `/reels` permite generar sin esperar al
  cron (p. ej. la primera validación).
- El guion aprobado se guarda; se puede re-renderizar sin regenerar texto.
- Estado por reel: `draft → ready → publicado`. Persistencia en
  `.data/reels/`.

## 3.4 Componentes nuevos

- `lib/higgsfield.ts` — cliente REST (fases anteriores) + `voices list` +
  polling de jobs con `--wait` equivalente (poll hasta completion) y errores
  tipados.
- `lib/llm.ts` — generación y parseo del guion + plantilla de reserva.
- `lib/reel.ts` — orquestación por fases: `createReelDraft(week)`,
  `renderReel(draftId)`, estado y metadatos en `.data/reels/`, lock para
  evitar dobles renders, limpieza conservando los últimos N.
- `lib/reelScheduler.ts` — integrado en el scheduler existente
  (`instrumentation.ts` + `lib/scheduler.ts`): mismo patrón que el push
  digest (`tick` cada 10 min, `shouldGenerateWeeklyReel()` /
  `markReelDraftGenerated()` con semana en `.data/reels/state.json`).
  Gates env: `ENABLE_REEL_SCHEDULER=1`, `REEL_GENERATION_HOUR` (def. 8),
  `REEL_BLOCKS` (def. 6 → 60 s), `REEL_SUBTITLES` (def. `patrick`).
- `lib/scheduler.ts` — ampliar el `tick` para disparar también el draft del
  reel cuando toca (sin bloquear el digest).
- `app/reels/page.tsx` + `app/components/ReelsPageClient.tsx` — lista de
  reels (draft/ready/publicado), reproductor `<video>`, acciones por estado
  (revisar guion, regenerar, renderizar, descargar, copiar caption, marcar
  publicado).
- `app/reels/[id]/route.ts` — streaming de `reel.mp4` desde `.data/reels/`
  para la descarga.
- Formato del caption con hashtags: `#VitoriaGasteiz #Gasteiz #AgendaGasteiz`
  + línea de resumen generada del guion.
- **Style key de la mascota + voz:** se generan y fijan **una sola vez** en
  `data/reels/style-key.json` (`{ styleKeyId, voiceId, voiceType }`); los
  renders semanales reutilizan esos ids (consistencia del personaje y de la
  voz, sin gastar créditos rediseñando cada semana).

## 3.5 Coste y notas

- Estimación por reel de 60 s (6 bloques): N × (audio + clip 10 s) +
  ensamblado + 0.05 créd/bloque si se activan subtítulos. **Solo se renderiza
  tras la aprobación del guion**, así un guion rechazado no consume créditos
  de vídeo.
- La primera validación (3 bloques, 30 s) sirve para confirmar presupuesto,
  voz, estilo y contrato API antes de activar el cron.
- Sin Meta Business en esta fase (publicación manual). La arquitectura deja
  `lib/instagram.ts` (Graph API) fuera de alcance para una fase futura.

---

# Testing

- **Jest (unidad):**
  - `clubCms`: mapeo del payload Strapi → `Partido`, URLs absolutas de
    escudos, auto-curación de temporada, fallback de fecha/hora.
  - `partidos`: `getProximosPartidos` fusiona CMS + Araski, filtrado de
    próximos, orden, límite por equipo y fallbacks.
  - `llm`: parseo/validación del guion → bloques, plantilla de reserva.
  - `higgsfield`: mapeo de respuestas con mocks, polling y errores.
  - `reel`: ciclo de estado draft→ready→publicado, idempotencia semanal,
    lock anti-concurrencia.
- **Playwright (e2e):**
  - Home: franja "de un vistazo" visible con contadores; `PartidosSection`
    presente (o empty state); cifras.
  - `/deporte`: bloque de partidos pro sobre la agenda municipal.
  - `/reels`: lista vacía, generación de draft, actiones por estado y
    descarga.
  - Se mantienen verdes los e2e existentes (`homepage.spec.ts`,
    `search.spec.ts`, `descubre.spec.ts`, `api.spec.ts`).
- **Validación manual previa:** 1 reel de prueba de 3 bloques en desarrollo
  antes de activar `ENABLE_REEL_SCHEDULER`.

# Orden de implementación

1. Parte 1 (deporte pro) — independiente, entrega valor rápido.
2. Parte 2 (home editorial) — encima de la estructura actual.
3. Parte 3 (reels) — tareas: probe de contrato Higgsfield → LLM → pipeline →
   scheduler → UI `/reels` → validación 3 bloques → activación.

# Riesgos y mitigaciones

| Riesgo | Mitigación |
|---|---|
| Contrato HTTP de Higgsfield no documentado al 100 % | Probe real en fase 1; fallback a CLI dentro del contenedor |
| Escritura a `.data/` en despliegue (Dokploy) no persistente | Ya se usa para `push.db`; confirmar volumen montado antes de activar el cron |
| CMS cambia season id / nombres de equipo | Auto-curación de temporada + logs Axiom + empty states elegantes |
| Mascota sin consistencia semana a semana | Style key fijado una sola vez y reutilizado |
| LLM no disponible en el servidor | Fallback de plantilla; el cron reintenta |
| Dobles renders o carriles de créditos | Lock por reel + estado idempotente + render solo tras aprobación |