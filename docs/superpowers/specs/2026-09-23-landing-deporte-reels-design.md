# Gasteiz Click — Landing Fever-style, Deporte pro y Reels semanales (diseño)

Fecha: 2026-09-23 (rev. 2)
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
   vistazo todas las categorías y eventos, con una estética tipo
   **feverup.com** (oscura, vibrante, gradientes, titulares redondeados).
2. Un apartado de deportes con los **próximos partidos de Baskonia, Alavés y
   Araski**.
3. **Un reel semanal** con Higgsfield (mascota ilustrada estilo "diario de un
   cronista" por Vitoria) que el usuario **revisa y aprueba en dos pasos:
   guion y resultado final**, dentro del **plan gratuito** (sin gasto de
   pago), para publicar manualmente en Instagram.

### Decisiones de alcance acordadas (del brainstorming)

- Datos de partidos: **híbrido** — scraping del CMS oficial del grupo
  Baskonia-Alavés (Strapi REST público, verificado funcionando) para Baskonia
  y Alavés + **JSON manual** `data/partidos/araski.json` para Kutxabank Araski
  (LF Endesa no publica un feed scrapeable).
- Ubicación de partidos: **home + /deporte**.
- Dirección de la home: **Fever-inspired en TODA la home** (reemplaza la
  anterior dirección "Editorial premium"): oscuro, gradientes vivos, titulares
  grandes, tarjetas redondeadas, etiquetas de color, CTAs con energía.
- Reels: un **solo reel a la vez**, con cron semanal que genera **solo el
  guion** (gratis); el usuario revisa el guion, lo aprueba, se renderiza en el
  **plan gratuito**, y el usuario revisa **también el resultado final** antes
  de que quede listo para publicar manualmente.
- Coste: **nada de pago** (sin créditos de pago; render solo tras aprobación
  y si quedan créditos gratuitos).
- Personaje: **mascota cronista** ilustrada (no fotorrealista), recurrente,
  que recorre lugares reales de Vitoria-Gasteiz. El estilo visual del reel se
  define **usando efectos/dirección de un skill de diseño instalado**.
- Herramienta: **MCP de Higgsfield** configurado en opencode (uso en
  desarrollo) + **cliente REST propio** (`lib/higgsfield.ts`) para el servidor.

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
del probe se cachea (15 min).

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
  - Cabecera de sección con el lenguaje Fever (etiqueta de color + título
    grande) + enlace "Ver agenda deportiva → /deporte".
  - 3 tarjetas (una por club), cada una con: nombre del club y competición,
    fecha/día, `local vs visitante` con escudos, estadio, hora. Enlace a la
    web del club (entradas). Estilado en el lenguaje Fever (superficie oscura,
    borde redondeado, etiqueta de competición en color).
  - Envuelto en `<Suspense>` con skeleton; empty state discreto si no hay
    partidos.
  - Se coloca justo después del hub de categorías (ver Parte 2).
- **/deporte** → nuevo `app/components/ProMatchesBlock.tsx` (server):
  - 3 próximos partidos por club en fila, con el tint verde de sección
    (`SECTION_TINT.deporte`) reinterpretado en el lenguaje Fever.
  - Se renderiza por encima de `SportPageClient` sin tocar la agenda
    municipal existente.
- Ambas leen `getProximosPartidos()` directamente en el server (`revalidate
  300`), sin API extra.

---

# Parte 2 — Home Fever-inspired

## 2.1 Sistema de diseño objetivo (inspirado en feverup.com)

La home cambia a un lenguaje **oscuro, vibrante y redondo**. Es una evolución
de tokens + piezas visuales; los datos y componentes de lógica se mantienen.

**Tokens de color (se repintan en `app/globals.css`):**
- Fondo base casi negro azulado: `--bg: #0B0E14`, `--bg-muted: #141821`,
  `--surface: #1B2130`.
- Texto: `--fg: #F6F5F3`, `--fg-muted: #A6B0BD`, `--fg-subtle: #7C8794`.
- Bordes: `--border: #2A3345`, `--border-hover: #3B4458`.
- Paleta de **gradientes vivos** por sección/categoría:
  - `--hot` (rosa/rojo) `#FF4D7D`, `--violet` `#7B4DFF`, `--teal` `#00D2C8`,
    `--amber` `#FFB300`, `--lime` (deporte) `#9BFF57`.
  - Las categorías existentes (Música, Teatro, Cine, Exposiciones, Infantil,
    Deporte, Danza, Festival, Gastronomía, Senderismo…) se reasignan a esta
    paleta más saturada, con su "tag" en color de relleno (estilo pill).
- Modo claro: sigue existiendo (toggle) como variante "bright" sobre la misma
  marca (superficies claras pero con las mismas etiquetas de color). El modo
  **oscuro pasa a ser el por defecto**.

**Tipografía (en `app/layout.tsx`, `next/font`):**
- Display: **Archivo** (variable, pesos 500–900, tracking apretado,
  tamaños grandes, en minúscula o mayúscula según bloque). Sustituye a
  Fraunces en los titulares de la home.
- Body: **Archivo** regular (o familia renovada cercana) en lugar de
  Montserrat.
- Mono: se mantiene **JetBrains Mono** para las líneas meta (fechas, horas,
  ratings).
- Los kickers serif itálicos actuales se convierten en **etiquetas pill** de
  color con texto en mono/mayúscula.

**Piezas visuales (en `globals.css` + componentes):**
- Tarjetas `rounded-2xl/3xl`, superficies oscuras, borde sutil, **wash de
  gradiente vivo** en el borde superior o en esquinas, `hover` con lift y
  glow del color de la categoría.
- Chips/etiquetas de categoría con fondo sólido de color (fill) y texto
  oscuro, en lugar de los chips outline actuales.
- Fondos de sección con `hero-grid` sustituido por **auroras/washes** de
  gradientes difuminados (blur) muy sutiles.
- El copy cambia a tono Fever: títulos de sección grandes, mínimos y con
  energía (p. ej. "Hoy en Gasteiz", "Próximos 7 días", "Top 10",
  "¿Qué te apetece?" se mantienen pero con la nueva tipografía).
- Barra "de un vistazo" con chips de color y contadores.

**Alcance del repintado:** se repinta la estética global (tokens + shared
components como `EventCard` para que la home sea coherente). Los deep-restyle
de páginas interiores (culture, movies, etc.) NO forman parte de este trabajo:
el cambio de tokens ya les da continuidad mínima; su pulido fino queda como
trabajo futuro. Esto evita ampliar el alcance indefinidamente.

## 2.2 Estructura objetivo de la home

```
1. Hero               → etiqueta-pille "N planes esta semana" + H1 Archivo grande + HeroSearch + tarjeta "Plan destacado" (desktop)
2. Franja "de un vistazo" → fecha viva + contadores (hoy / este finde / partidos) + chips de categorías   [NUEVA]
3. Hub de categorías   → tarjetas Fever (imagen + count + tag de color)            [REPINTADO]
4. PartidosSection     → 3 clubes, 1 partido c/u + "Ver agenda deportiva"          [NUEVA]
5. Hoy en Gasteiz      → rail de chips (se repinta)
6. Próximos 7 días     → tabs + grid (se repinta)
7. Moods               → pills de estado de ánimo (se repintan)
8. Top 10              → rail numerado (se repinta)
9. Carruseles          → se repintan (cabecera unificada con `SectionHead`)
10. Cifras             → datos reales + frescura + métrica de deporte             [REPINTADO]
11. Próximos eventos   → grid largo (se repinta)
12. Newsletter         → panel de dos tonos con gradiente (se repinta)
```

## 2.3 Cambios concretos

1. **Hero (`HeroSection`)** — H1 grande en Archivo (mayúscula apretada tipo
   Fever), fondo con wash de gradiente, se mantiene `HeroSearch`. Se añade
   (desktop) una tarjeta **"Plan destacado de hoy/mañana"** usando el scoring
   de `lib/popularity.ts` (imagen, categoría en su color, enlace).
2. **Franja "de un vistazo" (nueva, `AtAGlanceStrip`)** — debajo del hero:
   - Fecha viva servidor ("miércoles 23 sep").
   - Contadores reales: "X planes hoy", "Y este finde", "Z partidos de los
     nuestros" (de `getProximosPartidos(1)`).
   - Chips-enlace a cada categoría, en sus colores Fever.
3. **Hub de categorías (`SectionsHub`)** — repintado a tarjetas Fever
   (imagen como cabecera donde exista, tag de color, count vivos de la
   semana desde datos). Retícula 2/3/4 se mantiene.
4. **`SectionHead` común (nuevo)** — cabecera de sección Fever (tag pill +
   título Archivo + enlace "ver todo"); se aplica a las cabeceras de todas
   las secciones para un ritmo uniforme.
5. **Cifras (`SocialProof` → "Gasteiz Click en cifras")** — datos reales
   (planes esta semana, fuentes activas), `FreshnessBadge` y nueva métrica
   de deporte ("3 clubes · 2 deportes · 1 ciudad").
6. **Newsletter** — panel con gradiente y cabecera grande; lógica intacta.

## 2.4 Conservación (anti-regresión)

- Se mantienen la lógica y el ciclo de vida de `EventCard`, `NextDaysSection`,
  `MoodFilter`, `TopEventsSection` y sus datos; solo cambia la piel
  (tokens/piezas). `EventCard` se repinta globalmente porque la home la usa a
  fondo (y las otras páginas heredan coherencia).
- Los tests e2e de home existentes (`e2e/homepage.spec.ts`: título, banner,
  nav, enlaces `/evento/`, /conciertos) deben seguir pasando. Se añaden
  asserts nuevos para la franja, partidos y cifras.
- `revalidate 300` se mantiene. El toggle oscuro/claro sigue funcionando.

---

# Parte 3 — Reel semanal con Higgsfield

## 3.1 Flujo con doble aprobación del usuario (requisito)

```
Cron lunes 08:00 (Europe/Madrid) — SOLO GUION (sin render):
  1. Recolectar eventos de la semana (Música, Deporte/Carreras, Cine,
     Infantil, Gastronomía, Fiestas) → top N por popularity.
  2. LLM escribe el guion-diario del cronista (bloques) → estado=DRAFT.
  3. Push de aviso "Guion listo para revisar".  (0 créditos de vídeo)

Revisión 1 / aprobación del guion (en /reels):
  - El usuario lee la historia y el guion (texto plano), pide regenerar
    (gasta solo LLM) o lo aprueba.

RENDER (solo tras aprobación y SOLO si hay créditos gratuitos):
  4. seed_audio ×N (voz fija) → gemini_omni ×N (clips 10 s, 9:16,
     style key de la mascota) → explainer_video 720×1280 (+subtítulos
     patrick opcionales, si caben en plan gratis).
  5. MP4 → .data/reels/reel-YYYY-MM-DD/reel.mp4 + metadata.json,
     estado=READY → push de aviso.  (fallo si no hay créditos gratis →
     estado=ERR_CREDITOS y reintento manual)

Revisión 2 / aprobación del RESULTADO FINAL (en /reels):
  - El usuario reproduce el reel, descarga o "Copiar caption IG", y lo
    acepta (estado=LISTO) o lo rechaza (re-render o regenerar guion).

Publicación manual (fuera del alcance de la app):
  - El usuario publica en Instagram; botón "Marcar publicado".
```

- **Un solo reel a la vez:** la app mantiene un único slot activo por semana;
  generar otro reel sobrescribe/archiva el anterior (se conservan los últimos
  N en disco para no perder captions/histórico).
- **Nada de pago:** antes de renderizar se comprueba saldo/créditos gratis
  disponibles; los modelos elegidos son los de coste mínimo (720p, 10 s,
  subtítulos solo si entran). Si se agota la cuota gratuita, el reel queda en
  estado `ERR_CREDITOS` y se reintenta manualmente desde `/reels`.

## 3.2 Acceso a Higgsfield

- **Cron (servidor):** env vars `HIGGSFIELD_API_KEY` y
  `HIGGSFIELD_API_SECRET` (cloud.higgsfield.ai/api-keys). **Nuevo
  `lib/higgsfield.ts`**, cliente REST con `axios` contra el mismo backend que
  el CLI oficial. Modelos: `seed_audio`, `gemini_omni`, `explainer_video`,
  `nano_banana_2` (style key), listado de voces, y endpoints de saldo.
- **Tarea explícita de fase 1:** validar el contrato HTTP real (la API interna
  no está 100 % documentada en público). Probe con curl desde desarrollo y
  cliente fijado contra el resultado real, cubierto con tests de mapeo.
  Fallback: instalar el CLI dentro del contenedor y delegar auth al
  documento de despliegue.
- **MCP en opencode (desarrollo):** añadir a `~/.config/opencode/opencode.json`
  el servidor oficial `https://mcp.higgsfield.ai/mcp` (`type: "remote"` +
  OAuth una vez). Fallback: local `npx -y higgsfield-mcp` con la API key.

## 3.3 Guion (LLM)

**Nuevo `lib/llm.ts`** — provider abierto por env (`LLM_API_KEY` +
`LLM_MODEL`, API compatible con chat completions estilo OpenAI) con
**fallback a plantilla** si no hay clave.

- Prompt con eventos destacados de la semana (lunes→domingo) y lugares reales
  de Vitoria-Gasteiz (Virgen Blanca, La Florida, Mendizorrotza, Buesa Arena…).
- Salida (JSON validado): `N` líneas de narración (1 por bloque, 20–24
  palabras, < 9.5 s; hook → despliegue → cierre saludando) + `N` prompts
  visuales en inglés con el estilo ilustrado no fotorrealista fijo.
- **Estilo visual del reel:** se define **con un skill de diseño instalado**
  (durante la implementación se cargará `high-end-visual-design` y
  `imagegen-frontend-web`, y de ahí se traduce el style-key de la mascota:
  paleta, textura, forma, luz). El style-key se genera **una sola vez**
  (`nano_banana_2`) y se reutiliza en todos los clips. Voz fija elegida una
  vez. Ambos se guardan en `data/reels/style-key.json`.

## 3.4 Componentes nuevos

- `lib/higgsfield.ts` — cliente REST (fases anteriores) + `voices list` +
  saldo + polling de jobs (espera a completion) con errores tipados.
- `lib/llm.ts` — generación y parseo estricto del guion + plantilla de reserva.
- `lib/reel.ts` — orquestación: `createReelDraft(week)`, `renderReel(draftId)`,
  `approveReel(listo)`, estado en `.data/reels/state.json`, lock
  anti-concurrencia, conservar últimos N.
- `lib/reelScheduler.ts` — integrado en el scheduler existente
  (`instrumentation.ts` + `lib/scheduler.ts`): patrón del push digest (`tick`
  10 min, `shouldGenerateWeeklyReel()` / `markReelDraftGenerated()` con semana
  en `state.json`). Gates env: `ENABLE_REEL_SCHEDULER=1`,
  `REEL_GENERATION_HOUR` (def. 8), `REEL_BLOCKS` (def. 5 → 50 s),
  `REEL_SUBTITLES` (def. `patrick`). El cron **nunca renderiza**.
- `app/reels/page.tsx` + `app/components/ReelsPageClient.tsx` — un solo slot:
  si no hay guion de la semana → botón "Generar guion"; estados
  DRAFT/READY/LISTO/PUBLICADO/ERR_CREDITOS con acciones (revisar guion,
  regenerar, renderizar, reproducir, descargar, copiar caption, aprobar,
  rechazar, marcar publicado).
- `app/reels/[id]/route.ts` — streaming de `reel.mp4` desde `.data/reels/`
  para la descarga.
- Caption con hashtags `#VitoriaGasteiz #Gasteiz #AgendaGasteiz`.

## 3.5 Coste y notas

- Solo el LLM corre de forma desatendida (gratis con provider propio). Todo
  render consume créditos, por eso **solo tras la aprobación del guion** y
  **solo si quedan créditos gratuitos**.
- Validación previa en desarrollo: 1 reel de prueba de 3 bloques (30 s) para
  confirmar contrato API, voz, mascota y saldo, antes de activar el cron.
- Sin Meta Business en esta fase (publicación manual); `lib/instagram.ts`
  (Graph API) queda fuera para una fase futura.

---

# Testing

- **Jest (unidad):**
  - `clubCms`: mapeo del payload Strapi → `Partido`, URLs absolutas de
    escudos, auto-curación de temporada, fallback de fecha/hora.
  - `partidos`: `getProximosPartidos` fusiona CMS + Araski, filtrado de
    próximos, orden, límite por equipo y fallbacks.
  - `llm`: parseo/validación del guion → bloques, plantilla de reserva.
  - `higgsfield`: mapeo de respuestas con mocks, polling, saldo y errores.
  - `reel`: ciclo DRAFT→READY→LISTO→PUBLICADO, idempotencia semanal, lock
    anti-concurrencia, comportamiento `ERR_CREDITOS`.
- **Playwright (e2e):**
  - Home: franja "de un vistazo", `PartidosSection`, cifras, repintado
    presente (selectores de siempre siguen funcionando).
  - `/deporte`: bloque de partidos pro sobre la agenda municipal.
  - `/reels`: slot único (vacío → generar guion → DRAFT → acciones por
    estado), descarga.
  - Se mantienen verdes los e2e existentes (`homepage.spec.ts`,
    `search.spec.ts`, `descubre.spec.ts`, `api.spec.ts`).
- **Validación manual previa:** 1 reel de prueba de 3 bloques antes de activar
  `ENABLE_REEL_SCHEDULER`.

# Orden de implementación

1. Parte 1 (deporte pro) — independiente, entrega valor rápido.
2. Parte 2 (home Fever) — repintado de tokens + piezas sobre la estructura
   actual.
3. Parte 3 (reel) — probe de contrato Higgsfield → LLM → pipeline → scheduler
   → UI `/reels` → validación 3 bloques → activación.

# Riesgos y mitigaciones

| Riesgo | Mitigación |
|---|---|
| Contrato HTTP de Higgsfield no documentado al 100 % | Probe real en fase 1; fallback a CLI dentro del contenedor |
| Créditos gratuitos agotados | Estado `ERR_CREDITOS` + reintento manual; el cron solo genera guion (gratis) |
| Escritura a `.data/` en despliegue (Dokploy) no persistente | Ya se usa para `push.db`; confirmar volumen montado antes de activar el cron |
| CMS cambia season id / nombres de equipo | Auto-curación de temporada + logs Axiom + empty states elegantes |
| Mascota sin consistencia semana a semana | Style key fijado una sola vez y reutilizado |
| LLM no disponible en el servidor | Fallback de plantilla; el cron reintenta |
| Dobles renders o carriles de créditos | Lock por reel + estado idempotente + render solo tras aprobación |
| Repintado global rompe páginas interiores | Tokens compartidos + smoke e2e de rutas principales; pulido fino de interiores queda como trabajo futuro |