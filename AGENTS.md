# Gasteiz Click — memoria del proyecto

Agenda cultural de Vitoria-Gasteiz. Next.js 16 (App Router, RSC), React 19,
TypeScript estricto, Tailwind v4, ~22 scrapers, PWA, push, newsletter. Se despliega
en Dokploy con `nixpacks.toml` (Node 22).

## Comandos

```bash
npm run dev            # localhost:3000
npm test               # Jest, 25 suites / 110 tests
npm run lint           # ESLint (ver "baseline de lint")
npm run build
npx tsc --noEmit --incremental false   # typecheck real
npm run test:e2e       # Playwright
```

## Estado (2026-09-30)

Rebrand F0/F1 commiteado y verificado. Baseline verde: `tsc` 0 errores,
110/110 tests, `build` exit 0, 72 problemas de lint (55 `no-explicit-any`
preexistentes en scrapers).

## En curso: unificación de la agenda

Cinco módulos agregan los mismos eventos con reglas distintas
(`lib/agenda.ts`, `lib/eventos.ts`, `lib/cultura.ts`, `lib/deporte.ts`,
`lib/kids.ts`), y `/kids` y `/deporte` reimplementan en línea los dos últimos.
Produce dos bugs P0:

- **404 en `/evento/[slug]`.** Las tarjetas generan el href con `eventSlug()`
  (`lib/shared.tsx:102`) pero el detalle resuelve solo contra `lib/agenda.ts`.
  Los eventos que viven únicamente en `lib/eventos.ts` — Eventbrite, Vital,
  Arkabia, Entradium, Miniature, RSS municipal — no resuelven.
- **Favoritos que se pierden.** `FavoriteButton` compara `event.id`, que en la
  home es `crypto.randomUUID()` y cambia en cada re-scraping.

Diseño en `docs/superpowers/specs/2026-09-30-agenda-unificada-design.md`.
Plan: registro declarativo de fuentes → `AgendaEvento` único con `id` = slug →
vistas que filtran el agregado en vez de scrapear.

### Decisiones tomadas (no revertir sin motivo)

- **`category` y `kind` son campos distintos.** `category` es taxonomía cultural y
  alimenta colores/SEO/`/culture`; `kind` es el tramo del calendario
  (`agenda | calendario | inscripciones | excursiones`) y filtra `/deporte`.
  No se fusionan porque `normalizeCategory` colapsa `excursiones` → `Senderismo`.
  Hay un tercer eje, `tags`, para "infantil" y "La Blanca".
- **Los favoritos se recuperan, no solo se dejan de romper.** El objeto guardado
  tiene `{id, title, date, link}` y el slug se recalcula de título+fecha+enlace,
  así que `FavoritesContext` rehace el id al leer y los favoritos existentes
  sobreviven.
- **Las URLs no cambian.** `eventSlug` no depende del `id` ni del nombre de la
  fuente. Lo que cambia es que la mayoría de eventos *ganan* detalle.
- **`/culture` pasa a ser una vista.** El colapso a 4 cubos
  (`teatro|conciertos|exposiciones|agenda`) se queda como filtro sobre
  `mapToCultureCategory`; `category` guarda las 15 categorías reales.

### Fases acordadas

1. **Unificar el agregador** (en curso) — mata los dos P0.
2. **Seguridad** — `subscribers.json` fuera de git, fail-closed sin `API_KEY`,
   coincidencia exacta en `PUBLIC_API_ROUTES` (hoy `startsWith("/api/actividades")`
   abre ~20 endpoints), CORS e `images.remotePatterns` con lista blanca,
   `security: []` en `openapi.yaml` para las 8 rutas públicas, validar token en
   `/api/newsletter/confirm`.
3. **Consolidación** — borrar `app/types.ts` y `lib/safeFetch.ts` (0 imports),
   unificar el `beforeinstallprompt` triplicado, arreglar regex rotos
   (`"visitias guiadas"`, `m[uú]sica`), fechas de La Blanca no hardcodeadas.
4. **Red de seguridad** — `jsdom` + tests de componentes, tests de
   `middleware`/`push`/`db`/`email`, `/api/cron/send-newsletter`, ESLint.

Fuera de alcance, anotado para que no se pierda: el rate limit en `Map`
in-memory no se arregla sin store compartido.

## Trampas del repo

- **Un dev server matado a mitad deja `.next/dev/types/routes.d.ts` truncado** y
  `tsc` aborta en fase de parseo sin reportar ningún error real, lo que parece un
  typecheck roto cuando no lo está. Se arregla borrando `.next/dev` y pidiendo
  una página al server.
- **Rula descarga 8,7 MB y nunca se cachea** (`lib/sources/rula.ts:42`): Next no
  cachea fetches de más de 2 MB. Son 4 descargas solo durante `npm run build`.
  La unificación del agregador elimina la duplicación, no la descarga.
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
- **`sourceLabel` (`lib/utils.ts:91`) es una lista blanca.** Toda fuente nueva
  necesita su caso ahí o la pill muestra el slug crudo. El registro de la Fase 1
  lo deriva, pero conviene no olvidarlo al añadir scrapers.
- **La taxonomía de `lib/categories.ts` es de 15 categorías**; `CULTURA_CATEGORIAS`
  son 4 cubos de vista y no sustituyen a la anterior.

## Commits

Estilo conventional commits, scope en castellano, descripción en inglés.
Ejemplos: `feat(scrapers): enrich euskadi pagination and municipal fields`.
