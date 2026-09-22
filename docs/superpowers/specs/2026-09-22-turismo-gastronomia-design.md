# Gasteiz Click — Turismo y Gastronomía (diseño)

Fecha: 2026-09-22
Estado: aprobado por el usuario

## Contexto

Gasteiz Click es una agenda cultural de Vitoria-Gasteiz (Next.js 16, scrapers +
caché en disco, PWA, favoritos, push). El usuario quiere ampliarla hacia una
"agenda virtual moderna, atractiva y accesible" añadiendo **turismo** y
**gastronomía**, evolucionando el diseño actual (sin rediseño radical) y
mejorando la **accesibilidad WCAG AA**.

### Decisiones de alcance acordadas (del brainstorming)

- Origen de datos: **híbrido** — curado en `data/` para lo estable
  (monumentos, rutas de pintxos, sitios, info práctica) + reutilizar scrapers
  existentes para lo que cambia (senderismo, eventos de visita guiada,
  eventos gastronómicos de la agenda).
- Navegación: **dos secciones nuevas** en el menú principal: `/turismo` y
  `/gastronomia`.
- Mapas: **enlaces externos a Google Maps** (sin API key, coordenadas en los
  datos curados con enlace `linkMaps`).
- Visual: **evolucionar** sobre la identidad actual (dark azul-verde + magenta,
  Montserrat, bezels, `card-hover`).
- Accesibilidad: **WCAG AA**.
- Fix incluido: bug del apartado de Cultura (mismatch de fuente Rula).

## Bug de Cultura (se resuelve en este trabajo)

**Síntoma:** en `/culture`, al filtrar Conciertos por la píldora "Rula" no
aparece ningún resultado, y las tarjetas de La Genterula muestran `rula` en
minúscula en el badge en lugar de un nombre legible.

**Causa raíz:** `lib/cultura.ts:89` etiqueta los eventos con `source: "rula"`
(escraper renombrado de `lagenterula` a `rula` en el commit `20e4dbd`), pero
`app/components/CulturePageClient.tsx` sigue usando la clave antigua
`lagenterula` en `SOURCE_PILLS.conciertos` (filtra `e.source ===
"lagenterula"` → 0 resultados) y en `SOURCE_LABELS` (fallback a la cadena
cruda `rula`).

**Fix:**
1. Mover `SOURCE_PILLS` y `SOURCE_LABELS` a `lib/cultura.ts` como constantes
   exportadas (`CULTURE_SOURCE_PILLS`, `CULTURE_SOURCE_LABELS`).
2. Renombrar la clave `lagenterula` → `rula` con label `"Rula"`.
3. `CulturePageClient.tsx` importa las constantes (eliminar duplicación).
4. **Test de regresión** que garantice que todas las claves de
   `CULTURE_SOURCE_PILLS.conciertos` y `CULTURE_SOURCE_LABELS` existen como
   `source` reales emitidos por `fetchCultura` (comprobar contra el conjunto de
   fuentes que `fetchCultura` usa: `municipal`, `jimmyjazz`, `vam`, `fever`,
   `rula`, `gasteizhoy`).

## Arquitectura

### 1. Capa de datos

**Nuevo `lib/curated.ts`** — loader genérico de JSON curados:
- `getCurated<T>(file: string): Promise<T>` leyendo de `data/` (lectura síncrona
  de `fs` con caché, comparable al patrón de `getCachedOrFetch`).
- Utilidades compartidas: normalización de enlaces a Google Maps
  (`mapsLink(coords)`), tipos base (`FichaCurada { slug, nombre, imagen,
  descripcion, barrio/zona, coords?, linkMaps?, linkOficial?, tags }`).

**Nuevo `lib/turismo.ts`:**
- `getQueVer(): Promise<FichaCurada[]>` ← `data/turismo/que-ver.json`
  (5–8 lugares emblemáticos: Catedral de Santa María, Plaza de España, Anillo
  Verde, Museo Artium, Casco Viejo…).
- `getRutasTurismo(): Promise<Ruta[]>` ← `data/turismo/rutas.json`
  (rutas del Anillo Verde + senderos cercanos; tipo `Ruta { slug, nombre,
  dificultad, duracion, distancia, puntoSalida, coords, linkMaps, image,
  descripcion }`).
- `getVisitasGuiadas(): Promise<Evento[]>` — filtra `getProximosEventos()`
  con categorías "Visitas" (o por términos en el título).
- `getInfoPractica(): Promise<InfoPractica>` ← `data/turismo/info-practica.json`
  (cómo llegar, transporte público, hoteles/alojamiento, consejos; tipo
  estructurado por bloques `{ id, titulo, icono, items[] }`).

**Nuevo `lib/gastronomia.ts`:**
- `getSitios(): Promise<Sitio[]>` ← `data/gastronomia/sitios.json`
  (tipo `Sitio { slug, nombre, barrio, tipoCocina, rangoPrecio ('€'|'€€'|'€€€'),
  direccion, coords, linkMaps, imagen, descripcion, recomendado?: boolean }`).
- `getRutasPintxos(): Promise<RutaPintxo[]>` ←
  `data/gastronomia/rutas-pintxos.json` (3 zonas: Casco Viejo, Centro,
  Ensanche; tipo `RutaPintxo { slug, zona, nombre, paradas: Array<{
  nombre, direccion, pintxo, precio }>, duracion, consejo }`).
- `getEventosGastronomia(): Promise<Evento[]>` — filtra `getProximosEventos()`
  con categoría "Gastronomía".

**Interfaz pública de ambos módulos:** funciones `async` que devuelven datos
estables/feed vivos; se cachean a propósito (curado = lectura de fichero;
eventos = se reusa la caché de `getProximosEventos`).

### 2. Páginas y componentes

Patrón a seguir: el de `/culture` y `/deporte` (server page con
`revalidate = 300`, metadata, `JsonLd` + client component).

- `app/turismo/page.tsx` + `app/components/TurismoPageClient.tsx`.
- `app/gastronomia/page.tsx` + `app/components/GastronomiaPageClient.tsx`.

Ambas con:
- Header de sección (eyebrow + h1 + subtítulo) reusando estilos de Culture.
- Navegación interna por anclas/tabs (incluye filtros de barrio/zonas).
- Tarjetas de "sitio/ruta/lugar" con patrón visual `double-bezel` +
  `card-hover`; badge "Recomendado" para sitios destacados.
- Enlaces externos a Google Maps (`linkMaps`) con `rel="noopener noreferrer"`,
  icono sucinto y `aria-label`.
- `EmptyState` reutilizado cuando no hay datos (p. ej. visitas guiadas vacías).

**Navegación:**
- `app/components/Header.tsx`: añadir `Turismo` → `/turismo` y
  `Gastronomía` → `/gastronomia` a `navItems`.
- Dropdown "Ocio" de `Header.tsx`: añadir enlaces Turismo y Gastronomía.
- `app/components/BottomNav.tsx`: sin cambios (se mantienen 5 pestañas; las
  nuevas secciones se alcanzan por header/menú).
- `app/components/CategoriesGrid.tsx` (home): añadir dos tarjetas "Turismo" y
  "Gastronomía" con counts (turismo: nº de fichas curadas; gastronomía: nº de
  sitios). La cuadrícula pasa de 4 a 6 tarjetas (`grid-cols-2 md:grid-cols-3
  lg:grid-cols-6`).

### 3. Rediseño visual (evolución)

- Ampliar tokens en `app/globals.css`: nuevo color `--amber` (para
  gastronomía/pintxos) en `:root` y `:root[data-theme="dark"]`, y su mapping
  `--color-amber` en `@theme inline`. Turismo reutiliza `--teal`/`--green`.
- No se cambia la paleta base ni la tipografía. Se usan los componentes de
  tarjeta existentes.

### 4. Accesibilidad (WCAG AA)

Aplicar a las páginas nuevas y corregir lo compartido que toquemos:
- Botones de filtro con `aria-pressed` y estados de foco visibles (el globo
  `:focus-visible` ya existe).
- Imágenes decorativas con `alt=""`; imágenes con contenido con `alt`
  descriptivo.
- Contraste: evitar texto blanco translúcido sobre imagen en tarjetas novas;
  usar etiqueta/badge con fondo sólido o `backdrop-blur` + opacidad suficiente.
- Enlaces externos con `aria-label` descriptivo y `rel`.
- Encabezados jerárquicos (un solo `h1` por página).
- Respetar `prefers-reduced-motion` (ya global) y no añadir animaciones que
  lo violen.
- HTML semántico: `nav`, `main`, `footer`, listas.

### 5. Testing

- **Jest**
  - Regresión Rula: claves de `CULTURE_SOURCE_PILLS`/`CULTURE_SOURCE_LABELS`
    ⊇ fuentes de `fetchCultura`.
  - Loaders curados: lectura e invariantes de estructura de los JSON
    (campos requeridos presentes, `coords` con lat/lng numéricas si existen,
    `linkMaps` bien formado).
  - Utilidades de `lib/curated.ts` (p. ej. `mapsLink`).
- **E2E (Playwright)** — cubrir rutas novas: navegación a `/turismo` y
  `/gastronomia` desde la home y render de secciones principales (smoke).
- Verificación final: `npm run lint` y `npm run build`.

## Fuera de alcance

- Mapa integrado Leaflet/OSM (decisión: enlaces externos).
- Rediseño radical de marca/paleta.
- Scrapers nuevos de terceros (no hay scraping nuevo en esta fase; se reusan
  los existentes).
- Cambios en BottomNav móvil.
- Secciones de alojamiento detalladas (solo bloque informativo curado).

## Riesgos

- **Scrapers rotos:** mitigado reusando los existentes (senderismo,
  `getProximosEventos`) con sus cachés y `Promise.allSettled`; páginas toleran
  vacío con `EmptyState`.
- **JSON curados con errores de estructura:** mitigado con tests de
  invariantes en Jest.
- **Regresión Cultura:** mitigado con test que fija la correspondencia de
  fuentes.