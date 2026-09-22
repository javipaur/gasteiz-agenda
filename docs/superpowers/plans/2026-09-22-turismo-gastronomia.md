# Turismo y Gastronomía Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Añadir a Gasteiz Click dos nuevas secciones (/turismo, /gastronomia) con contenido curado + feeds de la agenda existente, arreglar el bug de la fuente Rula en /culture, y mantener el diseño y WCAG AA.

**Architecture:** Capa de datos híbrida — ficheros JSON curados en `data/turismo/` y `data/gastronomia/` cargados por un `lib/curated.ts`, más filtros sobre `getProximosEventos()` para visitas guiadas y eventos gastronómicos. Páginas server + client components siguiendo el patrón de `/culture` y `/deporte`. Fix de Cultura moviendo el mapeo de fuentes a `lib/cultura.ts`.

**Tech Stack:** Next.js 16 (App Router, RSC), React 19, TypeScript, Tailwind CSS 4, Jest, Playwright, lucide-react.

**Spec:** `docs/superpowers/specs/2026-09-22-turismo-gastronomia-design.md`

## Global Constraints

- Report Imagen remotos ya permitidos: `next.config.ts` tiene `remotePatterns` abiertos (`hostname: "**"`) — no tocar.
- Sin dependencias nuevas (no añadir libs a `package.json`).
- Patrón de tarjeta existente: `double-bezel` + `double-bezel-outer` + `card-hover` en `app/globals.css`.
- Tipos base de eventos: `Evento` en `lib/eventos.ts`, `CulturaEvento` en `lib/cultura.ts`.
- Toda página nueva usa `revalidate = 300`, `generateMetadata` y `JsonLd` igual que `/culture`.
- Texto en español. Badge de sitios recomendados: label `Recomendado`.
- `alt=""` para imágenes decorativas, `aria-pressed` en botones de filtro, un solo `h1` por página.
- Sin cambios en `BottomNav.tsx`.

---

### Task 1: Fix fuente Rula en Cultura + test de regresión

**Files:**
- Modify: `lib/cultura.ts` (añadir constantes + extraer `CULTURE_SOURCES`)
- Modify: `app/components/CulturePageClient.tsx:30-49,142,266` (borrar constantes locales, importar las compartidas)
- Test: `__tests__/cultura-sources.test.ts`

**Interfaces:**
- Produces: `CULTURE_SOURCES` (`readonly string[]`), `CULTURE_SOURCE_PILLS: Record<string, { key: string; label: string }[]>`, `CULTURE_SOURCE_LABELS: Record<string, string>`.

- [ ] **Step 1: Write the failing test** — `__tests__/cultura-sources.test.ts`

```ts
import { CULTURE_SOURCES, CULTURE_SOURCE_LABELS, CULTURE_SOURCE_PILLS } from "@/lib/cultura";

describe("cultura source mapping", () => {
  it("cada fuente emitida por fetchCultura tiene pill y label", () => {
    const pillKeys = CULTURE_SOURCE_PILLS.conciertos.map((p) => p.key);
    for (const source of CULTURE_SOURCES) {
      expect(pillKeys).toContain(source);
      expect(CULTURE_SOURCE_LABELS[source]).toBeTruthy();
    }
  });

  it("la clave antigua lagenterula no existe", () => {
    expect(CULTURE_SOURCE_LABELS.lagenterula).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest __tests__/cultura-sources.test.ts`
Expected: FAIL — `Cannot find module "@/lib/cultura"` exports.

- [ ] **Step 3: Modify `lib/cultura.ts`** — añadir tras los imports y antes de `CulturaEvento`:

```ts
export const CULTURE_SOURCES = [
  "municipal",
  "jimmyjazz",
  "vam",
  "fever",
  "rula",
  "gasteizhoy",
] as const;

export const CULTURE_SOURCE_PILLS: Record<string, { key: string; label: string }[]> = {
  conciertos: [
    { key: "all", label: "Todos" },
    { key: "jimmyjazz", label: "Jimmy Jazz" },
    { key: "vam", label: "VAM Cultura" },
    { key: "municipal", label: "Agenda" },
    { key: "fever", label: "Fever" },
    { key: "rula", label: "Rula" },
    { key: "gasteizhoy", label: "Gasteiz Hoy" },
  ],
};

export const CULTURE_SOURCE_LABELS: Record<string, string> = {
  jimmyjazz: "Jimmy Jazz",
  vam: "VAM Cultura",
  municipal: "Agenda Municipal",
  fever: "Fever",
  rula: "Rula",
  gasteizhoy: "Gasteiz Hoy",
};
```

- [ ] **Step 4: Update `app/components/CulturePageClient.tsx`**

Borrar las constantes locales `SOURCE_PILLS` (líneas 30-40) y `SOURCE_LABELS` (42-49). Añadir import:

```ts
import { CULTURE_SOURCE_PILLS, CULTURE_SOURCE_LABELS } from "@/lib/cultura";
```

Reemplazar usos:
- `SOURCE_PILLS.conciertos` → `CULTURE_SOURCE_PILLS.conciertos`
- `SOURCE_LABELS[evento.source] || evento.source` → `CULTURE_SOURCE_LABELS[evento.source] || evento.source`

- [ ] **Step 5: Run tests**

Run: `npx jest __tests__/cultura-sources.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add lib/cultura.ts app/components/CulturePageClient.tsx __tests__/cultura-sources.test.ts
git commit -m "fix(cultura): fuente Rula (lagenterula->rula) y test de regresión"
```

---

### Task 2: `lib/curated.ts` — loader y utilidades

**Files:**
- Create: `lib/curated.ts`
- Test: `__tests__/curated.test.ts`

**Interfaces:**
- Produces:
  - `type Coords = { lat: number; lng: number }`
  - `function getCurated<T>(relPath: string): Promise<T>` — lee `data/<relPath>` desde `process.cwd()`, cachea en un `Map`.
  - `function mapsLink(coords?: Coords): string | undefined` — `https://www.google.com/maps/search/?api=1&query=${lat},${lng}` si hay coords.

- [ ] **Step 1: Write the failing test** — `__tests__/curated.test.ts`

```ts
import { getCurated, mapsLink } from "@/lib/curated";

describe("mapsLink", () => {
  it("genera URL de Google Maps a partir de coords", () => {
    expect(mapsLink({ lat: 42.8508, lng: -2.6731 })).toBe(
      "https://www.google.com/maps/search/?api=1&query=42.8508,-2.6731"
    );
  });

  it("devuelve undefined sin coords", () => {
    expect(mapsLink()).toBeUndefined();
  });
});

describe("getCurated", () => {
  it("lee un JSON curado existente", async () => {
    const data = await getCurated<{ name: string }>("fixtures/curated-test.json");
    expect(data.name).toBe("ok");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest __tests__/curated.test.ts`
Expected: FAIL — `Cannot find module "@/lib/curated"`.

- [ ] **Step 3: Create fixture** — `data/fixtures/curated-test.json`

```json
{ "name": "ok" }
```

- [ ] **Step 4: Implement `lib/curated.ts`**

```ts
import fs from "fs/promises";
import path from "path";

export type Coords = { lat: number; lng: number };

const memCache = new Map<string, unknown>();

export async function getCurated<T>(relPath: string): Promise<T> {
  if (memCache.has(relPath)) return memCache.get(relPath) as T;
  const filePath = path.join(process.cwd(), "data", relPath);
  const raw = await fs.readFile(filePath, "utf-8");
  const data = JSON.parse(raw) as T;
  memCache.set(relPath, data);
  return data;
}

export function mapsLink(coords?: Coords): string | undefined {
  if (!coords) return undefined;
  return `https://www.google.com/maps/search/?api=1&query=${coords.lat},${coords.lng}`;
}
```

- [ ] **Step 5: Run tests**

Run: `npx jest __tests__/curated.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add lib/curated.ts data/fixtures/curated-test.json __tests__/curated.test.ts
git commit -m "feat: loader de datos curados y utilidades"
```

---

### Task 3: Datos curados de turismo — qué ver + lib/turismo.ts

**Files:**
- Create: `data/turismo/que-ver.json`
- Create: `lib/turismo.ts`
- Test: `__tests__/turismo.test.ts`

**Interfaces:**
- Consumes: `getCurated`, `Coords` de `lib/curated.ts`; `Evento`, `getProximosEventos` de `lib/eventos.ts`.
- Produces:
  - `type FichaCurada = { slug: string; nombre: string; imagen?: string; descripcion: string; zona?: string; coords?: Coords; linkMaps?: string; linkOficial?: string; tags?: string[] }`
  - `type Ruta = { slug: string; nombre: string; dificultad: "Baja" | "Media" | "Alta"; duracion: string; distancia: string; puntoSalida: string; coords?: Coords; linkMaps?: string; imagen?: string; descripcion: string }`
  - `type InfoPractica = { intro: string; bloques: Array<{ id: string; titulo: string; icono: string; items: string[] }> }`
  - `getQueVer(): Promise<FichaCurada[]>`
  - `getRutasTurismo(): Promise<Ruta[]>`
  - `getInfoPractica(): Promise<InfoPractica>`
  - `getVisitasGuiadas(): Promise<Evento[]>`

- [ ] **Step 1: Write the failing test** — `__tests__/turismo.test.ts`

```ts
import { getQueVer, getRutasTurismo, getInfoPractica } from "@/lib/turismo";

const REQUIRED = ["slug", "nombre", "descripcion"] as const;

describe("turismo curado", () => {
  it("qué ver: invariantes de estructura", async () => {
    const items = await getQueVer();
    expect(items.length).toBeGreaterThanOrEqual(5);
    for (const item of items) {
      for (const k of REQUIRED) expect(item[k]).toBeTruthy();
      if (item.coords) {
        expect(typeof item.coords.lat).toBe("number");
        expect(typeof item.coords.lng).toBe("number");
      }
      if (item.linkMaps) expect(item.linkMaps).toMatch(/^https:\/\//);
      if (item.slug) expect(item.slug).toMatch(/^[a-z0-9-]+$/);
    }
  });

  it("rutas: invariantes de estructura", async () => {
    const rutas = await getRutasTurismo();
    expect(rutas.length).toBeGreaterThanOrEqual(2);
    for (const r of rutas) {
      expect(["Baja", "Media", "Alta"]).toContain(r.dificultad);
      expect(r.duracion).toBeTruthy();
      expect(r.puntoSalida).toBeTruthy();
    }
  });

  it("info práctica: tiene intro y bloques", async () => {
    const info = await getInfoPractica();
    expect(info.intro).toBeTruthy();
    expect(info.bloques.length).toBeGreaterThanOrEqual(3);
    for (const b of info.bloques) {
      expect(b.titulo).toBeTruthy();
      expect(b.items.length).toBeGreaterThan(0);
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest __tests__/turismo.test.ts`
Expected: FAIL — `Cannot find module "@/lib/turismo"`.

- [ ] **Step 3: Create `data/turismo/que-ver.json`**

```json
[
  {
    "slug": "catedral-santa-maria",
    "nombre": "Catedral de Santa María",
    "descripcion": "La 'catedral abierta' alberga el centro de interpretación y permite visitas por la restauración en vivo del templo gótico.",
    "zona": "Casco Viejo",
    "coords": { "lat": 42.8488, "lng": -2.6735 },
    "linkOficial": "https://catedralvitoria.eus",
    "tags": ["patrimonio", "visita guiada"]
  },
  {
    "slug": "casco-viejo",
    "nombre": "Casco Medieval",
    "descripcion": "Calles estrechas con palacios renacentistas, la plaza del Machete y el toldo verde architectónico más famoso de la ciudad.",
    "zona": "Casco Viejo",
    "coords": { "lat": 42.8483, "lng": -2.6741 },
    "tags": ["paseo", "arquitectura"]
  },
  {
    "slug": "plaza-virgen-blanca",
    "nombre": "Plaza de la Virgen Blanca",
    "descripcion": "El corazón de Vitoria-Gasteiz, con el monumento a la Batalla de Vitoria y animación constante.",
    "zona": "Centro",
    "coords": { "lat": 42.8472, "lng": -2.6716 },
    "tags": ["paseo", "arquitectura"]
  },
  {
    "slug": "artium",
    "nombre": "Museo Artium",
    "descripcion": "Museo de Arte Contemporáneo del País Vasco: exposiciones temporales y núcleo permanente de artistas vascos.",
    "zona": "Centro",
    "coords": { "lat": 42.8459, "lng": -2.6695 },
    "linkOficial": "https://www.artium.eus",
    "tags": ["museo", "arte"]
  },
  {
    "slug": "anillo-verde",
    "nombre": "Anillo Verde",
    "descripcion": "Cinturón de parques y humedales que rodea la ciudad, ideal para caminar y ver aves a pocos minutos del centro.",
    "zona": "Periferia",
    "coords": { "lat": 42.8544, "lng": -2.6803 },
    "tags": ["naturaleza", "senderismo"]
  },
  {
    "slug": "parque-florida",
    "nombre": "Parque de La Florida",
    "descripcion": "Jardín romántico junto a la Virgen Blanca con el famoso 'túnel de castaños de Indias'.",
    "zona": "Centro",
    "coords": { "lat": 42.8457, "lng": -2.6704 },
    "tags": ["naturaleza", "paseo"]
  }
]
```

- [ ] **Step 4: Implement `lib/turismo.ts`**

```ts
import { getCurated, mapsLink, type Coords } from "./curated";
import { getProximosEventos, type Evento } from "./eventos";

export type FichaCurada = {
  slug: string;
  nombre: string;
  imagen?: string;
  descripcion: string;
  zona?: string;
  coords?: Coords;
  linkMaps?: string;
  linkOficial?: string;
  tags?: string[];
};

export type Ruta = {
  slug: string;
  nombre: string;
  dificultad: "Baja" | "Media" | "Alta";
  duracion: string;
  distancia: string;
  puntoSalida: string;
  coords?: Coords;
  linkMaps?: string;
  imagen?: string;
  descripcion: string;
};

export type InfoPractica = {
  intro: string;
  bloques: Array<{ id: string; titulo: string; icono: string; items: string[] }>;
};

function withMapLink<T extends { coords?: Coords; linkMaps?: string }>(item: T): T {
  if (!item.linkMaps) item.linkMaps = mapsLink(item.coords) as string | undefined;
  return item;
}

export async function getQueVer(): Promise<FichaCurada[]> {
  const items = await getCurated<Omit<FichaCurada, "linkMaps">[]>("turismo/que-ver.json");
  return items.map(withMapLink);
}

export async function getRutasTurismo(): Promise<Ruta[]> {
  const rutas = await getCurated<Omit<Ruta, "linkMaps">[]>("turismo/rutas.json");
  return rutas.map(withMapLink);
}

export async function getInfoPractica(): Promise<InfoPractica> {
  return getCurated<InfoPractica>("turismo/info-practica.json");
}

export async function getVisitasGuiadas(): Promise<Evento[]> {
  const eventos = await getProximosEventos();
  return eventos.filter(
    (e) =>
      e.category === "Visitas" ||
      /visita guiada|tour|itinerario/i.test(`${e.title} ${e.description || ""}`)
  );
}
```

Nota: `withMapLink` asigna `item.linkMaps` (mutable) para que `getQueVer`/`getRutasTurismo` devuelvan el enlace aunque el JSON no lo lleve.

- [ ] **Step 5: Run tests (fallará parcialmente — falta rutas.json y info-practica.json, se crean en la Task 4)**

Run: `npx jest __tests__/turismo.test.ts`
Expected: FAIL — `ENOENT turismo/rutas.json`. Corrección: crear ya ambos ficheros mínimos para dejar la task verde (paso 6).

- [ ] **Step 6: Create `data/turismo/rutas.json`**

```json
[
  {
    "slug": "salburua",
    "nombre": "Ruta de los Humedales de Salburua",
    "dificultad": "Baja",
    "duracion": "1 h 30 min",
    "distancia": "6 km",
    "puntoSalida": "Centro de Interpretación de Salburua (Ataria)",
    "coords": { "lat": 42.8544, "lng": -2.6495 },
    "descripcion": "Senda circular por el humedal urbano Ramsar: observatorio de aves, lagunas de Arkaute y Betoño."
  },
  {
    "slug": "olarizu",
    "nombre": "Parque de Olarizu y Jardín Botánico",
    "dificultad": "Baja",
    "duracion": "1 h 30 min",
    "distancia": "5,5 km",
    "puntoSalida": "Casa de Deportes de Olarizu",
    "coords": { "lat": 42.8347, "lng": -2.669 },
    "descripcion": "Campas, arboleda y jardín botánico; enlaza con el puente de las cuarenta pilas hacia el centro."
  },
  {
    "slug": "zadorra",
    "nombre": "Senda del Zadorra por Zabalgana",
    "dificultad": "Media",
    "duracion": "2 h",
    "distancia": "9 km",
    "puntoSalida": "Embalse de Zabalgana",
    "coords": { "lat": 42.8287, "lng": -2.7171 },
    "descripcion": "Paseo junto al río y los humedales de Zabalgana; en invierno se concentran aves acuáticas."
  }
]
```

- [ ] **Step 7: Create `data/turismo/info-practica.json`**

```json
{
  "intro": "Vitoria-Gasteiz es la capital verde de Euskadi: pequeña, caminable y con el Anillo Verde a las puertas del centro.",
  "bloques": [
    {
      "id": "llegar",
      "titulo": "Cómo llegar",
      "icono": "train",
      "items": [
        "Tren: estación de Vitoria-Gasteiz (Renfe Cercanías y Media Distancia) a 10 min andando del centro.",
        "Autobús: estación de autobuses junto a la estación de tren, líneas urbanas e interurbanas de Euskotren/TUVISA.",
        "Avión: Vitoria está a 1 h 15 min del aeropuerto de Bilbao y a 1 h 30 min del de Vitoria-Foronda (vuelos chárter)."
      ]
    },
    {
      "id": "moverse",
      "titulo": "Moverse por la ciudad",
      "icono": "bus",
      "items": [
        "El centro y el Casco Viejo se recorren a pie en 15-20 minutos.",
        "Tranvía y autobuses urbanos de TUVISA conectan barrios y aparcamientos disuasorios.",
        "El servicio público de bicicletas convierte el Anillo Verde en un plan accesible."
      ]
    },
    {
      "id": "dormir",
      "titulo": "Dónde dormir",
      "icono": "bed",
      "items": [
        "Casco Viejo: hoteles boutique y casas de huéspedes cerca de la zona de pintxos.",
        "Centro/Ensanche: oferta hotelera media y alta junto a la Virgen Blanca.",
        "Paradores y hoteles rurales en los pueblos del entorno (a 15-30 minutos)."
      ]
    },
    {
      "id": "consejos",
      "titulo": "Consejos útiles",
      "icono": "info",
      "items": [
        "La oferta cultural más amplia se concentra de jueves a domingo.",
        "Consulta la agenda de Gasteiz Click cada viernes para no perderte nada.",
        "En agosto, la Virgen Blanca llena la ciudad; reserva alojamiento con antelación."
      ]
    }
  ]
}
```

- [ ] **Step 8: Run tests**

Run: `npx jest __tests__/turismo.test.ts`
Expected: PASS

- [ ] **Step 9: Commit**

```bash
git add lib/turismo.ts data/turismo __tests__/turismo.test.ts
git commit -m "feat(turismo): qué ver, rutas e info práctica curados"
```

---

### Task 4: Datos curados de gastronomía + lib/gastronomia.ts

**Files:**
- Create: `data/gastronomia/sitios.json`
- Create: `data/gastronomia/rutas-pintxos.json`
- Create: `lib/gastronomia.ts`
- Test: `__tests__/gastronomia.test.ts`

**Interfaces:**
- Consumes: `getCurated`, `mapsLink`, `Coords` de `lib/curated.ts`; `Evento`, `getProximosEventos` de `lib/eventos.ts`.
- Produces:
  - `type Sitio = { slug: string; nombre: string; barrio: string; tipoCocina: string; rangoPrecio: "€" | "€€" | "€€€"; direccion: string; coords?: Coords; linkMaps?: string; imagen?: string; descripcion: string; recomendado?: boolean }`
  - `type ParadaPintxo = { nombre: string; direccion: string; pintxo: string; precio: string }`
  - `type RutaPintxo = { slug: string; zona: string; nombre: string; paradas: ParadaPintxo[]; duracion: string; consejo?: string }`
  - `getSitios(): Promise<Sitio[]>`
  - `getRutasPintxos(): Promise<RutaPintxo[]>`
  - `getEventosGastronomia(): Promise<Evento[]>`

- [ ] **Step 1: Write the failing test** — `__tests__/gastronomia.test.ts`

```ts
import { getSitios, getRutasPintxos } from "@/lib/gastronomia";

describe("gastronomía curada", () => {
  it("sitios: invariantes de estructura", async () => {
    const sitios = await getSitios();
    expect(sitios.length).toBeGreaterThanOrEqual(6);
    for (const s of sitios) {
      expect(s.nombre).toBeTruthy();
      expect(s.barrio).toBeTruthy();
      expect(["€", "€€", "€€€"]).toContain(s.rangoPrecio);
      expect(s.direccion).toBeTruthy();
      if (s.coords) {
        expect(typeof s.coords.lat).toBe("number");
        expect(typeof s.coords.lng).toBe("number");
      }
      expect(s.slug).toMatch(/^[a-z0-9-]+$/);
    }
  });

  it("rutas de pintxos: al menos 3 zonas con paradas", async () => {
    const rutas = await getRutasPintxos();
    expect(rutas.length).toBeGreaterThanOrEqual(3);
    for (const r of rutas) {
      expect(r.nombre).toBeTruthy();
      expect(r.zona).toBeTruthy();
      expect(r.paradas.length).toBeGreaterThanOrEqual(3);
      for (const p of r.paradas) expect(p.pintxo).toBeTruthy();
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest __tests__/gastronomia.test.ts`
Expected: FAIL — `Cannot find module "@/lib/gastronomia"`.

- [ ] **Step 3: Create `data/gastronomia/sitios.json`**

```json
[
  {
    "slug": "tximitxurri",
    "nombre": "Tximitxurri",
    "barrio": "Casco Viejo",
    "tipoCocina": "Pintxos",
    "rangoPrecio": "€",
    "direccion": "Calle Correría, 15",
    "coords": { "lat": 42.8489, "lng": -2.6744 },
    "descripcion": "Referencia de la ruta de pintxos del Casco Viejo, con elaboraciones premiadas en concursos locales.",
    "recomendado": true
  },
  {
    "slug": "sagartoki",
    "nombre": "Sagartoki",
    "barrio": "Ensanche",
    "tipoCocina": "Vasca",
    "rangoPrecio": "€€",
    "direccion": "Calle de la Herrería, 12",
    "coords": { "lat": 42.8473, "lng": -2.6725 },
    "descripcion": "Cocina de mercado con toque creativo en platos de cuchara y brasa.",
    "recomendado": true
  },
  {
    "slug": "portalon",
    "nombre": "Portalón",
    "barrio": "Casco Viejo",
    "tipoCocina": "Tradicional",
    "rangoPrecio": "€€€",
    "direccion": "Calle Correría, 163",
    "coords": { "lat": 42.8484, "lng": -2.6749 },
    "descripcion": "Asador histórico en un palacio del siglo XV: chuletón al punto y cocina tradicional alavesa."
  },
  {
    "slug": "el-hermano-de-anto",
    "nombre": "El hermano de Anto",
    "barrio": "Centro",
    "tipoCocina": "Pintxos",
    "rangoPrecio": "€",
    "direccion": "Calle San Antonio, 9",
    "coords": { "lat": 42.8458, "lng": -2.6715 },
    "descripcion": "Barra de pintxos moderna junto a La Florida; la 'gilda verde' es casi obligada."
  },
  {
    "slug": "la-quimera",
    "nombre": "La Quimera",
    "barrio": "Centro",
    "tipoCocina": "Mexicana",
    "rangoPrecio": "€€",
    "direccion": "Calle de la Pintorería, 35",
    "coords": { "lat": 42.8471, "lng": -2.6756 },
    "descripcion": "Comida mexicana de verdad para variar la ruta de pintxos tradicionales."
  },
  {
    "slug": "zarra",
    "nombre": "Zarra",
    "barrio": "Casco Viejo",
    "tipoCocina": "Pintxos",
    "rangoPrecio": "€",
    "direccion": "Calle Herrería, 1",
    "coords": { "lat": 42.8476, "lng": -2.6736 },
    "descripcion": "Clásico de la Herrería con pintxo de txistorra y propuestas de temporada.",
    "recomendado": true
  }
]
```

- [ ] **Step 4: Create `data/gastronomia/rutas-pintxos.json`**

```json
[
  {
    "slug": "casco-viejo",
    "zona": "Casco Viejo",
    "nombre": "Ruta clásica del Casco Viejo",
    "duracion": "2-3 h",
    "consejo": "Empezad en la subida de la Correría y bajad hacia la Herrería; los jueves hay ambiente extra.",
    "paradas": [
      { "nombre": "Tximitxurri", "direccion": "Correría, 15", "pintxo": "Gilda de autor", "precio": "3,50 €" },
      { "nombre": "Zarra", "direccion": "Herrería, 1", "pintxo": "Txistorra con pimiento", "precio": "3,00 €" },
      { "nombre": "Gasteiz", "direccion": "Cuchillería, 34", "pintxo": "Huevos rotos con txistorra", "precio": "3,50 €" },
      { "nombre": "Portalón", "direccion": "Correría, 163", "pintxo": "Pincho de buen pastor", "precio": "4,00 €" }
    ]
  },
  {
    "slug": "centro",
    "zona": "Centro",
    "nombre": "Ruta del Centro y La Florida",
    "duracion": "2 h",
    "consejo": "Aprovechad el paseo por el parque de La Florida entre pintxo y pintxo.",
    "paradas": [
      { "nombre": "El hermano de Anto", "direccion": "San Antonio, 9", "pintxo": "Gilda verde", "precio": "3,00 €" },
      { "nombre": "La Reineta", "direccion": "Dato, 7", "pintxo": "Hamburguesa en miniatura", "precio": "3,50 €" },
      { "nombre": "Alcotán", "direccion": "Gaztelako Atea, 12", "pintxo": "Risotto trufado", "precio": "4,00 €" }
    ]
  },
  {
    "slug": "ensanche",
    "zona": "Ensanche",
    "nombre": "Ruta del Ensanche",
    "duracion": "2 h",
    "consejo": "Bares más amplios y tranquilos; buen plan para terminar el día sin esperas largas.",
    "paradas": [
      { "nombre": "Sagartoki", "direccion": "Herrería, 12", "pintxo": "Croquetas de jamón", "precio": "3,50 €" },
      { "nombre": "Bliss", "direccion": "San Prudencio, 22", "pintxo": "Torre de huevas de trucha", "precio": "4,00 €" },
      { "nombre": "Kultur", "direccion": "Postas, 7", "pintxo": "Ensaladilla con queso Idiazábal", "precio": "3,50 €" }
    ]
  }
]
```

- [ ] **Step 5: Implement `lib/gastronomia.ts`**

```ts
import { getCurated, mapsLink, type Coords } from "./curated";
import { getProximosEventos, type Evento } from "./eventos";

export type Sitio = {
  slug: string;
  nombre: string;
  barrio: string;
  tipoCocina: string;
  rangoPrecio: "€" | "€€" | "€€€";
  direccion: string;
  coords?: Coords;
  linkMaps?: string;
  imagen?: string;
  descripcion: string;
  recomendado?: boolean;
};

export type ParadaPintxo = {
  nombre: string;
  direccion: string;
  pintxo: string;
  precio: string;
};

export type RutaPintxo = {
  slug: string;
  zona: string;
  nombre: string;
  paradas: ParadaPintxo[];
  duracion: string;
  consejo?: string;
};

export async function getSitios(): Promise<Sitio[]> {
  const sitios = await getCurated<Omit<Sitio, "linkMaps">[]>("gastronomia/sitios.json");
  return sitios.map((s) => (s.linkMaps ? s : { ...s, linkMaps: mapsLink(s.coords) as string | undefined }));
}

export async function getRutasPintxos(): Promise<RutaPintxo[]> {
  return getCurated<RutaPintxo[]>("gastronomia/rutas-pintxos.json");
}

export async function getEventosGastronomia(): Promise<Evento[]> {
  const eventos = await getProximosEventos();
  return eventos.filter((e) => e.category === "Gastronomía");
}
```

- [ ] **Step 6: Run tests**

Run: `npx jest __tests__/gastronomia.test.ts`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add lib/gastronomia.ts data/gastronomia __tests__/gastronomia.test.ts
git commit -m "feat(gastronomia): directorio de sitios y rutas de pintxos curados"
```

---

### Task 5: Token `--amber` para gastronomía

**Files:**
- Modify: `app/globals.css:25,50-51,76-77,89-97`

- [ ] **Step 1: Añadir el token a `:root`** (tras la línea `--teal-wash: ...` en `:root`):

```css
  --amber: #E8A33D;
  --amber-subtle: #FFF3DC;
  --amber-soft: rgba(232, 163, 61, 0.12);
  --amber-wash: rgba(232, 163, 61, 0.08);
```

- [ ] **Step 2: Añadirlo a `:root[data-theme="dark"]`** y al bloque `@media (prefers-color-scheme: dark)`:

```css
  --amber: #E8A33D;
  --amber-subtle: #3A2A10;
  --amber-soft: rgba(232, 163, 61, 0.15);
  --amber-wash: rgba(232, 163, 61, 0.09);
```

- [ ] **Step 3: Añadir el mapping en `@theme inline`** (junto a `--color-teal`):

```css
  --color-amber: var(--amber);
  --color-amber-subtle: var(--amber-subtle);
  --color-amber-soft: var(--amber-soft);
```

- [ ] **Step 4: Verify**

Run: `npx tsc --noEmit`
Expected: PASS (sin errores; los tokens se usan en la Task 6)

- [ ] **Step 5: Commit**

```bash
git add app/globals.css
git commit -m "estilos: token amber para gastronomía"
```

---

### Task 6: Página `/gastronomia`

**Files:**
- Create: `app/gastronomia/page.tsx`
- Create: `app/components/GastronomiaPageClient.tsx`

**Interfaces:**
- Consumes: `getSitios`, `getRutasPintxos`, `getEventosGastronomia`, `Sitio`, `RutaPintxo` de `lib/gastronomia.ts`; `Evento` de `lib/eventos.ts`; `eventSlug` de `lib/slug.ts`.

- [ ] **Step 1: Create `app/gastronomia/page.tsx`**

```tsx
export const revalidate = 300;

import type { Metadata } from "next";
import GastronomiaPageClient from "../components/GastronomiaPageClient";
import { getSitios, getRutasPintxos, getEventosGastronomia } from "@/lib/gastronomia";

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "Gastronomía en Vitoria-Gasteiz · Pintxos y dónde comer",
    description:
      "Rutas de pintxos, sitios recomendados y agenda gastronómica en Vitoria-Gasteiz.",
    alternates: { canonical: "/gastronomia" },
  };
}

export default async function GastronomiaPage() {
  const [sitios, rutas, eventos] = await Promise.all([
    getSitios(),
    getRutasPintxos(),
    getEventosGastronomia(),
  ]);

  return <GastronomiaPageClient sitios={sitios} rutas={rutas} eventos={eventos} />;
}
```

- [ ] **Step 2: Create `app/components/GastronomiaPageClient.tsx`**

```tsx
"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { Utensils, MapPin, CalendarDays, ExternalLink, Star } from "lucide-react";
import { InViewWrapper } from "@/lib/shared";
import { eventSlug } from "@/lib/slug";
import { formatDate } from "@/lib/utils";
import EmptyState from "./EmptyState";
import type { Sitio, RutaPintxo } from "@/lib/gastronomia";
import type { Evento } from "@/lib/eventos";

type Props = {
  sitios: Sitio[];
  rutas: RutaPintxo[];
  eventos: Evento[];
};

type Tab = "sitios" | "rutas" | "agenda";

const TABS: { key: Tab; label: string }[] = [
  { key: "sitios", label: "Dónde comer" },
  { key: "rutas", label: "Rutas de pintxos" },
  { key: "agenda", label: "Agenda gastronómica" },
];

export default function GastronomiaPageClient({ sitios, rutas, eventos }: Props) {
  const [tab, setTab] = useState<Tab>("sitios");
  const [barrio, setBarrio] = useState<string>("all");

  const barrios = useMemo(
    () => Array.from(new Set(sitios.map((s) => s.barrio))).sort(),
    [sitios]
  );

  const filteredSitios = useMemo(
    () => (barrio === "all" ? sitios : sitios.filter((s) => s.barrio === barrio)),
    [sitios, barrio]
  );

  const precio = (p: Sitio["rangoPrecio"]) => (
    <span className="font-mono text-xs text-amber" aria-label={`Precio ${p}`}>
      {p}
    </span>
  );

  return (
    <div className="px-5 sm:px-6 max-w-7xl mx-auto pt-28 pb-32">
      <InViewWrapper>
        <header className="mb-12">
          <p className="font-mono text-xs tracking-[0.2em] uppercase text-amber mb-3">
            Gastronomía
          </p>
          <h1 className="font-display text-4xl md:text-5xl text-fg mb-3 tracking-[-0.02em]">
            Dónde comer en Vitoria-Gasteiz
          </h1>
          <p className="text-fg-muted max-w-2xl">
            Rutas de pintxos, sitios recomendados y eventos gastronómicos
          </p>
        </header>
      </InViewWrapper>

      <InViewWrapper delay={0.1}>
        <div className="flex gap-2 mb-4 flex-wrap" role="tablist" aria-label="Secciones de gastronomía">
          {TABS.map((t) => (
            <button
              key={t.key}
              role="tab"
              aria-selected={tab === t.key}
              onClick={() => setTab(t.key)}
              className={`px-4 py-2 text-sm font-medium transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] cursor-pointer rounded-full ${
                tab === t.key
                  ? "bg-amber text-white"
                  : "bg-bg-muted text-fg-muted hover:text-fg hover:bg-border"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {tab === "sitios" && barrios.length > 1 && (
          <div className="flex gap-2 mb-8 flex-wrap">
            <button
              onClick={() => setBarrio("all")}
              aria-pressed={barrio === "all"}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-all duration-300 cursor-pointer ${
                barrio === "all"
                  ? "bg-amber-soft text-amber"
                  : "bg-bg-muted text-fg-subtle hover:text-fg-muted"
              }`}
            >
              Todos
            </button>
            {barrios.map((b) => (
              <button
                key={b}
                onClick={() => setBarrio(b)}
                aria-pressed={barrio === b}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-all duration-300 cursor-pointer ${
                  barrio === b
                    ? "bg-amber-soft text-amber"
                    : "bg-bg-muted text-fg-subtle hover:text-fg-muted"
                }`}
              >
                {b}
              </button>
            ))}
          </div>
        )}
      </InViewWrapper>

      {tab === "sitios" && (
        filteredSitios.length === 0 ? (
          <EmptyState
            icon={<Utensils size={20} />}
            title="Sin resultados"
            hint="Prueba con otro barrio."
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredSitios.map((sitio, index) => (
              <InViewWrapper key={sitio.slug} delay={Math.min(index * 0.04, 0.4)}>
                <article className="group double-bezel-outer rounded-2xl p-1.5 h-full">
                  <div className="double-bezel rounded-xl overflow-hidden h-full flex flex-col">
                    <div className="p-5 flex-1">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <h3 className="font-display text-lg font-bold text-fg leading-tight tracking-[-0.01em]">
                          {sitio.nombre}
                        </h3>
                        {sitio.rangoPrecio && precio(sitio.rangoPrecio)}
                      </div>
                      {sitio.recomendado && (
                        <p className="inline-flex items-center gap-1 font-mono text-[11px] uppercase tracking-[0.12em] text-amber bg-amber-soft px-2 py-0.5 rounded mb-3">
                          <Star size={12} strokeWidth={1.5} />
                          Recomendado
                        </p>
                      )}
                      <p className="text-sm text-fg-muted mb-3">{sitio.tipoCocina} · {sitio.barrio}</p>
                      <p className="text-sm text-fg leading-relaxed mb-4">{sitio.descripcion}</p>
                      <p className="flex items-start gap-1.5 text-xs text-fg-subtle mb-4">
                        <MapPin size={13} className="mt-0.5 shrink-0" aria-hidden="true" />
                        {sitio.direccion}
                      </p>
                    </div>
                    {sitio.linkMaps && (
                      <a
                        href={sitio.linkMaps}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={`Ver ${sitio.nombre} en Google Maps`}
                        className="flex items-center justify-center gap-1.5 border-t border-border py-3 text-sm font-medium text-fg-muted hover:text-accent hover:bg-bg-muted transition-colors duration-300"
                      >
                        <ExternalLink size={14} aria-hidden="true" />
                        Cómo llegar
                      </a>
                    )}
                  </div>
                </article>
              </InViewWrapper>
            ))}
          </div>
        )
      )}

      {tab === "rutas" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {rutas.map((ruta, index) => (
            <InViewWrapper key={ruta.slug} delay={Math.min(index * 0.04, 0.4)}>
              <article className="double-bezel rounded-2xl p-5 h-full">
                <p className="font-mono text-[11px] uppercase tracking-[0.15em] text-amber mb-2">
                  {ruta.zona}
                </p>
                <h3 className="font-display text-lg font-bold text-fg mb-1 leading-tight">
                  {ruta.nombre}
                </h3>
                <p className="font-mono text-xs text-fg-subtle mb-4">
                  Duración: {ruta.duracion}
                </p>
                <ol className="space-y-3 mb-4">
                  {ruta.paradas.map((parada, i) => (
                    <li key={`${parada.nombre}-${i}`} className="flex gap-3">
                      <span className="grid size-7 shrink-0 place-items-center rounded-full bg-amber-soft text-amber font-mono text-xs font-bold">
                        {i + 1}
                      </span>
                      <div>
                        <p className="text-sm font-semibold text-fg">{parada.nombre}</p>
                        <p className="text-xs text-fg-muted">
                          {parada.pintxo} · {parada.precio}
                        </p>
                        <p className="text-xs text-fg-subtle">{parada.direccion}</p>
                      </div>
                    </li>
                  ))}
                </ol>
                {ruta.consejo && (
                  <p className="text-xs text-fg-muted border-t border-border pt-3">
                    💡 {ruta.consejo}
                  </p>
                )}
              </article>
            </InViewWrapper>
          ))}
        </div>
      )}

      {tab === "agenda" && (
        eventos.length === 0 ? (
          <EmptyState
            icon={<CalendarDays size={20} />}
            title="No hay eventos gastronómicos estos días"
            hint="Vuelve pronto: publicamos la agenda a diario."
          />
        ) : (
          <ul className="space-y-3">
            {eventos.map((ev) => {
              const { day, month } = formatDate(ev.date);
              return (
                <li key={ev.id || `${ev.title}-${ev.date}`}>
                  <Link
                    href={`/evento/${eventSlug(ev)}`}
                    className="flex items-center gap-4 double-bezel rounded-xl p-4 hover:border-accent/40 transition-all duration-300"
                  >
                    <span className="grid w-14 shrink-0 place-items-center rounded-lg bg-amber-soft text-center leading-tight py-1.5">
                      <span className="block font-mono text-[10px] uppercase text-amber">
                        {month}
                      </span>
                      <span className="block font-display text-lg font-bold text-fg">
                        {day}
                      </span>
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block font-display text-base font-semibold text-fg leading-snug truncate">
                        {ev.title}
                      </span>
                      <span className="block font-mono text-xs text-fg-subtle truncate">
                        {ev.location}
                      </span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )
      )}
    </div>
  );
}
```

Nota: `formatDate` devuelve `{ day, month, ... }` según `lib/utils.ts` (ver Task 6 uso en Header.tsx:466).

- [ ] **Step 3: Verify build**

Run: `npx tsc --noEmit`
Expected: PASS. Si `formatDate` no devuelve `{ day, month }`, ajustar a la firma real de `lib/utils.ts`.

- [ ] **Step 4: Commit**

```bash
git add app/gastronomia/page.tsx app/components/GastronomiaPageClient.tsx
git commit -m "feat(gastronomia): página dónde comer, rutas de pintxos y agenda"
```

---

### Task 7: Página `/turismo`

**Files:**
- Create: `app/turismo/page.tsx`
- Create: `app/components/TurismoPageClient.tsx`

**Interfaces:**
- Consumes: `getQueVer`, `getRutasTurismo`, `getInfoPractica`, `getVisitasGuiadas`, `FichaCurada`, `Ruta`, `InfoPractica` de `lib/turismo.ts`; `Evento` de `lib/eventos.ts`; `eventSlug` de `lib/slug.ts`; `formatDate` de `lib/utils.ts`.

- [ ] **Step 1: Create `app/turismo/page.tsx`**

```tsx
export const revalidate = 300;

import type { Metadata } from "next";
import TurismoPageClient from "../components/TurismoPageClient";
import {
  getQueVer,
  getRutasTurismo,
  getInfoPractica,
  getVisitasGuiadas,
} from "@/lib/turismo";

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "Turismo en Vitoria-Gasteiz · Qué ver y hacer",
    description:
      "Qué ver, rutas por el Anillo Verde, visitas guiadas e información práctica de Vitoria-Gasteiz.",
    alternates: { canonical: "/turismo" },
  };
}

export default async function TurismoPage() {
  const [queVer, rutas, info, visitas] = await Promise.all([
    getQueVer(),
    getRutasTurismo(),
    getInfoPractica(),
    getVisitasGuiadas(),
  ]);

  return (
    <TurismoPageClient
      queVer={queVer}
      rutas={rutas}
      info={info}
      visitas={visitas}
    />
  );
}
```

- [ ] **Step 2: Create `app/components/TurismoPageClient.tsx`**

```tsx
"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Landmark,
  Footprints,
  ExternalLink,
  MapPin,
  CalendarDays,
} from "lucide-react";
import { InViewWrapper } from "@/lib/shared";
import { eventSlug } from "@/lib/slug";
import { formatDate } from "@/lib/utils";
import EmptyState from "./EmptyState";
import type { FichaCurada, Ruta, InfoPractica } from "@/lib/turismo";
import type { Evento } from "@/lib/eventos";

type Props = {
  queVer: FichaCurada[];
  rutas: Ruta[];
  info: InfoPractica;
  visitas: Evento[];
};

type Tab = "ver" | "rutas" | "visitas" | "info";

const TABS: { key: Tab; label: string }[] = [
  { key: "ver", label: "Qué ver" },
  { key: "rutas", label: "Rutas y naturaleza" },
  { key: "visitas", label: "Visitas guiadas" },
  { key: "info", label: "Info práctica" },
];

const ICONS: Record<string, () => React.ReactNode> = {
  train: () => <Landmark size={18} aria-hidden="true" />,
  bus: () => <MapPin size={18} aria-hidden="true" />,
  bed: () => <Landmark size={18} aria-hidden="true" />,
  info: () => <CalendarDays size={18} aria-hidden="true" />,
};

export default function TurismoPageClient({ queVer, rutas, info, visitas }: Props) {
  const [tab, setTab] = useState<Tab>("ver");

  return (
    <div className="px-5 sm:px-6 max-w-7xl mx-auto pt-28 pb-32">
      <InViewWrapper>
        <header className="mb-12">
          <p className="font-mono text-xs tracking-[0.2em] uppercase text-teal mb-3">
            Turismo
          </p>
          <h1 className="font-display text-4xl md:text-5xl text-fg mb-3 tracking-[-0.02em]">
            Descubre Vitoria-Gasteiz
          </h1>
          <p className="text-fg-muted max-w-2xl">
            Qué ver, rutas por el Anillo Verde, visitas guiadas e información práctica
          </p>
        </header>
      </InViewWrapper>

      <InViewWrapper delay={0.1}>
        <div className="flex gap-2 mb-8 flex-wrap" role="tablist" aria-label="Secciones de turismo">
          {TABS.map((t) => (
            <button
              key={t.key}
              role="tab"
              aria-selected={tab === t.key}
              onClick={() => setTab(t.key)}
              className={`px-4 py-2 text-sm font-medium transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] cursor-pointer rounded-full ${
                tab === t.key
                  ? "bg-teal text-white"
                  : "bg-bg-muted text-fg-muted hover:text-fg hover:bg-border"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </InViewWrapper>

      {tab === "ver" && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {queVer.map((item, index) => (
            <InViewWrapper key={item.slug} delay={Math.min(index * 0.04, 0.4)}>
              <article className="group double-bezel-outer rounded-2xl p-1.5 h-full">
                <div className="double-bezel rounded-xl overflow-hidden h-full flex flex-col">
                  <div className="p-5 flex-1">
                    <h3 className="font-display text-lg font-bold text-fg mb-1 leading-tight tracking-[-0.01em]">
                      {item.nombre}
                    </h3>
                    {item.zona && (
                      <p className="font-mono text-[11px] uppercase tracking-[0.15em] text-teal mb-3">
                        {item.zona}
                      </p>
                    )}
                    <p className="text-sm text-fg leading-relaxed mb-4">{item.descripcion}</p>
                    {item.tags && (
                      <ul className="flex flex-wrap gap-1.5" aria-label="Etiquetas">
                        {item.tags.map((tag) => (
                          <li
                            key={tag}
                            className="font-mono text-[10px] uppercase tracking-[0.1em] text-fg-subtle bg-bg-muted px-2 py-0.5 rounded"
                          >
                            {tag}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                  {(item.linkMaps || item.linkOficial) && (
                    <div className="flex border-t border-border">
                      {item.linkOficial && (
                        <a
                          href={item.linkOficial}
                          target="_blank"
                          rel="noopener noreferrer"
                          aria-label={`Web oficial de ${item.nombre}`}
                          className="flex-1 flex items-center justify-center gap-1.5 py-3 text-sm font-medium text-fg-muted hover:text-accent hover:bg-bg-muted transition-colors duration-300"
                        >
                          <ExternalLink size={14} aria-hidden="true" />
                          Web
                        </a>
                      )}
                      {item.linkMaps && (
                        <a
                          href={item.linkMaps}
                          target="_blank"
                          rel="noopener noreferrer"
                          aria-label={`Ver ${item.nombre} en Google Maps`}
                          className={`${item.linkOficial ? "border-l" : "flex-1"} border-border flex items-center justify-center gap-1.5 py-3 text-sm font-medium text-fg-muted hover:text-accent hover:bg-bg-muted transition-colors duration-300`}
                        >
                          <MapPin size={14} aria-hidden="true" />
                          Cómo llegar
                        </a>
                      )}
                    </div>
                  )}
                </div>
              </article>
            </InViewWrapper>
          ))}
        </div>
      )}

      {tab === "rutas" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {rutas.map((ruta, index) => (
            <InViewWrapper key={ruta.slug} delay={Math.min(index * 0.04, 0.4)}>
              <article className="double-bezel rounded-2xl p-5 h-full flex flex-col">
                <p
                  className={`inline-flex w-fit items-center gap-1 font-mono text-[11px] uppercase tracking-[0.12em] rounded px-2 py-0.5 mb-3 ${
                    ruta.dificultad === "Baja"
                      ? "text-green bg-bg-muted"
                      : ruta.dificultad === "Media"
                        ? "text-amber bg-amber-soft"
                        : "text-accent bg-accent-soft"
                  }`}
                >
                  <Footprints size={12} aria-hidden="true" />
                  Dificultad {ruta.dificultad.toLowerCase()}
                </p>
                <h3 className="font-display text-lg font-bold text-fg mb-1 leading-tight">
                  {ruta.nombre}
                </h3>
                <p className="font-mono text-xs text-fg-subtle mb-3">
                  {ruta.duracion} · {ruta.distancia}
                </p>
                <p className="text-sm text-fg leading-relaxed mb-4 flex-1">
                  {ruta.descripcion}
                </p>
                <p className="flex items-start gap-1.5 text-xs text-fg-subtle mb-4">
                  <MapPin size={13} className="mt-0.5 shrink-0" aria-hidden="true" />
                  Salida: {ruta.puntoSalida}
                </p>
                {ruta.linkMaps && (
                  <a
                    href={ruta.linkMaps}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`Ver salida de ${ruta.nombre} en Google Maps`}
                    className="flex items-center justify-center gap-1.5 border-t border-border pt-3 text-sm font-medium text-fg-muted hover:text-accent transition-colors duration-300"
                  >
                    <ExternalLink size={14} aria-hidden="true" />
                    Ver en Google Maps
                  </a>
                )}
              </article>
            </InViewWrapper>
          ))}
        </div>
      )}

      {tab === "visitas" && (
        visitas.length === 0 ? (
          <EmptyState
            icon={<CalendarDays size={20} />}
            title="No hay visitas guiadas estos días"
            hint="Puede que en otras categorías de la agenda encuentres tu plan."
            action={{ href: "/culture", label: "Ver agenda cultural" }}
          />
        ) : (
          <ul className="space-y-3">
            {visitas.map((ev) => {
              const { day, month } = formatDate(ev.date);
              return (
                <li key={ev.id || `${ev.title}-${ev.date}`}>
                  <Link
                    href={`/evento/${eventSlug(ev)}`}
                    className="flex items-center gap-4 double-bezel rounded-xl p-4 hover:border-accent/40 transition-all duration-300"
                  >
                    <span className="grid w-14 shrink-0 place-items-center rounded-lg bg-teal-soft text-center leading-tight py-1.5">
                      <span className="block font-mono text-[10px] uppercase text-teal">
                        {month}
                      </span>
                      <span className="block font-display text-lg font-bold text-fg">
                        {day}
                      </span>
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block font-display text-base font-semibold text-fg leading-snug truncate">
                        {ev.title}
                      </span>
                      <span className="block font-mono text-xs text-fg-subtle truncate">
                        {ev.location}
                      </span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )
      )}

      {tab === "info" && (
        <div>
          <p className="text-lg text-fg-muted max-w-2xl mb-8">{info.intro}</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {info.bloques.map((bloque) => (
              <article key={bloque.id} className="double-bezel rounded-2xl p-5">
                <div className="flex items-center gap-2 mb-3">
                  <span className="grid size-9 place-items-center rounded-xl bg-teal-soft text-teal">
                    {ICONS[bloque.icono]?.()}
                  </span>
                  <h3 className="font-display text-base font-bold text-fg">{bloque.titulo}</h3>
                </div>
                <ul className="space-y-2">
                  {bloque.items.map((item, i) => (
                    <li key={i} className="text-sm text-fg-muted leading-relaxed list-disc list-inside">
                      {item}
                    </li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
```

Nota: no se usan `teal-soft`/`amber-soft` como clases Tailwind si Tailwind 4 no las genera desde el mapping `@theme inline` — sí se genera: `--color-amber-soft` → `bg-amber-soft`. Si `--color-teal-soft` no existe, añadir al token `--color-teal-soft: rgba(0, 191, 178, 0.12)` en `@theme inline` de `globals.css`.

- [ ] **Step 3: Verify — añadir `--color-teal-soft` si falta**

En `app/globals.css`, dentro de `@theme inline`, junto a `--color-teal`:

```css
  --color-teal-soft: rgba(0, 191, 178, 0.12);
```

- [ ] **Step 4: Verify build**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add app/turismo/page.tsx app/components/TurismoPageClient.tsx app/globals.css
git commit -m "feat(turismo): página qué ver, rutas, visitas guiadas e info práctica"
```

---

### Task 8: Navegación — header, dropdown y home

**Files:**
- Modify: `app/components/Header.tsx:20-28,366-389`
- Modify: `app/components/CategoriesGrid.tsx`

**Interfaces:**
- Consumes: `getSitios` de `lib/gastronomia.ts`; `getQueVer`, `getRutasTurismo` de `lib/turismo.ts`.

- [ ] **Step 1: Header `navItems`** — en `app/components/Header.tsx` añadir tras "Deporte":

```ts
  { name: "Turismo", href: "/turismo" },
  { name: "Gastronomía", href: "/gastronomia" },
```

- [ ] **Step 2: Dropdown "Ocio" del header** — en el bloque `Ocio` del dropdown (`Header.tsx` líneas ~366-375), añadir antes del cierre:

```tsx
                          { label: "Turismo", href: "/turismo" },
                          { label: "Gastronomía", href: "/gastronomia" },
```

- [ ] **Step 3: `CategoriesGrid.tsx`** — añadir a `categories` dos tarjetas (usar `Landmark` y `Utensils` de lucide-react, ya en el import):

```ts
const categories = [
  { label: "Conciertos", href: "/conciertos", desc: "Música en vivo", tint: "bg-teal/10 border-teal/20", wash: "radial-gradient(420px 160px at 90% -20%, var(--teal-wash), transparent 60%)", icon: Music, count: counts.conciertos },
  { label: "Cultura", href: "/culture", desc: "Teatro, exposiciones", tint: "bg-accent/10 border-accent/20", wash: "radial-gradient(420px 160px at 90% -20%, var(--accent-wash), transparent 60%)", icon: Landmark, count: counts.cultura },
  { label: "Deporte", href: "/deporte", desc: "Running, trail, eventos", tint: "bg-green/10 border-green/20", wash: "radial-gradient(420px 160px at 90% -20%, rgba(43,107,74,0.08), transparent 60%)", icon: Trophy, count: counts.deporte },
  { label: "Cartelera", href: "/movies", desc: "Cine en Vitoria", tint: "bg-blue/10 border-blue/20", wash: "radial-gradient(420px 160px at 90% -20%, rgba(74,124,156,0.08), transparent 60%)", icon: Clapperboard, count: carteleraCount },
  { label: "Turismo", href: "/turismo", desc: "Qué ver en Gasteiz", tint: "bg-teal/10 border-teal/20", wash: "radial-gradient(420px 160px at 90% -20%, var(--teal-wash), transparent 60%)", icon: Landmark, count: turismoCount },
  { label: "Gastronomía", href: "/gastronomia", desc: "Pintxos y sitios", tint: "bg-amber/10 border-amber/20", wash: "radial-gradient(420px 160px at 90% -20%, var(--amber-wash), transparent 60%)", icon: Utensils, count: gastronomiaCount },
];
```

Actualizar el import de lucide-react a `{ Music, Landmark, Trophy, Clapperboard, Utensils }` (Landmark ya está). Importar `getSitios` de `@/lib/gastronomia` y `getQueVer` de `@/lib/turismo`:

```ts
import { getQueVer } from "@/lib/turismo";
import { getSitios } from "@/lib/gastronomia";
```

Añadir a `getCategoryCounts` un retorno ampliado (sin tocar los contadores de eventos):

```ts
async function getCuratedCounts(): Promise<{ turismo: number; gastronomia: number }> {
  const [queVer, sitios] = await Promise.all([getQueVer(), getSitios()]);
  return { turismo: queVer.length, gastronomia: sitios.length };
}
```

En el componente `CategoriesGrid`, cambiar el `Promise.all` inicial y la cuadrícula a `grid-cols-2 md:grid-cols-3 lg:grid-cols-6`:

```tsx
const [counts, carteleraCount, curatedCounts] = await Promise.all([
  getCategoryCounts(),
  getCarteleraCount(),
  getCuratedCounts(),
]);
```

- [ ] **Step 4: Verify build**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add app/components/Header.tsx app/components/CategoriesGrid.tsx
git commit -m "feat: navegación a turismo y gastronomía en header y home"
```

---

### Task 9: Sitemap y SEO

**Files:**
- Modify: `app/sitemap.ts:10-62`

**Interfaces:**
- Consumes: nada nuevo.

- [ ] **Step 1: Añadir rutas estáticas al sitemap** — en `staticRoutes`, tras el bloque de `/movies`:

```ts
    {
      url: `${BASE_URL}/turismo`,
      changeFrequency: "daily",
      priority: 0.8,
    },
    {
      url: `${BASE_URL}/gastronomia`,
      changeFrequency: "daily",
      priority: 0.8,
    },
```

- [ ] **Step 2: Verify**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add app/sitemap.ts
git commit -m "seo: añade turismo y gastronomía al sitemap"
```

---

### Task 10: Tests E2E (smoke)

**Files:**
- Create: `e2e/descubre.spec.ts`

- [ ] **Step 1: Write test** — `e2e/descubre.spec.ts`

```ts
import { test, expect } from "@playwright/test";

test.describe("Turismo & Gastronomía", () => {
  test("home enlaza a turismo y gastronomía", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator('a[href="/turismo"]').first()).toBeVisible();
    await expect(page.locator('a[href="/gastronomia"]').first()).toBeVisible();
  });

  test("página de turismo carga con secciones", async ({ page }) => {
    await page.goto("/turismo");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.getByRole("tablist", { name: /turismo/i })).toBeVisible();
    await expect(page.getByRole("heading", { name: /catedral/i }).first()).toBeVisible();
  });

  test("página de gastronomía carga con rutas de pintxos", async ({ page }) => {
    await page.goto("/gastronomia");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await page.getByRole("tab", { name: /rutas de pintxos/i }).click();
    await expect(page.getByRole("heading", { name: /casco viejo/i }).first()).toBeVisible();
  });
});
```

- [ ] **Step 2: Run tests (ajustar si el servidor no está en marcha)**

Run: `npx playwright test e2e/descubre.spec.ts`
Expected: PASS (requiere `npm run dev` o `webServer` configurado en `playwright.config.ts`).

- [ ] **Step 3: Commit**

```bash
git add e2e/descubre.spec.ts
git commit -m "test(e2e): smoke de turismo y gastronomía"
```

---

### Task 11: Verificación final

**Files:**
- (ninguno)

- [ ] **Step 1: Ejecutar toda la suite Jest**

Run: `npx jest`
Expected: PASS (incluye `cultura-sources`, `curated`, `turismo`, `gastronomia` y los existentes).

- [ ] **Step 2: Lint**

Run: `npm run lint`
Expected: PASS

- [ ] **Step 3: Build**

Run: `npm run build`
Expected: PASS

- [ ] **Step 4: Commit pendientes si los hubiera**

```bash
git add -A
git commit -m "chore: verificación final turismo y gastronomía"
```