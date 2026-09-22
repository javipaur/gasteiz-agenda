# Home hub, VGBus, Farmacias y Eventos opendata/Eventbrite/Entradium/Vital

## Goal
Rediseñar la home con un hub de 8 secciones con counts como protagonista, y añadir cuatro bloques nuevos: VGBus (bus/tranvía en tiempo real), farmacias de guardia (con mapa Leaflet), y nuevas fuentes de eventos (agenda cultural/deportiva municipal RSS, Eventbrite, Entradium, Fundación Vital) además de integrar Arkabia ya existente.

## Architecture
- Next.js App Router, SSG `revalidate=300`, componentes `#lib/shared`, estética dark azul-verde + magenta, Montserrat, bezels/card-hover.
- Fuentes de eventos en `lib/sources/*.ts`, agregadas en `lib/eventos.ts#fetchAllSources` (dedupe existente por título+período).
- APIs proxy en `app/api/*`, listas públicas en `middleware.ts#PUBLIC_API_ROUTES`.
- Sin dependencias nuevas salvo `leaflet` + `react-leaflet` (bloque C).

## Tech Stack
TypeScript, Next.js 16.2.1 (Turbopack), Tailwind v4, cheerio, lucide-react, leaflet/react-leaflet.

## Spec

### A. Home hub de 8 tarjetas
- A1. Compactar `HeroSection.tsx`: badge + H1 + subtítulo + `HeroSearch`. Quitar pestañas de 7 días/detacado/grid (se extraen a su propia sección).
- A2. Nueva `SectionsHub` server component (reemplaza `CategoriesGrid`): 8 tarjetas `grid-cols-2 md:grid-cols-3 lg:grid-cols-4` con counts:
  - Conciertos → `Música`/`Conciertos` 7 días · Cine → `getPeliculas().length` · Niños → `Infantil`/`Kids` 7 días · Cultura → `CULTURA_SET` · Deporte → `DEPORTE_SET` · Turismo → `getQueVer()` · Gastronomía → `getSitios()` · La Blanca → `scrapeFiestasBlanca().length` (fuera de temporada: descripción "Fiestas en agosto", sin count).
- A3. Nueva `NextDaysSection` client component con las pestañas 7 días + destacado + grid extraídas de `HeroSection`, renderizada tras el hub.
- A4. Reordenar `app/page.tsx`: Hero → Hub → 7 días → Mood → Top → Conciertos → SocialProof → Cultura → Infantil → Fiestas → Todos → InstallBanner → Newsletter. Eliminar `CategoriesGrid`.

### B. VGBus `/bus`
- B1. `lib/sources/vgbus.ts`: `buscarParadas`, `paradasCercanas`, `consultaLlegadas` (`detalleAction.do?accion=CONSULTA_PARADAS&idParada=`), `consultarAlertas`. Base `https://www.vitoria-gasteiz.org/pwa/vgbus` y `https://www.vitoria-gasteiz.org/j16-02w/`. Cache TTL 30-60s.
- B2. `app/api/vgbus/route.ts` + `PUBLIC_API_ROUTES`.
- B3. `app/bus/page.tsx` (server: título/SEO) + `BusPageClient.tsx`: buscador debounce, resultados con líneas (bus/TG), detalle con llegadas en tiempo real y alertas.

### C. Farmacias `/farmacias`
- C1. `app/farmacias/page.tsx` + `FarmaciasPageClient.tsx` consumiendo `/api/farmacias` (ya existe, `{date,count,data}` con lat/lng).
- C2. `leaflet` + `react-leaflet`: mapa interactivo con marcadores; popup con nombre/dirección/teléfono.
- C3. Fallback si cofalava no responde.

### D. Eventos opendata + Eventbrite + Entradium + Vital + Arkabia
- D1. `lib/sources/municipal-rss.ts`: RSS agenda cultural (`rssAction.do?idioma=es&accion=actividadesCuadroMando&claveArea=38`) y deportiva (`claveArea=34`) → categoría cultura/deporte. Parse XML con cheerio.
- D2. `lib/sources/eventbrite.ts`: JSON-LD embebido en `eventbrite.es/d/spain--vitoria-gasteiz/events/`; filtrar `addressLocality === "Vitoria-Gasteiz"`.
- D3. `lib/sources/entradium.ts`: `.event-card` server-rendered en `m.entradium.com`; filtrar por lugar Vitoria-Gasteiz.
- D4. `lib/sources/vital.ts`: `.fundacion-agenda-evento` en `fundacionvital.eus/eventos`; mapear tags→categoría.
- D5. Integrar `scrapeArkabia` (ya existe) en `lib/eventos.ts`.
- D6. Agregar las 5 fuentes a `fetchAllSources()` con dedupe.

## Global Constraints
- Texto en español, WCAG AA, `revalidate=300`, cache `getCachedOrFetch`.
- Sin dependencias nuevas salvo leaflet/react-leaflet (bloque C).
- Lint: solo ficheros nuevos (baseline 56 errores pre-existentes).
- Endpoints verificados por GET (read-only) antes de integrar.

## Tasks
- [ ] Escribir fichero de plan
- [ ] A1: Compactar HeroSection
- [ ] A2: Crear SectionsHub (8 tarjetas + counts)
- [ ] A3: Extraer NextDaysSection
- [ ] A4: Reordenar page.tsx y eliminar CategoriesGrid
- [ ] B1: lib/sources/vgbus.ts
- [ ] B2: app/api/vgbus/route.ts + PUBLC public routes
- [ ] B3: app/bus página + cliente
- [ ] C1: app/farmacias página + cliente
- [ ] C2: instalar leaflet + react-leaflet y mapa
- [ ] D1: municipal-rss.ts
- [ ] D2: eventbrite.ts
- [ ] D3: entradium.ts
- [ ] D4: vital.ts
- [ ] D5: integrar arkabia en eventos.ts
- [ ] D6: fetchAllSources con nuevas fuentes
- [ ] Verificar: npx jest, npm run build