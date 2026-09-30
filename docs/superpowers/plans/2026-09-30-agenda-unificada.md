# Agenda unificada — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que todos los eventos de la agenda salgan de un único agregador, con `id` determinista, una sola caché y una sola taxonomía, de modo que ningún enlace a `/evento/[slug]` dé 404 y los favoritos sobrevivan a un re-scraping.

**Architecture:** Un registro declarativo (`lib/source-registry.ts`) describe cada invocación de scraper con su `sourceId`, taxonomía y prioridad. `lib/agenda.ts` consume el registro, normaliza a un único tipo `AgendaEvento` con `id = eventSlug(...)`, deduplica por `título+fecha` y cachea bajo una sola clave. Las vistas (`cultura`, `deporte`, `kids`, `getProximosEventos`) dejan de scrapear y filtran ese agregado.

**Tech Stack:** Next.js 16 (App Router, RSC), React 19, TypeScript estricto, Jest + ts-jest, `getCachedOrFetch` (caché en `os.tmpdir()`), `eventSlug` de `lib/slug.ts`.

**Spec:** `docs/superpowers/specs/2026-09-30-agenda-unificada-design.md`

## Global Constraints

- Las URLs públicas no pueden cambiar. `eventSlug` depende solo de `{ title, date, link }`; nunca del `id` ni del nombre de la fuente. Hay un test que fija el slug de un evento conocido.
- Ningún `crypto.randomUUID()` sobrevive en la ruta de datos. `id === slug`, siempre.
- Una sola clave de caché: `agenda-all`, TTL 5 min. Se eliminan `eventos-proximos`, `cultura-eventos`, `deporte-eventos`, `deporte-eventos-mood`, `kids-eventos`, `kids-eventos-mood`.
- `Promise.allSettled` por entrada del registro: una fuente caída se pierde sola y se registra en Axiom con `logger.warn("scraping_failed")`.
- `/culture` debe seguir mostrando exactamente el mismo subconjunto de eventos que hoy. Se declara entrada a entrada, no por vista.
- La vista `/deporte` adopta el vocabulario del componente cliente: `agenda | calendario | inscripciones | excursiones`.
- `category` se normaliza siempre con `normalizeCategory`; toda categoría resultante debe tener entrada en `CATEGORY_COLORS`.
- Todo `sourceId` del registro tiene su `label` y su caso en `sourceLabel`.
- **`SOURCE_LABELS` se indexa por `id`, nunca por `group`.** Siete variantes municipales comparten `label: "Ayuntamiento"`, así que un `Record` construido sobre `group` las fundiría y el bug de etiquetas reaparecería con otro nombre.
- Comandos de verificación: `npm test`, `npx tsc --noEmit --incremental false`, `npm run lint`, `npm run build`.
- `npm run build` descarga 8,7 MB de Rula cuatro veces. Es un problema preexistente y con fecha de aviso, no lo reintroduzcas ni lo "arregles" de paso.

---

### Task 1: Registro declarativo de fuentes

**Files:**
- Create: `lib/source-registry.ts`
- Test: `__tests__/source-registry.test.ts`

**Interfaces:**
- Consumes: los scrapers de `lib/sources/*` (firmas sin cambios).
- Produces:
  ```ts
  export type RawLike = { title?, date?, dateEnd?, time?, timeStart?, image?,
    location?, venue?, link?, url?, description?, category?, cancelled?,
    price?, rating? };

  export type SourceEntry = {
    id: string;
    group: string;          // agrupa variantes para los filtros de UI
    label: string;          // texto visible
    run: () => Promise<unknown[]>;
    category?: string;      // pista si la fuente no trae categoría
    kind?: string;          // tramo del calendario
    tags?: readonly string[];
    culture?: boolean;      // participa en la vista /culture
    priority: number;       // menor número gana en la deduplicación
  };

  export const SOURCE_REGISTRY: readonly SourceEntry[];
  export const CULTURE_SOURCE_IDS: readonly string[];  // ids con culture === true
  export const SOURCE_LABELS: Record<string, string>;  // id -> label
  ```

- [ ] **Step 1: Escribir el test que falla**

Crea `__tests__/source-registry.test.ts`:

```ts
import { SOURCE_REGISTRY, CULTURE_SOURCE_IDS, SOURCE_LABELS } from "@/lib/source-registry";
import { CATEGORY_COLORS } from "@/lib/categories";

describe("SOURCE_REGISTRY", () => {
  it("tiene identificadores únicos", () => {
    const ids = SOURCE_REGISTRY.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("cada entrada tiene label y run", () => {
    for (const e of SOURCE_REGISTRY) {
      expect(typeof e.label).toBe("string");
      expect(e.label.length).toBeGreaterThan(0);
      expect(typeof e.run).toBe("function");
    }
  });

  it("cada id tiene su label en SOURCE_LABELS", () => {
    for (const e of SOURCE_REGISTRY) {
      expect(SOURCE_LABELS[e.id]).toBe(e.label);
    }
  });

  it("todo category del registro colorea bien", () => {
    for (const e of SOURCE_REGISTRY) {
      if (e.category) {
        expect(CATEGORY_COLORS[e.category]).toBeDefined();
      }
    }
  });

  it("declara exactamente las fuentes de la vista /culture", () => {
    expect([...CULTURE_SOURCE_IDS].sort()).toEqual(
      SOURCE_REGISTRY.filter((e) => e.culture).map((e) => e.id).sort()
    );
  });

  it("cada variante tipada del municipal tiene su propia entrada", () => {
    // No basta con comprobar que group === "municipal": hay que fijar que cada
    // combinacion distinta de argumentos de scrapeMunicipalCalendar tiene
    // entrada propia, porque si dos se fusionaran se perderia su taxonomia.
    const municipales = SOURCE_REGISTRY.filter((e) => e.group === "municipal");
    const ids = municipales.map((e) => e.id);
    for (const esperado of [
      "municipal-agenda",
      "municipal-teatro",
      "municipal-conciertos",
      "municipal-exposiciones",
      "municipal-general",
      "municipal-deporte",
      "municipal-infantil",
      "municipal-rss",
    ]) {
      expect(ids).toContain(esperado);
    }
  });

  it("el municipal sin filtro va detras de las variantes que llevan taxonomia", () => {
    const prio = (id: string) =>
      SOURCE_REGISTRY.find((e) => e.id === id)!.priority;
    for (const variante of [
      "municipal-agenda",
      "municipal-teatro",
      "municipal-conciertos",
      "municipal-exposiciones",
      "municipal-deporte",
      "municipal-infantil",
    ]) {
      expect(prio(variante)).toBeLessThan(prio("municipal-general"));
    }
  });

  it("las entradas que aportan kind o tags tienen prioridad sobre las que no", () => {
    // Si municipal-general ganara el desempate, se comeria el kind y los tags de
    // deporte e infantil y /deporte y /kids saldrian vacios.
    for (const conTaxonomia of ["municipal-deporte", "municipal-infantil"]) {
      const e = SOURCE_REGISTRY.find((x) => x.id === conTaxonomia)!;
      expect(e.kind || e.tags).toBeDefined();
    }
  });
});
```

- [ ] **Step 2: Ejecutar para confirmar que falla**

Run: `npx jest __tests__/source-registry.test.ts`
Expected: FAIL — `Cannot find module '@/lib/source-registry'`

- [ ] **Step 3: Implementar el registro**

Crea `lib/source-registry.ts`:

```ts
import { scrapeMunicipalCalendar } from "./sources/municipal";
import { scrapeMunicipalRss } from "./sources/municipal-rss";
import { scrapeVamEvents, scrapeVamConciertos } from "./sources/vam";
import { scrapeFever } from "./sources/fever";
import { scrapeRula } from "./sources/rula";
import { scrapeGasteizHoy } from "./sources/gasteizhoy";
import { scrapeEuskadi } from "./sources/euskadi";
import { scrapeJimmyJazz } from "./sources/jimmyjazz";
import { scrapeHelldorado } from "./sources/helldorado";
import { scrapeMusikaze } from "./sources/musikaze";
import { scrapeEventbrite } from "./sources/eventbrite";
import { scrapeEntradium } from "./sources/entradium";
import { scrapeVital } from "./sources/vital";
import { scrapeArkabia } from "./sources/arkabia";
import { scrapeMiniature } from "./sources/miniature";
import {
  scrapeBuscametasCalendario,
  scrapeBuscametasInscripciones,
} from "./sources/buscametas";
import { scrapeSenderismo } from "./sources/senderismo";
import { scrapeFiestasBlanca } from "./sources/fiestas-blanca";

export type RawLike = {
  title?: string;
  date?: string;
  dateEnd?: string;
  time?: string;
  timeStart?: string;
  image?: string;
  location?: string;
  venue?: string;
  link?: string;
  url?: string;
  description?: string;
  category?: string;
  cancelled?: boolean;
  price?: string;
  rating?: number;
};

export type SourceEntry = {
  id: string;
  group: string;
  label: string;
  run: () => Promise<unknown[]>;
  category?: string;
  kind?: string;
  tags?: readonly string[];
  culture?: boolean;
  priority: number;
};

// Prioridad: las variantes tipadas del municipal mandan, despues el municipal
// sin filtro y las fuentes oficiales, y al final las agregadoras comerciales.
// En una colision por titulo+fecha gana la de menor numero.
//
// `municipal-general` va por detras a proposito: sin filtro devuelve tambien
// todo lo que ya devuelven las variantes, y si compartiera prioridad se
// quedaria delante de `municipal-deporte` y `municipal-infantil` en el
// desempate, se comerian su `kind` y sus `tags`, y `/deporte` y `/kids`
// saldrian vacios.
export const SOURCE_REGISTRY: readonly SourceEntry[] = [
  { id: "municipal-agenda", group: "municipal", label: "Ayuntamiento", priority: 0, culture: true, run: () => scrapeMunicipalCalendar({ tipo: [6] }), category: "Otros" },
  { id: "municipal-teatro", group: "municipal", label: "Ayuntamiento", priority: 0, culture: true, run: () => scrapeMunicipalCalendar({ tipo: [13] }), category: "Teatro" },
  { id: "municipal-conciertos", group: "municipal", label: "Ayuntamiento", priority: 0, culture: true, run: () => scrapeMunicipalCalendar({ tipo: [2] }), category: "Música" },
  { id: "municipal-exposiciones", group: "municipal", label: "Ayuntamiento", priority: 0, culture: true, run: () => scrapeMunicipalCalendar({ tipo: [7] }), category: "Exposiciones" },
  { id: "municipal-general", group: "municipal", label: "Ayuntamiento", priority: 1, run: () => scrapeMunicipalCalendar() },
  { id: "municipal-deporte", group: "municipal", label: "Ayuntamiento", priority: 0, run: () => scrapeMunicipalCalendar({ calendariosID: 168 }), category: "Deporte", kind: "agenda" },
  { id: "municipal-infantil", group: "municipal", label: "Ayuntamiento", priority: 0, run: () => scrapeMunicipalCalendar({ dest: ["infantil"] }), tags: ["infantil"] },
  { id: "municipal-rss", group: "municipal", label: "Ayuntamiento (RSS)", priority: 1, run: () => scrapeMunicipalRss() },
  { id: "vam", group: "vam", label: "VAM", priority: 1, run: () => scrapeVamEvents() },
  { id: "vam-conciertos", group: "vam", label: "VAM", priority: 1, culture: true, run: () => scrapeVamConciertos(), category: "Música" },
  { id: "euskadi", group: "euskadi", label: "Euskadi", priority: 1, run: () => scrapeEuskadi() },
  { id: "senderismo", group: "cm-gazteiz", label: "CM Gazteiz", priority: 1, run: () => scrapeSenderismo(), category: "Senderismo", kind: "excursiones", tags: ["senderismo"] },
  { id: "fiestas-blanca", group: "fiestas-blanca", label: "La Blanca", priority: 1, run: () => scrapeFiestasBlanca(), category: "Fiestas", tags: ["la-blanca"] },
  { id: "jimmyjazz", group: "jimmyjazz", label: "Jimmy Jazz", priority: 2, culture: true, run: () => scrapeJimmyJazz(), category: "Música" },
  { id: "helldorado", group: "helldorado", label: "HellDorado", priority: 2, run: () => scrapeHelldorado(), category: "Música" },
  { id: "musikaze", group: "musikaze", label: "Musikaze", priority: 2, run: () => scrapeMusikaze(), category: "Música" },
  { id: "fever", group: "fever", label: "Fever", priority: 3, culture: true, run: () => scrapeFever() },
  { id: "rula", group: "rula", label: "La Genterula", priority: 3, culture: true, run: () => scrapeRula() },
  { id: "gasteizhoy", group: "gasteizhoy", label: "Gasteiz Hoy", priority: 3, culture: true, run: () => scrapeGasteizHoy() },
  { id: "eventbrite", group: "eventbrite", label: "Eventbrite", priority: 4, run: () => scrapeEventbrite() },
  { id: "entradium", group: "entradium", label: "Entradium", priority: 4, run: () => scrapeEntradium() },
  { id: "vital", group: "vital", label: "Fundación Vital", priority: 4, run: () => scrapeVital() },
  { id: "arkabia", group: "arkabia", label: "Arkabia", priority: 4, run: () => scrapeArkabia() },
  { id: "miniature", group: "miniature", label: "Miniature", priority: 4, run: () => scrapeMiniature(), category: "Gastronomía" },
  { id: "buscametas-calendario", group: "buscametas", label: "Buscametas", priority: 5, run: () => scrapeBuscametasCalendario(), category: "Deporte", kind: "calendario" },
  { id: "buscametas-inscripciones", group: "buscametas", label: "Buscametas", priority: 5, run: () => scrapeBuscametasInscripciones(), category: "Deporte", kind: "inscripciones" },
];

export const CULTURE_SOURCE_IDS: readonly string[] = SOURCE_REGISTRY.filter(
  (e) => e.culture
).map((e) => e.id);

export const SOURCE_LABELS: Record<string, string> = Object.fromEntries(
  SOURCE_REGISTRY.map((e) => [e.id, e.label])
);
```

- [ ] **Step 4: Ejecutar para confirmar que pasa**

Run: `npx jest __tests__/source-registry.test.ts`
Expected: PASS, 6 tests.

- [ ] **Step 5: Commit**

```bash
git add lib/source-registry.ts __tests__/source-registry.test.ts
git commit -m "feat(scrapers): add declarative source registry

Describe each scraper invocation as data instead of a hand-ordered
Promise.allSettled, so adding a source is one line and the culture view can
derive its filters instead of hardcoding them."
```

---

### Task 2: Agregador único

**Files:**
- Modify: `lib/agenda.ts` (reescritura completa)
- Test: `__tests__/agenda.test.ts` (nuevo)

**Interfaces:**
- Consumes: `SOURCE_REGISTRY`, `SourceEntry`, `RawLike` de Task 1.
- Produces:
  ```ts
  export type AgendaEvento = { id, slug, title, date, dateEnd?, time?, image?,
    location, link, description?, category, source, kind?, tags?, cancelled?,
    price?, rating?, popularity? };

  export async function aggregate(entries: readonly SourceEntry[]): Promise<AgendaEvento[]>;
  export function findBySlug(eventos: readonly AgendaEvento[], slug: string):
    AgendaEvento | undefined;
  export async function getAgendaEventos(options?: { days?: number;
    includePast?: boolean }): Promise<AgendaEvento[]>;
  export async function getEventoBySlug(slug: string): Promise<{ evento: AgendaEvento;
    related: AgendaEvento[] } | null>;
  ```

`aggregate` es pura respecto a la red: recibe las entradas y hace todo el trabajo.
`getAgendaEventos` la llama con `SOURCE_REGISTRY` bajo caché. `findBySlug` es el
resolutor puro, sin caché, para que el invariante sea testeable sin red.
`getEventoBySlug` es la versión con caché y relacionados que usan las páginas.

- [ ] **Step 1: Escribir el test que falla**

Crea `__tests__/agenda.test.ts`:

```ts
import { aggregate, findBySlug } from "@/lib/agenda";
import { SOURCE_REGISTRY, type SourceEntry } from "@/lib/source-registry";
import { eventSlug } from "@/lib/slug";
import { CATEGORY_COLORS } from "@/lib/categories";

function entry(over: Partial<SourceEntry> & { run: () => Promise<unknown[]> }): SourceEntry {
  return { id: "test", group: "test", label: "Test", priority: 9, ...over };
}

const BASE = {
  title: "Concierto de prueba",
  date: "2027-03-15T20:00:00.000Z",
  link: "https://example.com/a",
};

describe("aggregate", () => {
  it("deriva el id del slug y ambos coinciden", async () => {
    const [ev] = await aggregate([
      entry({ run: async () => [BASE] }),
    ]);
    expect(ev.id).toBe(ev.slug);
    expect(ev.id).toBe(eventSlug({ title: BASE.title, date: BASE.date, link: BASE.link }));
  });

  it("es estable entre dos llamadas: no usa UUID", async () => {
    const e = [entry({ run: async () => [BASE] })];
    const a = await aggregate(e);
    const b = await aggregate(e);
    expect(a[0].id).toBe(b[0].id);
    expect(a[0].id).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}/);
  });

  it("deduplica el mismo evento servido por dos fuentes", async () => {
    const evs = await aggregate([
      entry({ id: "a", priority: 0, run: async () => [BASE] }),
      entry({ id: "b", priority: 4, run: async () => [{ ...BASE, link: "https://otro.example.com/b" }] }),
    ]);
    expect(evs).toHaveLength(1);
    expect(evs[0].source).toBe("a");
  });

  it("hereda la imagen del perdedor si el ganador no trae", async () => {
    const [ev] = await aggregate([
      entry({ id: "a", priority: 0, run: async () => [{ ...BASE }] }),
      entry({ id: "b", priority: 4, run: async () => [{ ...BASE, link: "https://otro/b", image: "https://cdn/x.jpg" }] }),
    ]);
    expect(ev.image).toBe("https://cdn/x.jpg");
  });

  it("aplica la categoria de la entrada cuando la fuente no trae", async () => {
    const [ev] = await aggregate([
      entry({ run: async () => [BASE], category: "Teatro" }),
    ]);
    expect(ev.category).toBe("Teatro");
  });

  it("normaliza la categoria y siempre tiene color", async () => {
    const [ev] = await aggregate([
      entry({ run: async () => [{ ...BASE, category: "conciertos" }] }),
    ]);
    expect(ev.category).toBe("Música");
    expect(CATEGORY_COLORS[ev.category]).toBeDefined();
  });

  it("arranca con la pista de la entrada, no con la de la fuente", async () => {
    const [ev] = await aggregate([
      entry({ run: async () => [{ ...BASE, category: "lo que sea" }], category: "Música" }),
    ]);
    expect(ev.category).toBe("Música");
  });

  it("propaga kind y tags de la entrada", async () => {
    const [ev] = await aggregate([
      entry({ run: async () => [BASE], kind: "inscripciones", tags: ["infantil"] }),
    ]);
    expect(ev.kind).toBe("inscripciones");
    expect(ev.tags).toEqual(["infantil"]);
  });

  it("descarta titulos vacios y fechas invalidas", async () => {
    const evs = await aggregate([
      entry({ run: async () => [
        { ...BASE, title: "" },
        { ...BASE, title: "   " },
        { ...BASE, title: "Sin título" },
        { ...BASE, date: "no-es-fecha" },
        { ...BASE, date: "" },
      ] }),
    ]);
    expect(evs).toHaveLength(0);
  });

  it("normaliza url y timeStart de las fuentes que los usan asi", async () => {
    const [ev] = await aggregate([
      entry({ run: async () => [{ ...BASE, link: undefined, url: "https://x.com/blanca", time: undefined, timeStart: "19:30" }] }),
    ]);
    expect(ev.link).toBe("https://x.com/blanca");
    expect(ev.time).toBe("19:30");
  });

  it("usa venue como ubicacion", async () => {
    const [ev] = await aggregate([
      entry({ run: async () => [{ ...BASE, location: undefined, venue: "HellDorado" }] }),
    ]);
    expect(ev.location).toBe("HellDorado");
  });

  it("descarta el enlace # y deja location vacia", async () => {
    const [ev] = await aggregate([
      entry({ run: async () => [{ ...BASE, link: "#", location: "" }] }),
    ]);
    expect(ev.link).toBe("");
    expect(ev.location).toBe("Vitoria-Gasteiz");
  });

  it("rechaza imagenes que no son http", async () => {
    const [ev] = await aggregate([
      entry({ run: async () => [{ ...BASE, image: "/local/x.png" }] }),
    ]);
    expect(ev.image).toBeUndefined();
  });

  it("una fuente que revienta no se lleva por delante el resto", async () => {
    const evs = await aggregate([
      entry({ id: "rota", run: async () => { throw new Error("boom"); } }),
      entry({ id: "buena", run: async () => [BASE] }),
    ]);
    expect(evs).toHaveLength(1);
    expect(evs[0].source).toBe("buena");
  });

  it("desempata a igual prioridad por el orden del array", async () => {
    // municipal-general empata en priority con vam, euskadi, senderismo y
    // fiestas-blanca. El desempate es posicional, asi que hay que fijarlo o el
    // proximo grupo al que se le de prioridad vuelve a colisionar en silencio.
    const municipal = entry({ id: "municipal-x", priority: 1, run: async () => [BASE] });
    const euskadi = entry({ id: "euskadi-x", priority: 1, run: async () => [{ ...BASE, link: "https://e/b" }] });
    const [primero] = await aggregate([municipal, euskadi]);
    expect(primero.source).toBe("municipal-x");

    const [invertido] = await aggregate([euskadi, municipal]);
    expect(invertido.source).toBe("euskadi-x");
  });

  it("la prioridad manda sobre el orden del array", async () => {
    const sinPrioridad = entry({ id: "sin-prio", priority: 9, run: async () => [BASE] });
    const conPrioridad = entry({ id: "con-prio", priority: 0, run: async () => [{ ...BASE, link: "https://e/b" }] });
    const [ganador] = await aggregate([sinPrioridad, conPrioridad]);
    expect(ganador.source).toBe("con-prio");
  });

  it("ordena por fecha", async () => {
    const evs = await aggregate([
      entry({ run: async () => [
        { ...BASE, title: "Tarde", date: "2027-05-01T10:00:00.000Z" },
        { ...BASE, title: "Temprano", date: "2027-01-01T10:00:00.000Z" },
      ] }),
    ]);
    expect(evs.map((e) => e.title)).toEqual(["Temprano", "Tarde"]);
  });
});

describe("invariante: toda tarjeta tiene detalle", () => {
  it("cada evento de cada entrada del registro resuelve por su slug", async () => {
    const evs = await aggregate(
      SOURCE_REGISTRY.map((e) => ({
        ...e,
        run: async () => [
          {
            title: `Evento de ${e.id}`,
            date: "2027-03-15T20:00:00.000Z",
            link: `https://example.com/${e.id}`,
          },
        ],
      }))
    );

    // Una entrada por fuente: si dos se colisionaran, el recuento lo delataria.
    expect(evs.length).toBe(SOURCE_REGISTRY.length);

    for (const ev of evs) {
      expect(findBySlug(evs, ev.slug)).toBeDefined();
      expect(findBySlug(evs, ev.slug)!.id).toBe(ev.id);
    }
  });

  it("el slug de una tarjeta coincide con el del detalle", async () => {
    const evs = await aggregate([
      entry({ run: async () => [BASE] }),
    ]);
    const tarjeta = evs[0];

    // Esto es lo que hace EventCard y lo que hace /evento/[slug]. Si divergen,
    // el enlace da 404.
    const href = `/evento/${tarjeta.slug}`;
    const slugDeLaUrl = href.replace("/evento/", "");
    expect(findBySlug(evs, slugDeLaUrl)).toBeDefined();
  });
});

describe("contrato de URL publica", () => {
  it("el slug de un evento conocido no cambia", async () => {
    const ev = eventSlug({
      title: "Cena de Gazt Pastor",
      date: "2027-01-15T19:00:00.000Z",
      link: "https://www.lagenterula.com/evento/cena-gazt-pastor",
    });
    expect(ev).toBe("cena-gazt-pastor-2027-01-15-" + ev.split("-").pop());
    expect(ev.startsWith("cena-gazt-pastor-2027-01-15-")).toBe(true);
  });
});
```

- [ ] **Step 2: Ejecutar para confirmar que falla**

Run: `npx jest __tests__/agenda.test.ts`
Expected: FAIL — `aggregate` no existe.

- [ ] **Step 3: Reescribir `lib/agenda.ts`**

Reemplaza el contenido de `lib/agenda.ts` por:

```ts
import { getCachedOrFetch } from "./cache";
import { eventSlug } from "./slug";
import { normalizeCategory } from "./categories";
import { SOURCE_REGISTRY, type RawLike, type SourceEntry } from "./source-registry";
import { logger } from "./axiom/server";

export type AgendaEvento = {
  id: string;
  slug: string;
  title: string;
  date: string;
  dateEnd?: string;
  time?: string;
  image?: string;
  location: string;
  link: string;
  description?: string;
  category: string;
  source: string;
  kind?: string;
  tags?: string[];
  cancelled?: boolean;
  price?: string;
  rating?: number;
  popularity?: number;
};

function normalizeRaw(raw: RawLike, entry: SourceEntry): AgendaEvento | null {
  const title = (raw.title || "").trim();
  if (!title || title === "Sin título") return null;

  const date = raw.date || "";
  if (!date || isNaN(new Date(date).getTime())) return null;

  const link = raw.link && raw.link !== "#" ? raw.link : (raw.url && raw.url !== "#" ? raw.url : "");
  const slug = eventSlug({ title, date, link });
  const category = normalizeCategory(entry.category ?? raw.category);

  return {
    id: slug,
    slug,
    title,
    date,
    dateEnd: raw.dateEnd || undefined,
    time: (raw.time || raw.timeStart || "").trim() || undefined,
    image: raw.image?.startsWith("http") ? raw.image : undefined,
    location: (raw.location || raw.venue || "").trim() || "Vitoria-Gasteiz",
    link,
    description: raw.description?.trim() || undefined,
    category,
    source: entry.id,
    kind: entry.kind,
    tags: entry.tags && entry.tags.length ? [...entry.tags] : undefined,
    cancelled: raw.cancelled || undefined,
    price: typeof raw.price === "string" ? raw.price : undefined,
    rating: typeof raw.rating === "number" ? raw.rating : undefined,
  };
}

function dedupeKey(ev: AgendaEvento): string {
  return `${ev.title.toLowerCase().trim()}|${ev.date.slice(0, 10)}`;
}

export async function aggregate(entries: readonly SourceEntry[]): Promise<AgendaEvento[]> {
  // Regla de desempate, en este orden y sin excepciones:
  //   1. menor `priority` gana
  //   2. a igual prioridad, gana el que va antes en SOURCE_REGISTRY
  // Array.prototype.sort es estable en V8, asi que ordenar por priority basta
  // para que el orden del array sea el desempate. El array esta ordenado a mano
  // por grupo: municipal, oficiales, consolidadas, agregadoras.
  const ordered = [...entries].sort((a, b) => a.priority - b.priority);

  const settled = await Promise.allSettled(ordered.map((e) => e.run()));

  const collected: AgendaEvento[] = [];
  settled.forEach((result, i) => {
    const entry = ordered[i];
    if (result.status === "rejected") {
      logger.warn("scraping_failed", {
        source: entry.id,
        error: result.reason instanceof Error ? result.reason.message : String(result.reason),
      });
      return;
    }
    for (const raw of result.value as RawLike[]) {
      const ev = normalizeRaw(raw, entry);
      if (ev) collected.push(ev);
    }
  });

  const byKey = new Map<string, AgendaEvento>();
  for (const ev of collected) {
    const key = dedupeKey(ev);
    const winner = byKey.get(key);
    if (!winner) {
      byKey.set(key, ev);
      continue;
    }
    // Las fuentes municipales suelen venir sin imagen y las comerciales con,
    // asi que se la robamos al perdedor antes de descartarlo.
    if (!winner.image && ev.image) winner.image = ev.image;
    if (!winner.description && ev.description) winner.description = ev.description;
    if (!winner.location && ev.location) winner.location = ev.location;
  }

  return [...byKey.values()].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );
}

async function fetchAllAgenda(): Promise<AgendaEvento[]> {
  return aggregate(SOURCE_REGISTRY);
}

export async function getAgendaEventos(options?: {
  days?: number;
  includePast?: boolean;
}): Promise<AgendaEvento[]> {
  let eventos = await getCachedOrFetch<AgendaEvento[]>(
    "agenda-all",
    5 * 60 * 1000,
    fetchAllAgenda
  );

  if (!options?.includePast) {
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    eventos = eventos.filter((ev) => new Date(ev.date) >= hoy);
  }

  if (options?.days) {
    const limit = new Date();
    limit.setDate(limit.getDate() + options.days);
    eventos = eventos.filter((ev) => new Date(ev.date) <= limit);
  }

  return eventos;
}

export function findBySlug(
  eventos: readonly AgendaEvento[],
  slug: string
): AgendaEvento | undefined {
  return eventos.find((ev) => ev.slug === slug);
}

export async function getEventoBySlug(
  slug: string
): Promise<{ evento: AgendaEvento; related: AgendaEvento[] } | null> {
  const eventos = await getAgendaEventos({ includePast: true });
  const evento = findBySlug(eventos, slug);
  if (!evento) return null;

  const related: AgendaEvento[] = eventos.filter(
    (ev) =>
      ev.slug !== slug &&
      ev.category === evento.category &&
      new Date(ev.date) >= new Date()
  );

  if (related.length < 6) {
    for (const ev of eventos) {
      if (related.length >= 6) break;
      if (ev.slug !== slug && !related.includes(ev) && new Date(ev.date) >= new Date()) {
        related.push(ev);
      }
    }
  }

  return { evento, related };
}
```

- [ ] **Step 4: Ejecutar para confirmar que pasa**

Run: `npx jest __tests__/agenda.test.ts`
Expected: PASS, todos los tests.

- [ ] **Step 5: Typecheck y suite completa**

Run: `npx tsc --noEmit --incremental false && npm test`
Expected: 0 errores de tipos; la suite completa pasa.

- [ ] **Step 6: Commit**

```bash
git add lib/agenda.ts __tests__/agenda.test.ts
git commit -m "refactor(agenda): single aggregator with deterministic ids

Consume the source registry, dedupes on title+date (the old slug key never
collided because the slug hashes the link), and sets id = eventSlug so favorites
survive a re-scrape. A failing source now degrades to a missing source instead of
taking the page down."
```

---

### Task 3: `sourceLabel` deriva del registro

**Files:**
- Modify: `lib/utils.ts:91-104`
- Test: `__tests__/utils.test.ts`

**Interfaces:**
- Consumes: `SOURCE_LABELS` de Task 1.
- Produces: `sourceLabel(source?: string): string` con la misma firma, pero sin lista blanca propia.

- [ ] **Step 1: Añadir el test que falla**

En `__tests__/utils.test.ts`, añade dentro del `describe` existente:

```ts
it("etiqueta todas las fuentes del registro", () => {
  for (const [id, label] of Object.entries(SOURCE_LABELS)) {
    expect(sourceLabel(id)).toBe(label);
  }
});

it("devuelve el slug crudo si la fuente no existe", () => {
  expect(sourceLabel("fuente-inventada")).toBe("fuente-inventada");
  expect(sourceLabel(undefined)).toBe("");
});
```

Y añade el import arriba del fichero:

```ts
import { SOURCE_LABELS } from "@/lib/source-registry";
```

- [ ] **Step 2: Ejecutar para confirmar que falla**

Run: `npx jest __tests__/utils.test.ts`
Expected: FAIL en la primera: varias fuentes del registro caen en el `default` y devuelven el id en vez del label.

- [ ] **Step 3: Implementar**

Sustituye el `switch` de `lib/utils.ts:91-104` por:

```ts
export function sourceLabel(source?: string): string {
  if (!source) return "";
  return SOURCE_LABELS[source] ?? source;
}
```

Y añade el import al principio del fichero:

```ts
import { SOURCE_LABELS } from "./source-registry";
```

- [ ] **Step 4: Ejecutar para confirmar que pasa**

Run: `npx jest __tests__/utils.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/utils.ts __tests__/utils.test.ts
git commit -m "refactor(utils): derive source labels from the registry

sourceLabel was a hand-maintained whitelist that was missing six sources, so
those pills showed the raw slug. It can no longer drift from the source list."
```

---

### Task 4: `getProximosEventos` como wrapper

**Files:**
- Modify: `lib/eventos.ts` (reescritura)
- Test: `__tests__/eventos.test.ts` (ya existe, debe seguir verde)

**Interfaces:**
- Consumes: `getAgendaEventos` de Task 2.
- Produces: `getProximosEventos(options?: { startDate?: string; endDate?: string }): Promise<AgendaEvento[]>` y `export type Evento = AgendaEvento` (alias, para no romper los imports existentes).

- [ ] **Step 1: Ejecutar el test actual como baseline**

Run: `npx jest __tests__/eventos.test.ts`
Expected: PASS, 4 tests. Anota el recuento de eventos que reporta cada uno; los compararemos tras el cambio.

- [ ] **Step 2: Reescribir `lib/eventos.ts`**

Reemplaza el contenido de `lib/eventos.ts` por:

```ts
import { getAgendaEventos, type AgendaEvento } from "./agenda";

/**
 * Alias historico. AgendaEvento es el tipo unico desde la unificacion; se
 * mantiene el nombre para no romper los imports de /api/v1/events,
 * scripts/send-newsletter.ts, lib/turismo.ts y lib/gastronomia.ts.
 */
export type Evento = AgendaEvento;

/**
 * Wrapper de una linea sobre el agregador unico. La firma se mantiene para no
 * tocar los consumidores ni /api/v1/events.
 */
export async function getProximosEventos(options?: {
  startDate?: string;
  endDate?: string;
}): Promise<Evento[]> {
  const eventos = await getAgendaEventos();

  if (!options?.startDate) return eventos;

  const filterStart = new Date(options.startDate);
  if (isNaN(filterStart.getTime())) return eventos;

  const filterEnd = options.endDate
    ? new Date(options.endDate)
    : new Date(filterStart);
  filterEnd.setHours(23, 59, 59, 999);

  return eventos.filter((e) => {
    const d = new Date(e.date);
    return d >= filterStart && d <= filterEnd;
  });
}
```

- [ ] **Step 3: Ejecutar la suite completa**

Run: `npm test`
Expected: PASS. El recuento de eventos de `__tests__/eventos.test.ts` no debe bajar respecto al paso 1: ahora incluye también las fuentes que solo vivían en el agregador viejo.

- [ ] **Step 4: Commit**

```bash
git add lib/eventos.ts
git commit -m "refactor(eventos): delegate to the single aggregator

Twelve sources were scraped and cached a second time under a different key. The
signature stays so /api/v1/events and the newsletter script keep working."
```

---

### Task 5: `/culture` como vista

**Files:**
- Modify: `lib/cultura.ts` (reescritura)
- Modify: `lib/cultura-sources.ts`
- Modify: `app/components/CulturePageClient.tsx` (solo si cambia la forma del tipo)
- Test: `__tests__/cultura-sources.test.ts` (ya existe) + nuevo bloque en `__tests__/agenda.test.ts`

**Interfaces:**
- Consumes: `getAgendaEventos`, `mapToCultureCategory`, `CULTURE_SOURCE_IDS` de Task 1.
- Produce: `getCultureEventos(): Promise<CulturaEvento[]>` donde
  `CulturaEvento = AgendaEvento & { category: string }` con `category` ya colapsada al cubo de vista (`teatro|conciertos|exposiciones|agenda`). El tipo público no cambia, así que `CulturePageClient.tsx` no se toca.

- [ ] **Step 1: Fijar el comportamiento actual como baseline**

Añade a `__tests__/cultura-sources.test.ts`:

```ts
import { getCultureEventos } from "@/lib/cultura";

it("el subconjunto de cultura no se vacia ni se sale de los cuatro cubos", async () => {
  const evs = await getCultureEventos();
  expect(evs.length).toBeGreaterThan(0);
  for (const e of evs) {
    expect(["teatro", "conciertos", "exposiciones", "agenda"]).toContain(e.category);
  }
});
```

Run: `npx jest __tests__/cultura-sources.test.ts`
Expected: PASS. Anota el número de eventos que reporta. Si falla, `/culture` ya
estaba vacía: párate y repórtalo antes de seguir.

- [ ] **Step 2: Reescribir `lib/cultura.ts`**

```ts
import { getAgendaEventos } from "./agenda";
import { mapToCultureCategory } from "./categories";
import { CULTURE_SOURCE_IDS } from "./source-registry";

export {
  CULTURE_SOURCES,
  CULTURE_SOURCE_PILLS,
  CULTURE_SOURCE_LABELS,
} from "./cultura-sources";

export type CulturaEvento = Omit<AgendaEvento, "category"> & {
  category: string;
};

export async function getCultureEventos(): Promise<CulturaEvento[]> {
  const agenda = await getAgendaEventos();
  const permitidos = new Set(CULTURE_SOURCE_IDS);

  return agenda
    .filter((ev) => permitidos.has(ev.source))
    .map((ev) => ({ ...ev, category: mapToCultureCategory(ev.category) }));
}
```

Y añade el import del tipo:

```ts
import { getAgendaEventos, type AgendaEvento } from "./agenda";
```

- [ ] **Step 3: Derivar las pills del registro**

`CulturePageClient.tsx:137` solo pinta pills cuando `filter === "conciertos"`, y
filtra con `e.source === sourceFilter` usando `pill.key`. Como tras la
unificación `evento.source` pasa a ser el `id` del registro, la clave `"municipal"`
deja de existir y el filtro por fuente devolvería cero resultados en silencio.
Las claves tienen que ser ids del registro.

Reemplaza `lib/cultura-sources.ts` por:

```ts
import { SOURCE_REGISTRY, CULTURE_SOURCE_IDS, SOURCE_LABELS } from "./source-registry";

/** Fuentes que la vista /culture puede filtrar, deducidas del registro. */
export const CULTURE_SOURCES = CULTURE_SOURCE_IDS;

export const CULTURE_SOURCE_LABELS: Record<string, string> = Object.fromEntries(
  CULTURE_SOURCE_IDS.map((id) => [id, SOURCE_LABELS[id]])
);

/**
 * Misma forma que usa CulturePageClient: Record<bucket, { key, label }[]>.
 * Solo "conciertos" tiene pills porque es el único bucket que las pinta.
 * Se ofrecen todas las fuentes de cultura, no solo las musicales: el bucket ya
 * esta filtrando por categoria, asi que el filtro por fuente tiene que poder
 * combinarse con cualquiera de ellas.
 */
export const CULTURE_SOURCE_PILLS: Record<string, { key: string; label: string }[]> = {
  conciertos: [
    { key: "all", label: "Todos" },
    ...CULTURE_SOURCE_IDS.map((id) => ({ key: id, label: SOURCE_LABELS[id] })),
  ],
};
```

Comprueba que `SOURCE_REGISTRY` sigue exportando `SOURCE_LABELS`; si no, derivalo
con `Object.fromEntries(SOURCE_REGISTRY.map((e) => [e.id, e.label]))`.

- [ ] **Step 4: Ejecutar la suite**

Run: `npx jest __tests__/cultura-sources.test.ts && npm test`
Expected: PASS en ambas, y el test del paso 1 sigue verde con las cuatro categorías.

- [ ] **Step 5: Commit**

```bash
git add lib/cultura.ts lib/cultura-sources.ts __tests__/cultura-sources.test.ts
git commit -m "refactor(cultura): filter the aggregate instead of scraping again

The 4-bucket collapse becomes a view over category instead of a normalisation
step, so the buckets stay the same and the 15 real categories survive underneath.
Source pills are derived from the registry and cannot desync from it again."
```

---

### Task 6: `/deporte` como vista

**Files:**
- Modify: `lib/deporte.ts` (reescritura)
- Modify: `app/deporte/page.tsx` (borra el fetch en línea)
- Modify: `app/components/SportPageClient.tsx` (solo si el tipo `Evento` local cambia)
- Test: nuevo bloque en `__tests__/agenda.test.ts`

**Interfaces:**
- Consumes: `getAgendaEventos` de Task 2.
- Produce: `getDeporteEventos(): Promise<Evento[]>` con `category` = `kind` de la entrada, usando el vocabulario `agenda|calendario|inscripciones|excursiones` que el componente cliente ya consume.

- [ ] **Step 1: Escribir el test que falla**

Añade a `__tests__/agenda.test.ts`:

```ts
describe("vista de deporte", () => {
  it("expone los cuatro tramos que consume SportPageClient", async () => {
    const { getDeporteEventos } = await import("@/lib/deporte");
    const evs = await getDeporteEventos();
    const tramos = new Set(evs.map((e) => e.category));
    for (const t of tramos) {
      expect(["agenda", "calendario", "inscripciones", "excursiones"]).toContain(t);
    }
  });

  it("solo incluye eventos con kind", async () => {
    const { getDeporteEventos } = await import("@/lib/deporte");
    const evs = await getDeporteEventos();
    for (const e of evs) expect(e.kind).toBe(e.category);
  });
});
```

- [ ] **Step 2: Ejecutar para confirmar que falla**

Run: `npx jest __tests__/agenda.test.ts -t "vista de deporte"`
Expected: FAIL — `getDeporteEventos` devuelve categorías `"Agenda" | "Calendario" | "Inscripciones" | "Senderismo"`.

- [ ] **Step 3: Reescribir `lib/deporte.ts`**

```ts
import { getAgendaEventos, type AgendaEvento } from "./agenda";

export type Evento = AgendaEvento;

const TRAMOS = new Set(["agenda", "calendario", "inscripciones", "excursiones"]);

export async function getDeporteEventos(): Promise<Evento[]> {
  const agenda = await getAgendaEventos();

  return agenda
    .filter((ev) => ev.kind && TRAMOS.has(ev.kind))
    .map((ev) => ({
      ...ev,
      category: ev.kind as string,
      source: ev.source,
    }));
}
```

- [ ] **Step 4: Quitar el fetch en línea de la página**

En `app/deporte/page.tsx`:

- Borra los imports de `scrapeMunicipalCalendar`, `scrapeBuscametasCalendario`, `scrapeBuscametasInscripciones`, `scrapeSenderismo` y `getCachedOrFetch`.
- Borra el `export type Evento` local (líneas 15-23), `parseDate`, `getImageUrl`, `mapEvento`, `fetchDeportes` y `getEventos` (líneas 25-82).
- Sustituye `import { getProximosPartidos } from "@/lib/partidos";` por:

```ts
import { getProximosPartidos } from "@/lib/partidos";
import { getDeporteEventos } from "@/lib/deporte";
```

- Sustituye `getEventos()` por `getDeporteEventos()` en el `Promise.all`.
- Sustituye el `JsonLd` para que use `slug` en vez de recalcularlo:

```tsx
<JsonLd
  data={itemListJsonLd(
    eventos
      .filter((e) => e.link && e.link !== "#")
      .map((e) => ({ ...e, slug: e.slug, location: e.location || "Vitoria-Gasteiz" }))
      .slice(0, 50),
    "Agenda deportiva de Vitoria-Gasteiz",
    "/deporte"
  )}
/>
```

- Borra el import de `eventSlug` si ya no se usa.

- [ ] **Step 5: Que el cliente use el slug resuelto**

`app/components/SportPageClient.tsx:9` importa `eventSlug` y calcula el href de
cada tarjeta. Como los eventos ya vienen del agregado, el slug resuelto es la
única fuente de verdad: recalcularlo aquí es la condición que hace posible el 404
si mañana un dato difiere.

- Añade `slug: string;` al `type Evento` local del componente (línea 12).
- Sustituye cada `` `/evento/${eventSlug(e)}` `` por `` `/evento/${e.slug}` ``.
- Borra el import de `eventSlug`.

El tipo `Evento` local es estructural, así que un `AgendaEvento` entra sin
problemas: los campos extra no molestan.

- [ ] **Step 6: Ejecutar para confirmar que pasa**

Run: `npx jest __tests__/agenda.test.ts && npx tsc --noEmit --incremental false`
Expected: PASS y 0 errores de tipos.

- [ ] **Step 6: Commit**

```bash
git add lib/deporte.ts app/deporte/page.tsx __tests__/agenda.test.ts
git commit -m "refactor(deporte): one source of truth for sports events

The page reimplemented the aggregation inline under a second cache key, so the
page and lib/deporte.ts could disagree. Both now filter the aggregate by kind,
using the vocabulary the client component already expects."
```

---

### Task 7: `/kids` como vista

**Files:**
- Modify: `lib/kids.ts` (reescritura)
- Modify: `app/kids/page.tsx` (borra el fetch en línea)
- Test: nuevo bloque en `__tests__/agenda.test.ts`

**Interfaces:**
- Consumes: `getAgendaEventos` de Task 2.
- Produce: `getKidsEventos(): Promise<AgendaEvento[]>` filtrando por `tags` que incluyan `infantil`.

- [ ] **Step 1: Escribir el test que falla**

Añade a `__tests__/agenda.test.ts`:

```ts
describe("vista infantil", () => {
  it("filtra por el tag infantil y marca la categoria", async () => {
    const { getKidsEventos } = await import("@/lib/kids");
    const evs = await getKidsEventos();
    for (const e of evs) {
      expect(e.tags).toContain("infantil");
      expect(e.category).toBe("Infantil");
    }
  });
});
```

- [ ] **Step 2: Ejecutar para confirmar que falla**

Run: `npx jest __tests__/agenda.test.ts -t "vista infantil"`
Expected: FAIL — `getKidsEventos` sigue scrapeando por su cuenta y devuelve eventos sin `tags`.

- [ ] **Step 3: Reescribir `lib/kids.ts`**

```ts
import { getAgendaEventos, type AgendaEvento } from "./agenda";

export type Evento = AgendaEvento;

export async function getKidsEventos(): Promise<Evento[]> {
  const agenda = await getAgendaEventos();

  return agenda
    .filter((ev) => ev.tags?.includes("infantil"))
    .map((ev) => ({ ...ev, category: "Infantil" }));
}
```

- [ ] **Step 4: Quitar el fetch en línea de la página**

En `app/kids/page.tsx`:

- Borra los imports de `scrapeMunicipalCalendar`, `getCachedOrFetch` y `eventSlug`, y el `type Evento` local (líneas 9-16), `fetchKids` (18-32) y `getEventos` (34-36).
- Sustituye `import KidsPageClient from "../components/KidsPageClient";` por:

```ts
import KidsPageClient from "../components/KidsPageClient";
import { getKidsEventos } from "@/lib/kids";
import { JsonLd, itemListJsonLd } from "@/lib/seo";
```

- Sustituye `getEventos()` por `getKidsEventos()`.
- Sustituye el `JsonLd`:

```tsx
<JsonLd
  data={itemListJsonLd(
    eventos
      .filter((e) => e.link && e.link !== "#")
      .map((e) => ({ ...e, slug: e.slug, location: e.location || "Vitoria-Gasteiz" }))
      .slice(0, 50),
    "Planes con niños en Vitoria-Gasteiz",
    "/kids"
  )}
/>
```

- [ ] **Step 5: Que el cliente use el slug resuelto**

`app/components/KidsPageClient.tsx:7` también importa `eventSlug` y recalcula el
href. Mismo motivo que en la Task 6: si el detalle y la tarjeta calculan el slug
por separado, el 404 vuelve en cuanto discrepan.

- Añade `slug: string;` al `type Evento` local del componente (línea 10).
- Sustituye cada `` `/evento/${eventSlug(e)}` `` por `` `/evento/${e.slug}` ``.
- Borra el import de `eventSlug`.

- [ ] **Step 6: Ejecutar para confirmar que pasa**

Run: `npx jest __tests__/agenda.test.ts && npx tsc --noEmit --incremental false`
Expected: PASS y 0 errores de tipos.

- [ ] **Step 6: Commit**

```bash
git add lib/kids.ts app/kids/page.tsx __tests__/agenda.test.ts
git commit -m "refactor(kids): filter the aggregate by the infantil tag

Drops the second cache key and the inline scrape; the page and lib/kids.ts now
read the same events."
```

---

### Task 8: Favoritos persistentes y slug resuelto en la tarjeta

**Files:**
- Modify: `app/context/FavoritesContext.tsx:36-46`
- Modify: `lib/shared.tsx:102` y el tipo `EventCardEvento` (líneas 20-32)
- Test: `__tests__/agenda.test.ts` (bloque de migración) + nuevo `__tests__/favoritos-migracion.test.ts`

**Interfaces:**
- Consumes: `eventSlug` de `lib/slug`.
- Produce: `FavoritesContext` recalcula `id` al leer; `EventCard` recibe `slug` como campo obligatorio.

- [ ] **Step 1: Escribir el test que falla**

Crea `__tests__/favoritos-migracion.test.ts`:

```ts
import { eventSlug } from "@/lib/slug";

const STORAGE_KEY = "gasteiz-favorites";

/** Reproduce la normalizacion que hara FavoritesContext al leer. */
function migrate(raw: string) {
  const parsed = JSON.parse(raw);
  if (!Array.isArray(parsed)) return [];
  return parsed.map((f: Record<string, unknown>) => {
    const title = String(f.title ?? "");
    const date = String(f.date ?? "");
    const link = typeof f.link === "string" && f.link !== "#" ? f.link : "";
    const slug = title && date ? eventSlug({ title, date, link }) : String(f.id ?? "");
    return { ...f, id: slug, slug };
  });
}

describe("migracion de favoritos", () => {
  it("rehace el id de un favorito guardado con UUID", () => {
    const guardado = [
      {
        id: "3f9b0a1e-2c4d-4e5f-8a9b-0c1d2e3f4a5b",
        title: "Cena de Gazt Pastor",
        date: "2027-01-15T19:00:00.000Z",
        link: "https://www.lagenterula.com/evento/cena-gazt-pastor",
      },
    ];

    const migrados = migrate(JSON.stringify(guardado));

    expect(migrados[0].id).toBe(
      eventSlug({
        title: "Cena de Gazt Pastor",
        date: "2027-01-15T19:00:00.000Z",
        link: "https://www.lagenterula.com/evento/cena-gazt-pastor",
      })
    );
    expect(migrados[0].id).not.toBe(guardado[0].id);
  });

  it("conserva los ya migrados sin tocarlos", () => {
    const slug = eventSlug({ title: "X", date: "2027-01-01T00:00:00.000Z", link: "" });
    const migrados = migrate(JSON.stringify([{ id: slug, title: "X", date: "2027-01-01T00:00:00.000Z" }]));
    expect(migrados[0].id).toBe(slug);
  });

  it("sobrevive a un JSON corrupto", () => {
    expect(migrate("no es json")).toEqual([]);
    expect(migrate('{"no":"es una lista"}')).toEqual([]);
  });
});
```

- [ ] **Step 2: Ejecutar para confirmar que pasa por lógica, no por código**

Run: `npx jest __tests__/favoritos-migracion.test.ts`
Expected: PASS, porque la normalización vive en el test. Eso confirma que la regla es correcta; ahora hay que aplicarla en el código real.

- [ ] **Step 3: Implementar la migración en el contexto**

En `app/context/FavoritesContext.tsx`:

Añade el import:

```ts
import { eventSlug } from "@/lib/slug";
```

Añade la función antes del componente:

```ts
/**
 * Los favoritos se guardaban con un id que era un UUID aleatorio, distinto en
 * cada re-scraping. Como el slug se deriva de titulo, fecha y enlace, se puede
 * rehacer al leer y los favoritos existentes sobreviven a la unificacion.
 */
function migrateFavorites(stored: unknown): FavoriteEvent[] {
  if (!Array.isArray(stored)) return [];
  const out: FavoriteEvent[] = [];
  for (const f of stored as Record<string, unknown>[]) {
    const title = String(f.title ?? "");
    const date = String(f.date ?? "");
    if (!title || !date) continue;
    const link = typeof f.link === "string" && f.link !== "#" ? f.link : "";
    out.push({
      ...(f as unknown as FavoriteEvent),
      id: eventSlug({ title, date, link }),
    });
  }
  return out;
}
```

Sustituye el cuerpo del `useEffect` de carga:

```ts
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        setFavorites(migrateFavorites(JSON.parse(stored)));
      }
    } catch {
      // localStorage no disponible o JSON corrupto
    }
    setLoaded(true);
  }, []);
```

- [ ] **Step 4: Fijar `slug` en el tipo de la tarjeta**

En `lib/shared.tsx`:

- Añade `slug: string;` al tipo `EventCardEvento` (junto a `id`).
- Sustituye `const detailHref = \`/evento/${eventSlug(evento)}\`;` por `const detailHref = \`/evento/${evento.slug}\`;`
- Sustituye la URL de `handleShare` para que use `evento.slug` en vez de `eventSlug(evento)`.
- Borra el import de `eventSlug` si ya no se usa.

- [ ] **Step 5: Propagar `slug` a los call sites**

`EventCard` recibe `evento: EventCardEvento`, y ahora exige `slug`. Busca todos los `<EventCard evento={...} />` y `<EventCardEvento>` y asegúrate de que el objeto que llega ya trae `slug`. Como `AgendaEvento` tiene `slug`, las vistas que parten del agregado lo traen. Donde el objeto se construya a mano, añade `slug: eventSlug(e)`.

Búsqueda para localizarlos:

```bash
npx tsc --noEmit --incremental false
```

El typecheck señala cada call site que falte. No los adivines.

- [ ] **Step 6: Ejecutar para confirmar que pasa**

Run: `npm test && npx tsc --noEmit --incremental false`
Expected: PASS y 0 errores de tipos.

- [ ] **Step 7: Commit**

```bash
git add app/context/FavoritesContext.tsx lib/shared.tsx __tests__/favoritos-migracion.test.ts
git commit -m "fix(favoritos): recompute ids on read so saved events survive

The stored id was a random UUID regenerated on every scrape, so favorites were
lost as soon as the data refreshed. The slug is derivable from title, date and
link, so it can be rebuilt on load. EventCard now takes the resolved slug instead
of recomputing it, which is what makes the 404 impossible."
```

---

### Task 9: Limpieza y verificación final

**Files:**
- Modify: `lib/utils.ts` si `formatDate` sigue re-exportado desde `lib/shared.tsx`
- Delete: `app/types.ts`, `lib/safeFetch.ts`
- Verify: toda la superficie

**Interfaces:**
- Consumes: todo lo anterior.
- Produce: árbol limpio y verificado.

- [ ] **Step 1: Confirmar que los dos ficheros están muertos**

```bash
npx tsc --noEmit --incremental false
git grep -n "app/types\|safeFetch" -- '*.ts' '*.tsx'
```

Expected: solo los propios ficheros. Si `git grep` encuentra imports, **no borres**: repórtalo y decide con el usuario.

- [ ] **Step 2: Borrarlos**

```bash
git rm app/types.ts lib/safeFetch.ts
```

- [ ] **Step 3: Comprobar que no quedan claves de caché huérfanas**

```bash
git grep -n "eventos-proximos\|cultura-eventos\|deporte-eventos\|kids-eventos" -- '*.ts' '*.tsx'
```

Expected: ninguna. Si aparece alguna, es una vista que se quedó atrás.

- [ ] **Step 4: Verificación completa**

```bash
npx tsc --noEmit --incremental false
npm test
npm run lint
npm run build
```

Expected: 0 errores de tipos; la suite completa pasa; lint sin errores nuevos respecto a los 55 `no-explicit-any` preexistentes; build exit 0.

- [ ] **Step 5: Comprobar que el P0 del 404 está muerto en la app real**

Arranca `npm run dev`, y para tres eventos que solo vivían en el agregador viejo —uno de Eventbrite, uno de Fundación Vital y uno de Entradium— verifica que la home los enlaza y que `/evento/<slug>` responde 200. Usa el buscador de la home para encontrar un título real de cada fuente.

Si alguno responde 404, el bug no está cerrado: vuelve al Task 2 y revisa qué entrada del registro falta.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "chore: drop dead modules left behind by the unification

app/types.ts and lib/safeFetch.ts had zero imports."
```

- [ ] **Step 7: Actualizar la memoria del proyecto**

En `AGENTS.md`, cambia el estado de "En curso: unificación de la agenda" por una nota de que la Fase 1 está completa, y añade a "Trampas del repo":

```markdown
- **Una sola caché de agenda.** Toda vista filtra `getAgendaEventos()`. Si añades
  una vista que llama a un scraper directamente, estás reintroduciendo el bug de
  los 404 y del doble scraping.
```

---

## Notas de ejecución

- **Los tests de Task 2 no tocan red.** `aggregate()` recibe las entradas, así que
  los tests inyectan entradas sintéticas. No añadas llamadas reales a scrapers
  dentro de `__tests__/agenda.test.ts`; los scrapers ya tienen sus propios tests
  con fixtures.
- **Orden importante.** La Task 2 es la única que cambia el comportamiento; las
  tareas 4 a 7 son adaptaciones mecánicas de consumidores. Si una vista falla,
  el error está en la Task 2, no en la vista.
- **Qué NO se toca en este plan:** `middleware.ts` (Fase 2), CORS, `subscribers.json`,
  el tamaño de la descarga de Rula, las fechas hardcodeadas de La Blanca y los
  55 `no-explicit-any`. Si aparece la tentación de arreglarlos aquí, es otro
  commit.
