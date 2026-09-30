# Gasteiz Click — memoria del proyecto

Agenda cultural de Vitoria-Gasteiz. Next.js 16 (App Router, RSC), React 19,
TypeScript estricto, Tailwind v4, ~18 scrapers, PWA, push, newsletter. Se despliega
en Dokploy con `nixpacks.toml` (Node 22).

## Comandos

```bash
npm run dev            # localhost:3000
npm test               # Jest, 32 suites / 220 tests
npm run lint           # ESLint (ver "baseline de lint")
npm run build
npx tsc --noEmit --incremental false   # typecheck real
npm run test:e2e       # Playwright
```

## Estado (2026-09-30)

Rebrand F0/F1 y Fase 1 de la unificación de la agenda, commiteados y
verificados. Baseline verde: `tsc` 0 errores, 220/220 tests, `build` exit 0, 64
problemas de lint (48 `no-explicit-any` preexistentes en scrapers).

## Hecho: la agenda unificada (Fase 1)

Cerrada. El diseño está en
`docs/superpowers/specs/2026-09-30-agenda-unificada-design.md` y el plan por
tareas en `docs/superpowers/plans/2026-09-30-agenda-unificada.md`. Los dos P0
—el 404 de `/evento/[slug]` y los favoritos que se apagaban solos— están
cerrados, medidos y con test.

### Cómo queda

- `lib/source-data.ts` es la **hoja pura** del registro de 27 fuentes: no importa
  nada. `lib/source-registry.ts` es la composición que le une las funciones de
  scraping. `lib/utils.ts` y `lib/tickets.ts` derivan de la hoja, nunca del
  registro compuesto.
- `lib/agenda.ts` es el **agregador único**. `id === slug`, siempre, y el slug lo
  decide una sola vez en `normalizeRaw`.
- `lib/eventos.ts`, `lib/cultura.ts`, `lib/deporte.ts`, `lib/kids.ts` y
  `lib/conciertos.ts` son **vistas**: filtran el agregado, no scrapean. Una sola
  clave de caché, `agenda-all`, TTL 5 min.
- Las tarjetas y el JSON-LD usan `e.slug`. Un evento crudo se normaliza con
  `agendaSlug()` de `lib/slug.ts`, que aplica el mismo trim y el mismo
  tratamiento del `"#"` que `normalizeRaw`.
- Los favoritos se recuperan al leer: `FavoritesContext` rehace el id con
  `migrateFavorites`, así que los que ya estaban guardados sobreviven.
- `lib/popularity.ts` pesa por `group`, no por id, para que una variante municipal
  nueva herede el peso sin tocar la lista.

### Decisiones tomadas (no revertir sin motivo)

- **`category` y `kind` son campos distintos.** `category` es taxonomía cultural y
  alimenta colores/SEO/`/culture`; `kind` es el tramo del calendario
  (`agenda | calendario | inscripciones | excursiones`) y filtra `/deporte`.
  No se fusionan porque `normalizeCategory` colapsa `excursiones` → `Senderismo`.
  Hay un tercer eje, `tags`, para "infantil" y "La Blanca".
- **Los favoritos se recuperan, no solo se dejan de romper.** El objeto guardado
  tiene `{id, title, date, link}` y el slug se recalcula de título+fecha+enlace.
- **Las URLs no cambian.** `eventSlug` no depende del `id` ni del nombre de la
  fuente. Lo que cambia es que la mayoría de eventos *ganan* detalle.
- **`/culture` pasa a ser una vista.** El colapso a 4 cubos
  (`teatro|conciertos|exposiciones|agenda`) se queda como filtro sobre
  `mapToCultureCategory`; `category` guarda las 15 categorías reales.
- **`/conciertos` agrupa por id de registro, no por recinto.** Antes derivaba
  `venue.toLowerCase().replace(/\s+/g,"-")` y agrupaba por `"jimmy-jazz-gasteiz"`
  mientras `isTicketSource()` comparaba con `"jimmyjazz"`, así que la única sala
  que vende entradas decía "Más información". Y el recinto era inventado por el
  scraper, no por la fuente: es justo lo que el registro vino a arreglar.

### Fases que quedan

2. **Seguridad** — `subscribers.json` fuera de git, fail-closed sin `API_KEY`,
   coincidencia exacta en `PUBLIC_API_ROUTES` (hoy `startsWith("/api/actividades")`
   abre ~20 endpoints), CORS e `images.remotePatterns` con lista blanca,
   `security: []` en `openapi.yaml` para las 8 rutas públicas, validar token en
   `/api/newsletter/confirm`. Se sabe ya que `middleware.ts` sigue con el
   convenio antiguo (`next build` avisa: usar `proxy`), y que
   `app/api/actividades/route.ts`, `navidad/route.ts` y `senderismo/route.ts`
   emiten `source: "vitoria-gasteiz"` y `"cm-gazteiz"`, ids que no son del
   registro y que el enum de `openapi.yaml` no documenta.
3. **Consolidación** — unificar el `beforeinstallprompt` triplicado, arreglar
   regex rotos (`"visitias guiadas"`, `m[uú]sica`), fechas de La Blanca no
   hardcodeadas, y `app/api/actividades/tours` y `tardeo` que responden
   `source: "agregado"`. Los dos ficheros muertos (`app/types.ts`,
   `lib/safeFetch.ts`) ya se borraron en la Fase 1.
4. **Red de seguridad** — `jsdom` + tests de componentes, tests de
   `middleware`/`push`/`db`/`email`, `/api/cron/send-newsletter`, ESLint.
   Y cerrar de verdad el test del huso horario: hoy avisa por consola cuando el
   runner está en UTC, porque en UTC `localDateKey(d)` y `d.slice(0,10)` son la
   misma función y ningún test puede distinguirlas.

Fuera de alcance, anotado para que no se pierda: el rate limit en `Map`
in-memory no se arregla sin store compartido.

## Trampas del repo

- **Nada alcanzable desde un componente cliente llega a un módulo de servidor.**
  Hay dos caminos y los dos importan: `lib/sources/` (los scrapers, y con ellos
  el token MEC de La Genterula) y `lib/og-image.ts` (que importa `cheerio`, son
  148,2 KB de chunk, y solo usa un scraper de servidor). El grafo de imports de
  `__tests__/source-data.test.ts` los recorre desde las 44 raíces `"use client"`.
  Es el mismo patrón hoja/composición: datos sin imports en un lado, scrapers en
  la composición. Un `import * as paquete` no se poda aunque nadie use el
  paquete: Turbopack dejó 148 KB de cheerio en el cliente durante semanas.
- **La regla de ESLint `no-restricted-imports` protege el slug.**
  Prohíbe importar `eventSlug` a pelo en `app/`, `lib/` y `scripts/`, con
  `importNames` para que siga al símbolo aunque se renombre al importar
  (`import { eventSlug as sl }` se colaba en el guard anterior). Un evento crudo
  pasa por `agendaSlug()`; un `AgendaEvento` usa su campo `slug`. Ya no hay
  excepciones: las dos que quedaban eran los ficheros de `/conciertos`.
- **Un `crypto.randomUUID()` sobrevive dentro de los scrapers y es correcto.**
  `lib/sources/municipal.ts:58`, `euskadi.ts:52`, `gasteizhoy.ts:132` ponen un id
  propio, pero `RawLike` no declara campo `id`: el agregador lo descarta antes de
  construir el `AgendaEvento`. La restricción era "nada en la ruta de datos", y la
  ruta de datos es el agregador, no el interior de un scraper.
- **El `mtimeMs` del sistema de ficheros va por delante de `Date.now()`.** Medido
  en esta máquina: entre 2 y 3 ms. Por eso un test de TTL que se fíe del signo de
  `age = Date.now() - stat.mtimeMs` es intermitente, y por eso los tests de caché
  fijan el reloj. No "arreglar" uno de esos tests cambiando el TTL: el margen
  tiene que venir del reloj, no de la aritmética.
- **PowerShell 5.1 corrompe la codificación de los ficheros con acentos.** Byte a
  byte aparecen los tres casos: `-replace` y `Set-Content -Encoding UTF8` producen
  mojibake y `seÃ±ala`; `Set-Content -Encoding UTF8` además mete un BOM de 3
  bytes. En este repo, ficheros con acentos solo con la herramienta de edición, o
  con `[System.IO.File]::WriteAllText` y `UTF8Encoding(False)`. Leer para
  inspeccionar necesita `-Encoding UTF8` explícito.
- **Un dev server matado a mitad deja `.next/dev/types/routes.d.ts` truncado** y
  `tsc` aborta en fase de parseo sin reportar ningún error real, lo que parece un
  typecheck roto cuando no lo está. Se arregla borrando `.next/dev` y pidiendo
  una página al server.
- **Rula descarga 8,7 MB y nunca se cachea** (`lib/sources/rula.ts:42`): Next no
  cachea fetches de más de 2 MB. La unificación eliminó la duplicación, no la
  descarga. Y el token MEC de la línea 2 sigue hardcodeado: sacarlo del código no
  lo revoca, hay que rotarlo en el servidor.
- **`.data/push.db` y `data/subscribers.json` escriben en disco** y se pierden en
  cada redeploy si Dokploy no tiene volumen persistente montado. No es
  verificable desde el repo. `README.md` lo advierte.
- **El envío de correo falla de forma explícita en producción** si faltan
  `EMAIL_USER`/`EMAIL_PASS` (`lib/mail.ts`): devuelve `ok: false` y
  `scripts/send-newsletter.ts` sale con código 1. Fuera de producción hace mock.
  No revertir esto a `ok: true`: era un fallo silencioso que hacía pasar por
  enviada una newsletter que no llegaba a nadie.
- **Los tests de scraper usan fixtures con `mockFetchWith`/`loadFixture`, no
  red.** Pero un fixture con fechas fijas se pudre: `loadFixtureWithFutureDates`
  (`__tests__/helpers.ts`) reescribe las fechas a futuro conservando el formato.
- **`sourceLabel` (`lib/utils.ts`) es una lista blanca derivada del registro.**
  Un id que no esté en `SOURCE_DATA` se enseña tal cual, en mayúsculas, en la pill
  de cada tarjeta, sin error. Dos comprobaciones en `__tests__/source-data.test.ts`
  vigilan que nadie escriba un `source:` a mano: ninguna vista ni ninguna lista de
  ids puede salirse del registro.
- **La taxonomía de `lib/categories.ts` es de 15 categorías**; `CULTURA_CATEGORIAS`
  son 4 cubos de vista y no sustituyen a la anterior.

## Commits

Estilo conventional commits, scope en castellano, descripción en inglés.
Ejemplos: `feat(scrapers): enrich euskadi pagination and municipal fields`.
