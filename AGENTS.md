# Gasteiz Click — memoria del proyecto

Agenda cultural de Vitoria-Gasteiz. Next.js 16 (App Router, RSC), React 19,
TypeScript estricto, Tailwind v4, 28 fuentes en el registro más 2 catálogos
sueltos, PWA, push, newsletter. Se despliega en Dokploy con `nixpacks.toml`
(Node 22).

## Comandos

```bash
npm run dev            # localhost:3000
npm test               # Jest, 44 suites / 392 tests
npm run lint           # ESLint (ver "baseline de lint")
npm run build
npx tsc --noEmit --incremental false   # typecheck real
npm run test:e2e       # Playwright
```

## Estado (2026-10-01)

Rebrand F0/F1, unificación de la agenda (Fase 1), seguridad (Fase 2) y
consolidación (Fase 3) cerrados y commiteados. Fases 1 y 2 **desplegadas en
producción**; la 3 está commiteada y pendiente de desplegar. Baseline verde:
`tsc` 0 errores, 392/392 tests, `build` exit 0, 63 problemas de lint (45
`no-explicit-any`, la mayoría preexistentes en scrapers).

Dos cosas siguen abiertas y **no son de código**: la rotación del token MEC en
el servidor de La Genterula, y confirmar el volumen persistente en Dokploy.

## Hecho: la consolidación (Fase 3)

Tres refactors independientes, sin spec porque no había nada que decidir de
arquitectura: se unificó el `beforeinstallprompt`, La Blanca dejó de llevar el año
escrito, y el calendario municipal perdió su cuarto fetch a mano.

### `beforeinstallprompt` tiene una sola implementación

`lib/useInstallPrompt.ts` es el store y ya no había debate: `Header.tsx` e
`InstallBanner.tsx` tenían cada uno su listener, su interfaz de evento y su
`useState`.

- El store es `createInstallStore(target: EventTarget)` con una instancia por
  defecto ligada a `window`. Por eso su contrato se testea en node, con un
  `EventTarget` falso, sin esperar a que la Fase 4 traiga `jsdom`.
- **El bug que arregla:** `promptInstall()` solo anulaba el evento si el usuario
  aceptaba. `beforeinstallprompt` se dispara una vez por carga de página y
  `prompt()` lo consume, así que tras un descarte el siguiente clic llamaba a
  `prompt()` sobre un evento ya consumido y el navegador lo rechaza. Ahora lo
  descarta siempre, y lo hace **antes** de esperar a `userChoice`, para que entre
  el clic y la respuesta no quede un evento que otro clic reutilice.
- El descarte del banner se lee en el inicializador de `useState`, no en un
  efecto: `react-hooks/set-state-in-effect` lo prohíbe, y no hay desajuste de
  hidratación que tapar porque en servidor `useInstallPrompt()` ya devuelve
  `false` y el banner no se pinta.

### La Blanca saca el año de los datos

El año estaba escrito en **cinco** sitios de `lib/sources/fiestas-blanca.ts` y en
cuatro más entre los componentes, la página y el endpoint. Los nueve morían igual:
el día que terminaba la edición, el rango pedido era del año anterior, el
calendario no devolvía nada, la sección se vacía y no se loguea nada.

- `blancaEditionYear(dates)` de `lib/blanca.ts` es el único sitio que sabe qué
  edición es esta: lo lee de las fechas que `calendariosID=513` ya devuelve.
- **La petición a GasteizHoy ya no puede ir en paralelo con la del calendario.**
  Su URL lleva el año dentro, así que depende de que la primera haya respondido.
  Fuera de temporada no hay año, y entonces no se pide: es la respuesta correcta.
- De paso, **27 peticiones pasaron a ser una.** `fetchAllDays` recorría el rango
  día a día en lotes de cinco para construir la misma consulta que
  `fetchMunicipalCalendar` emite una vez con su rango por defecto. Ese fetch se
  comparte ahora desde `municipal.ts` en vez de estar copiado, y su
  `AbortSignal.timeout` cubre las diez entradas municipales en lugar de solo una.
- Los fixtures son de **2027** a propósito. Con 2026, los tests passarían hoy y
  solo fallarían en agosto de 2027.
- El filtro de la etiqueta genérica pasó de `!== "La Blanca 2026"` a un patrón,
  por el mismo motivo.

### El calendario municipal tiene una sola puerta

`app/api/actividades/eventos/agenda/route.ts` era un cuarto fetch a mano de
`CalendarioServlet`, con tres copias de `municipal.ts` dentro (el regex del
`srcset`, el sufijo `_smart` y el aplanado de secciones) y la indentación rota.
Ahora usa `scrapeMunicipalCalendar` y decide solo la forma.

`__tests__/api/actividades-agenda.test.ts` es el primer test de route handler del
repo, y está en esa ruta porque es la que tenía la forma en riesgo: fija el
conjunto cerrado de claves, los tipos y el `calendariosID`.

## Hecho: la agenda unificada (Fase 1)

Cerrada. El diseño está en
`docs/superpowers/specs/2026-09-30-agenda-unificada-design.md` y el plan por
tareas en `docs/superpowers/plans/2026-09-30-agenda-unificada.md`. Los dos P0
—el 404 de `/evento/[slug]` y los favoritos que se apagaban solos— están
cerrados, medidos y con test.

### Cómo queda

- `lib/source-data.ts` es la **hoja pura** del registro de 28 fuentes: no importa
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
- **Una fuente sin fecha no entra en el registro.** Es la regla que decidió
  Civitatis y Kora, y conviene no reelegirla a la ligera: `normalizeRaw` descarta
  lo que no tiene fecha válida, y las dos publican *sesiones recurrentes*
  ("Free tour por Vitoria", "Martes de 19:15h a 20:15h") sin fecha concreta.
  Registrarlas obligaría a fabricar una —la siguiente ocurrencia del día de la
  semana— y eso mete fechas falsas en la agenda, en el detalle y en el JSON-LD.
  Se exponen como endpoint propio, con el horario literal, y las consume
  `/turismo`. Si algún día se quieren en la agenda, el sitio tiene que publicar
  calendario; no lo resuelve el scraper.

### Las tres fuentes migradas de `demo-next-js`

Eran 21 route handlers de scraping, de los que 18 ya existían aquí con mejor
implementación. Las tres que faltaban:

| Fuente | Cómo entra | Por qué |
| --- | --- | --- |
| `mercado-abastos` | Registro, `priority: 4` | Tiene fechas de verdad, vía la API REST de The Events Calendar |
| `civitatis` | Endpoint suelto `/api/actividades/tours/civitatis` | Recurrente, sin fecha |
| `kora` | Endpoint suelto `/api/actividades/experiencias` | Recurrente, sin fecha |

Las tres dejaron de necesitar Puppeteer. Ninguna lo necesitaba: Mercado de
Abastos expone `/wp-json/tribe/events/v1/events` con los eventos ya
normalizados, y Civitatis y Kora traen las tarjetas en el HTML inicial. Eso
ahorra ~300 MB de Chromium en la imagen de Dokploy y mantiene los tres dentro
de la convención de tests del repo (`mockFetchWith` + fixture), que con Puppeteer
no funcionaba.

`/api/actividades/tours` y `/api/actividades/tardeo` **no se han tocado**: son
vistas sobre el agregado y las deja el registro. `/api/actividades/tours` sigue
siendo un filtro por categoría, así que las fichas de Civitatis no entran ahí
todavía; la ruta de Civitatis es aparte a propósito.

### Fases que quedan

4. **Red de seguridad** — `jsdom` + tests de componentes (hoy `testEnvironment:
   "node"` y cero tests de React), tests de `push`/`email` (los de
   `middleware` y `db` ya existen), `/api/cron/send-newsletter` (el script ya
   lo referencia y no existe), y el baseline de ESLint. Y cerrar de verdad el test
   del huso horario: hoy avisa por consola cuando el runner está en UTC, porque en
   UTC `localDateKey(d)` y `d.slice(0,10)` son la misma función y ningún test
   puede distinguirlas.

   La Fase 3 cambió el presupuesto de esa fase: el store de
   `beforeinstallprompt` ya se testea en node con un `EventTarget` falso, así
   que de los tres sitios que la necesitaban queda el banner en sí, que sí
   necesita `jsdom`.

Fuera de alcance, anotado para que no se pierda: el rate limit en `Map`
in-memory no se arregla sin store compartido.

## Trampas del repo

- **Nada alcanzable desde un componente cliente llega a un módulo de servidor.**
  Hay dos caminos y los dos importan: `lib/sources/` (los scrapers) y cualquier
  cosa que importe `cheerio`. El grafo de imports de
  `__tests__/source-data.test.ts` los recorre desde todas las raíces `"use client"`.
  Es el mismo patrón hoja/composición: datos sin imports en un lado, scrapers en
  la composición. Un `import * as paquete` no se poda aunque nadie use el
  paquete: Turbopack dejó 148 KB de cheerio en el cliente durante semanas, y
  cuando se movió `fetchOgImage` a un módulo de servidor el chunk desapareció
  entero. Ese es el patrón a seguir cuando algo grande se cuele.
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
- **`/api/actividades/*` es contrato con la app móvil.** Con `x-api-key`, pero
  las consume un cliente de fuera: la forma de su respuesta no se toca. Sus
  `source:` del envelope (`"agregado"`, `"cm-gazteiz"`, `"vitoria-gasteiz"`) no son
  ids del registro **a propósito** y no se corrigen: describen de dónde sale la
  lista, no de qué fuente es cada evento, y cambiar el string le deja al cliente
  sin resultados sin ningún error en el servidor. Los eventos de dentro sí llevan
  su id real.
- **El calendario municipal tiene tres ventanas distintas para la misma fiesta**,
  y eso es un bug pendiente: `lib/season.ts:15` dice 4–9 ago, `lib/blanca.ts:1-4`
  dice 15 jul–12 ago, y `fiestas-blanca.ts` ya no dice ninguna. No se mezcló con
  la Fase 3 porque es otra decisión.
- **`fetchMunicipalCalendar` es la única puerta al calendario**, y por eso lleva
  `cache: "no-store"`. Eso hace que Next la marca `revalidate: 0`, con lo que
  cualquier ruta que la use se sale de la generación estática y se compila como
  dinámica. El aviso `Dynamic server usage` durante `next build` es **preexistente**
  y esperado: viene de que la home siempre llamó al agregado. Los scrapers lo
  capturan y devuelven vacío, así que el build sale 0.
- **Rula descarga 6,5 MB por petición** (`lib/sources/rula.ts`): Next no cachea
  fetches de más de 2 MB, así que la entrada del registro declara
  `cacheTtlMs` y su `run` se cachea por su cuenta. Con TTL de 2 h son ~79 MB al
  día en vez de 1,9 GB. Y `lib/cache.ts` deduplica peticiones en vuelo, para que
  una caché fría no dispare N descargas a la vez. El coste es que **un fallo
  puntual de una fuente se queda cacheado 2 h**; `scrapeRula` avisa por consola
  y devuelve vacío si falta `MEC_TOKEN`, en vez de gastar 6,5 MB en un 500.
- **El token MEC viene de `MEC_TOKEN`, no del código, y no es un secreto.**
  Medido: sin token o con uno falso la API responde 500, y no hay ruta pública
  que lo sustituya (`wp-json/wp/v2/mec-events` responde sin token pero su
  `content` es solo la descripción, sin fecha, hora ni lugar). Kiosko Cultura lo
  publica en su bundle JS. Sacarlo del código no lo revoca ni lo saca del
  historial de git: hay que pedir a La Genterula que lo revoque.
- **`.data/push.db` y `data/subscribers.json` escriben en disco** y se pierden en
  cada redeploy si Dokploy no tiene volumen persistente montado. No es
  verificable desde el repo. `README.md` lo advierte. `subscribers.json` además
  ya no está versionado y su ruta sale de `SUBSCRIBERS_PATH`.
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
- **Civitatis y Kora esconden la imagen real en `data-src`.** En las dos, el
  `src` es un placeholder —un gif de 1px en base64 en Civitatis,
  `/assets/images/blank.png` en Kora— y el `srcset` llega vacío. La URL buena va
  en `data-src`; en Kora es una lista de tamaños separada por comas y sirve la
  primera. Leer `src` da una imagen rota que parece correcta en el test.
- **Mercado de Abastos devuelve `title` como string plano**, no como
  `{rendered}`: el REST de The Events Calendar lo difiere de `content.rendered`
  y `excerpt.rendered`, que sí vienen envueltos. Y sus `start_date` son
  `"YYYY-MM-DD HH:mm:ss"` en hora de Europe/Madrid **sin offset**, igual que las
  del Ayuntamiento: hay que interpretarlas como hora local, no como UTC.
  actualmente el mercado no publica nada upcoming —los 24 eventos que devuelve son
  de 2024—, así que no aparece en la agenda y es lo esperado.

## Commits

Estilo conventional commits, scope en castellano, descripción en inglés.
Ejemplos: `feat(scrapers): enrich euskadi pagination and municipal fields`.
