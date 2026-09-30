# Gasteiz Click — Agenda unificada (diseño)

Fecha: 2026-09-30
Estado: aprobado por el usuario

## Contexto

Gasteiz Click agrega eventos de ~18 scrapers. Hoy existen **cinco** módulos que
hacen el mismo trabajo con reglas distintas, y de ahí salen bugs que el usuario
reporta como "los datos no cuadran".

| Módulo | Fuentes | Clave de caché | `id` | Consumido por |
|---|---|---|---|---|
| `lib/agenda.ts` | 10 | `agenda-all` | `${source}-${slug}` | detalle, sitemap, RSS, `agenda/[mes]`, búsqueda, push digest, kiosko, tardeo, tours |
| `lib/eventos.ts` | 12 | `eventos-proximos` | `e.id ?? crypto.randomUUID()` | home, hub, turismo, gastronomía, `/api/v1/events`, `/api/actividades/eventos/proximos` |
| `lib/cultura.ts` | 9 (6 llamadas municipales) | `cultura-eventos` | `raw.id ?? crypto.randomUUID()` | `/culture` |
| `lib/deporte.ts` | 4 | `deporte-eventos-mood` | `e.id ?? crypto.randomUUID()` | `MoodFilter` |
| `lib/kids.ts` | 1 | `kids-eventos-mood` | `e.id ?? crypto.randomUUID()` | `MoodFilter` |

Además `/kids/page.tsx:18` y `/deporte/page.tsx:52` **reimplementan** en línea
lo que ya hacen `lib/kids.ts` y `lib/deporte.ts`, con claves de caché distintas
(`kids-eventos`, `deporte-eventos`): son dos fuentes de verdad para lo mismo.

### Bugs que este trabajo resuelve

**P0 — 404 en `/evento/[slug]`.** Las tarjetas generan su href con
`eventSlug(evento)` (`lib/shared.tsx:102`), pero el detalle resuelve el slug solo
contra `lib/agenda.ts` (`app/evento/[slug]/page.tsx:30`). Los eventos que existen
únicamente en `lib/eventos.ts` — Eventbrite, Fundación Vital, Arkabia, Entradium,
Miniature, RSS municipal — quedan enlazados y **no resuelven**. También pasa con
`buscametas` y `senderismo`, que solo están en `agenda.ts` pero no en las vistas
que los pintean.

**P0 — favoritos que desaparecen.** `FavoriteButton` compara `event.id`
(`app/components/FavoriteButton.tsx:26`). En la home los eventos vienen de
`lib/eventos.ts`, donde `normalizeEvento` hace `id: e.id || crypto.randomUUID()`
(`lib/eventos.ts:37`). Cada re-scraping genera UUID nuevos, así que todos los
favoritos guardados dejan de coincidir.

**Doble coste de scraping.** `agenda.ts` y `eventos.ts` scrapean 6 fuentes
comunes (fever, rula, gasteizhoy, vam, municipal, euskadi) por separado, con
TTLs idénticos de 5 min. `/culture` añade 6 llamadas más a
`scrapeMunicipalCalendar`. El scraper de Rula son 8,7 MB por respuesta y Next.js
no cachea nada de más de 2 MB (`lib/sources/rula.ts:42-45`), así que cada
descarga se repite en cada render y se paga dos veces.

**Taxonomía triple.** `lib/cultura.ts:49` colapsa a 4 cubos
(`teatro|conciertos|exposiciones|agenda`) mientras `lib/categories.ts:44`
normaliza a 15 categorías culturales. `lib/deporte.ts:50-71` usa
`"Agenda" | "Calendario" | "Inscripciones" | "Senderismo"` y
`app/deporte/page.tsx:22` usa `"agenda" | "calendario" | "inscripciones" | "excursiones"`.

**Etiquetas de fuente incoherentes.** `sourceLabel` (`lib/utils.ts:91`) no
conoce `eventbrite`, `entradium`, `vital`, `arkabia`, `miniature`,
`buscametas`, `cm-gazteiz` ni `municipal` → esas pills muestran el slug crudo.
Los mismos conciertos se etiquetan `jimmy-jazz-gasteiz` en `agenda.ts:124`
(con caso en `sourceLabel`) y `jimmyjazz` en `cultura.ts:85` (sin caso). Y
`agenda.ts:128` etiqueta el senderismo como `euskadi`, colisionando con la
fuente real de Euskadi.

## Objetivo

Un único agregador. Toda lista de eventos en cualquier página — y el detalle de
`/evento/[slug]` — sale del mismo sitio, con el mismo `id`, la misma taxonomía y
la misma caché.

## Arquitectura

### 1. Registro declarativo de fuentes

El agregador se describe como datos, no como un `Promise.allSettled` de N
posiciones. Cada entrada es una invocación concreta de un scraper con sus
argumentos, su identificador de fuente y sus pistas de taxonomía.

```ts
// lib/sources-registry.ts
export type SourceEntry = {
  sourceId: string;          // canónico, el único que ve el resto del código
  label: string;             // texto para la UI
  run: () => Promise<RawLike[]>;
  category?: string;         // pista si la fuente no trae categoría
  kind?: string;             // sub-tipo de la fuente (inscripciones, calendario…)
  tags?: string[];           // marcas para filtros de vista (infantil, senderismo…)
  maps?: boolean;            // fuerza mapToCultureCategory en la vista /culture
};
```

Añadir o quitar una fuente pasa a ser **una línea**, no reordenar un bloque de 12
`if (resultado.status === "fulfilled")`.

Claves de `sourceId`: una por scraper, elegidas para que todas caigan en
`sourceLabel`. `jimmyjazz` pasa a ser el canónico (hoy conviven `jimmyjazz` y
`jimmy-jazz-gasteiz`). Senderismo deja de etiquetarse `euskadi` y usa `cm-gazteiz`.

El mismo `(sourceId, argumentos)` se declara **una sola vez** aunque lo usen
varias vistas, y el registro deduplica la ejecución: `scrapeMunicipalCalendar`
se llama con `tipo: 6` y con `dest: ["infantil"]`, que son peticiones distintas
y legítimas, pero `scrapeSenderismo` se llama una vez y su resultado se reparte.

### 2. `AgendaEvento` como único tipo

```ts
export type AgendaEvento = {
  id: string;          // === slug. Determinista.
  slug: string;
  title: string;
  date: string;
  dateEnd?: string;
  time?: string;
  image?: string;
  location: string;
  link: string;
  description?: string;
  category: string;    // taxonomía cultural, siempre vía normalizeCategory
  source: string;      // sourceId canónico
  kind?: string;       // "inscripciones" | "calendario" | "agenda" | …
  tags?: string[];     // "infantil" | "senderismo" | "la-blanca" | …
  cancelled?: boolean;
  price?: string;
  rating?: number;
  popularity?: number;
};
```

**`category` y `kind` son ejes distintos y no se mezclan.** `category` responde
"¿de qué es?" (Música, Teatro, Infantil, Senderismo…) y alimenta colores, SEO y
el filtro de cultura. `kind` responde "¿qué tramo del calendario es?" y es lo
que filtra `/deporte`. `normalizeCategory` mapea `excursiones` → `Senderismo`, lo
que hace evidente por qué no puede ser el mismo campo.

`tags` cubre el tercer eje para los casos restantes: "esto es infantil", "esto
es La Blanca".

### 3. Identidad determinista

`id = slug = eventSlug({ title, date, link })`, siempre. Se eliminan todos los
`crypto.randomUUID()` de la ruta de datos: `lib/eventos.ts:37`,
`lib/cultura.ts:43`, `lib/kids.ts:20`, `lib/deporte.ts:23`,
`app/kids/page.tsx:25` y `app/deporte/page.tsx:42`.

Las URLs no cambian: `eventSlug` no depende del `id` ni de la fuente, solo de
título, fecha y enlace, que no tocamos. Los enlaces ya publicados siguen
resolviendo y el sitemap no se invalida. Lo que **cambia** es que la mayoría de
los eventos ganan detalle donde antes no lo tenían.

**Migración de favoritos.** Los favoritos guardados en `localStorage` guardan
`{ id, title, date, link }` — y el slug se puede recalcular a partir de esos tres
campos. `FavoritesContext` recalcula el id al leer, así que **los favoritos
existentes se recuperan** en lugar de perderse. Es la diferencia entre "dejar de
empeorar" y "arreglar de verdad".

### 4. Deduplicación

Clave `título normalizado + fecha`, no por slug: el slug incluye un hash del
enlace, así que dos fuentes del mismo evento con enlaces distintos **nunca**
colisionan. El `dedupe` actual de `agenda.ts:154` (`${title}|${slug}`) no
deduplica nada; el de `eventos.ts:199` sí pero con otra clave.

Ante una colisión gana el primer registro según el orden del registro, que se
ordena por prioridad de fuente (municipal > vam > fever > agregadores). Se
conserva el `image` del perdedor si el ganador no traía ninguna, porque las
fuentes municipales suelen venir sin imagen y las comerciales con.

### 5. Caché

Una sola clave, `agenda-all`, 5 min, vía `getCachedOrFetch`. Se eliminan
`eventos-proximos`, `cultura-eventos`, `deporte-eventos`, `deporte-eventos-mood`,
`kids-eventos` y `kids-eventos-mood`.

El fallo por fuente se reporta con `logger.warn("scraping_failed")` como ya hace
`lib/eventos.ts:99`, para que la caída de una fuente siga siendo visible en Axiom
y no se pierda al unificar.

### 6. Vistas

Cada página deja de scrapear y pasa a filtrar el agregado.

- `lib/eventos.ts` → `getProximosEventos` pasa a ser un wrapper de una línea sobre
  `getAgendaEventos`, conservando su firma (`{ startDate, endDate }`) para no
  tocar `/api/v1/events` ni la newsletter.
- `lib/cultura.ts` → `getCultureEventos()` devuelve el agregado filtrado por
  `mapToCultureCategory(category)`; el colapso a 4 cubos pasa a ser una vista, no
  una normalización. `CULTURE_SOURCE_PILLS` se deriva del registro, así que no
  puede volver a desincronizarse de las fuentes reales.
- `lib/deporte.ts` → filtra por `kind`. Se adopta el vocabulario de
  `app/deporte/page.tsx` (`agenda | calendario | inscripciones | excursiones`),
  que es el que el componente cliente ya consume.
- `lib/kids.ts` → filtra por `tags` que incluyan `infantil`.
- `app/kids/page.tsx` y `app/deporte/page.tsx` → borran su fetch en línea.

### 7. Invariante

> Cualquier `AgendaEvento` que se renderice en una tarjeta tiene detalle.

Se hace verificable: `EventCard` deja de recalcular el href con `eventSlug()` y
recibe el `slug` ya resuelto, y un test comprueba que para todo evento del
agregado, `getEventoBySlug(e.slug)` lo encuentra.

## Fuera de alcance

- **Rate limit distribuido.** El `Map` in-memory de `middleware.ts:19` y de
  `/api/newsletter/subscribe` no se arregla aquí; necesita store compartido.
- **Auth y CORS.** Son la Fase 2, aunque el trabajo de alinear `PUBLIC_API_ROUTES`
  toca `middleware.ts`.
- **Rula y sus 8,7 MB.** Se arregla en su propio commit porque cambiar el scraper
  altera el contenido de la fuente, no solo su orquestación. Nota: el registro
  hace que la duplicación de descarga desaparezca por sí sola, pero la descarga
  en sí sigue ahí.
- **`fiestas-blanda.ts`** con fechas hardcodeadas a 2026. Es deuda de datos, no de
  orquestación.
- **Baseline de ESLint** (los 55 `no-explicit-any`).

## Riesgos

| Riesgo | Mitigación |
|---|---|
| Romper la home, que es la superficie más grande | El cambio se hace por capas: registro + `AgendaEvento` primero, vistas después. Cada capa con tests. |
| Cambiar slugs y romper URLs publicadas | Los slugs no dependen del `id` ni de la fuente. Un test fija el slug de un evento conocido para detectar cualquier deriva. |
| Perder favoritos | La migración recalcula el id desde título/fecha/enlace. Test con un favorito guardado en el formato antiguo. |
| Cambiar qué eventos salen en `/culture` al unificar | El subconjunto se define en el registro por entrada, no por vista. Un test compara el recuento de `getCultureEventos` antes y después. |
| Más llamadas a `scrapeMunicipalCalendar` en la home | El registro declara cada combinación de argumentos una vez y reparte. Se mide el número de peticiones antes y después. |
| Un scraper se rompe y ahora afecta a más vistas | `Promise.allSettled` por entrada: una fuente caída se pierde sola, se registra en Axiom y el resto de la agenda sigue saliendo. Es el comportamiento que ya tiene `agenda.ts`. |

## Testing

`__tests__/agenda.test.ts` (nuevo; hoy no existe y es el módulo que alimenta
detalle, sitemap, RSS y push):

- `id` es estable entre dos llamadas, y no contiene `crypto.randomUUID`.
- El mismo evento servido por dos fuentes con distinto enlace produce un solo
  registro, y hereda la imagen si el ganador no traía.
- Todas las entradas del registro producen al menos un evento con el fixture
  correspondiente, con el `sourceId` esperado.
- Todo evento del agregado resuelve en `getEventoBySlug(e.slug)` — el invariante
  que mata el P0.
- `normalizeCategory` se ha aplicado a todos: no queda ninguna `category` fuera
  de `CATEGORY_COLORS`.
- Cada `sourceId` del registro tiene caso en `sourceLabel`.
- Slug de un evento conocido, fijado como contrato de URL pública.
- Los favoritos del formato antiguo se recuperan tras la migración.

## Fuera de alcance del commit

`docs/superpowers/specs/2026-09-22-turismo-gastronomia-design.md` documenta el
contrato de `getProximosEventos` y de `getVisitasGuiadas`; la firma se conserva,
así que ese documento sigue siendo válido.
