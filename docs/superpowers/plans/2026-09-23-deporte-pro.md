# Deporte pro (Baskonia, Alavés, Araski) — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mostrar en la home y en `/deporte` los próximos partidos de los tres clubes profesionales de Vitoria-Gasteiz leyéndolos del CMS oficial del grupo Baskonia-Alavés y de un JSON manual de Araski.

**Architecture:** Una fuente nueva `lib/sources/clubCms.ts` consulta el Strapi REST público de `cms.deportivoalaves.com` y transforma su payload a un tipo `Partido` normalizado. `lib/partidos.ts` fusiona CMS + `data/partidos/araski.json` y expone `getProximosPartidos()` con caché. Dos componentes server (`PartidosSection` en home, `ProMatchesBlock` en `/deporte`) renderizan los datos.

**Tech Stack:** Next.js 16 App Router (server components), TypeScript estricto, Tailwind v4 (tokens CSS), `getCachedOrFetch` de `lib/cache.ts`, Jest 30 + ts-jest, Playwright. Sin dependencias nuevas.

**Spec:** `docs/superpowers/specs/2026-09-23-landing-deporte-reels-design.md` (Parte 1, §1.1–§1.3)

## Global Constraints

- TypeScript estricto; ESLint con `eslint-config-next`. Comprobaciones: `npm run lint`, `npx jest <ruta>`.
- Tests Jest en `__tests__/**/*.test.ts` (ts-jest, preset `ts-jest`, `testMatch: ["**/__tests__/**/*.test.ts"]`), alias `@/` → raíz del repo.
- Toda caché de datos usa `getCachedOrFetch<T>(key, ttlMs, fetcher)` de `lib/cache.ts` (escribe en `tmpdir`).
- Origen oficial del CMS: `https://cms.deportivoalaves.com`. Los `url` de escudos/logos vienen relativos (`/uploads/...`) y deben completarse con ese origen.
- El filtro de "próximos" usa el **día** del partido (no la hora): un partido de hoy con hora "por confirmar" cuenta como próximo.
- Copy en español, tono de la app. `revalidate = 300` ya está en home y `/deporte`.
- Los `e2e/homepage.spec.ts` existentes deben seguir pasando al terminar.

---

### Task 1: Fuente CMS del grupo Baskonia-Alavés (`lib/sources/clubCms.ts`)

**Files:**
- Create: `lib/sources/clubCms.ts`
- Test: `__tests__/sources/clubCms.test.ts`

**Interfaces:**
- Produces (usado por Task 2, 3 y 4):
  - `export type ClubKey = "baskonia" | "alaves" | "araski";`
  - `export interface Escudo { nombre: string; url?: string }`
  - `export interface Partido { id: string; equipo: ClubKey; club: string; competicion: string; fecha: string | null; hora: string | null; local: Escudo; visitante: Escudo; estadio: string | null; marcador: { local: number; visitante: number } | null; link: string | null; fuente: "cms" | "manual" }`
  - `export async function scrapePartidosCMS(): Promise<Partido[]>`
- Consumes: nada previo (usa `fetch` global).

- [ ] **Step 1: Write the failing test**

Create `__tests__/sources/clubCms.test.ts`:

```ts
import { scrapePartidosCMS } from "@/lib/sources/clubCms";
import { mockFetchWith } from "../helpers";

const CMS_ORIGIN = "https://cms.deportivoalaves.com";

const game = (overrides: Record<string, unknown> = {}) =>
  JSON.stringify({
    data: [
      {
        id: 1234,
        attributes: {
          gameDate: "2026-10-04",
          gameTime: "18:30:00",
          homeScore: null,
          awayScore: null,
          stadiumName: "Fernando Buesa Arena",
          homeTeam: {
            data: { attributes: { name: "Kosner Baskonia", shield: { data: { attributes: { url: "/uploads/baskonia.png" } } } } },
          },
          awayTeam: {
            data: { attributes: { name: "Real Madrid", shield: { data: { attributes: { url: "/uploads/rm.png" } } } } },
          },
          competition: { data: { attributes: { name: "Liga Endesa", logo: { data: { attributes: { url: "/uploads/liga.png" } } } } } },
          seasons: [{ id: 25 }],
          link: { url: "https://www.baskonia.com/entradas" },
          ...overrides,
        },
      },
    ],
    meta: { pagination: { page: 1, pageSize: 100, pageCount: 1, total: 1 } },
  });

describe("scrapePartidosCMS", () => {
  afterEach(() => jest.restoreAllMocks());

  it("maps the Strapi payload to normalized Partido[] with absolute shield URLs", async () => {
    mockFetchWith([{ match: /cms\.deportivoalaves\.com/, content: game() }]);
    const partidos = await scrapePartidosCMS();

    expect(partidos).toHaveLength(2); // baskonia + alaves (el mock devuelve lo mismo para ambos)
    const primero = partidos[0];
    expect(primero.equipo).toBe("baskonia");
    expect(primero.club).toBe("Kosner Baskonia");
    expect(primero.competicion).toBe("Liga Endesa");
    expect(primero.fecha).toBe("2026-10-04T18:30:00+02:00");
    expect(primero.hora).toBe("18:30:00");
    expect(primero.local.url).toBe(`${CMS_ORIGIN}/uploads/baskonia.png`);
    expect(primero.visitante.url).toBe(`${CMS_ORIGIN}/uploads/rm.png`);
    expect(primero.estadio).toBe("Fernando Buesa Arena");
    expect(primero.marcador).toBeNull();
    expect(primero.link).toBe("https://www.baskonia.com/entradas");
    expect(primero.fuente).toBe("cms");
  });

  it("returns [] when the CMS fetch fails", async () => {
    mockFetchWith([{ match: /cms\.deportivoalaves\.com/, content: "", status: 500 }]);
    await expect(scrapePartidosCMS()).resolves.toEqual([]);
  });

  it("keeps the date and sets hora null when gameTime is missing or 'null'", async () => {
    mockFetchWith([
      { match: /cms\.deportivoalaves\.com/, content: game({ gameTime: null }) },
    ]);
    const [primero] = await scrapePartidosCMS();
    expect(primero.fecha).toBe("2026-10-04T00:00:00+02:00");
    expect(primero.hora).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest __tests__/sources/clubCms.test.ts`
Expected: FAIL — "Cannot find module '@/lib/sources/clubCms'".

- [ ] **Step 3: Write minimal implementation**

Create `lib/sources/clubCms.ts`:

```ts
export type ClubKey = "baskonia" | "alaves" | "araski";

export interface Escudo {
  nombre: string;
  url?: string;
}

export interface Partido {
  id: string;
  equipo: ClubKey;
  club: string;
  competicion: string;
  fecha: string | null;
  hora: string | null;
  local: Escudo;
  visitante: Escudo;
  estadio: string | null;
  marcador: { local: number; visitante: number } | null;
  link: string | null;
  fuente: "cms" | "manual";
}

const CMS_ORIGIN = "https://cms.deportivoalaves.com";
const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36";

interface ClubCfg {
  key: ClubKey;
  club: string;
  team: string;
  seasonId: number;
}

const CLUB_CONFIG: Record<Exclude<ClubKey, "araski">, ClubCfg> = {
  baskonia: { key: "baskonia", club: "Kosner Baskonia", team: "Kosner Baskonia", seasonId: 25 },
  alaves: { key: "alaves", club: "Deportivo Alavés", team: "Deportivo Alavés", seasonId: 19 },
};

function attributesOf(holder: unknown): Record<string, unknown> {
  if (!holder || typeof holder !== "object") return {};
  const obj = holder as Record<string, unknown>;
  if (obj.data && typeof obj.data === "object") {
    const d = obj.data as Record<string, unknown>;
    if (d.attributes && typeof d.attributes === "object") {
      return d.attributes as Record<string, unknown>;
    }
    return d;
  }
  return obj;
}

function firstUrl(holder: unknown): string | undefined {
  if (!holder) return undefined;
  if (typeof holder === "string") {
    return holder.startsWith("/") ? `${CMS_ORIGIN}${holder}` : holder;
  }
  const url = attributesOf(holder).url;
  if (typeof url === "string") {
    return url.startsWith("/") ? `${CMS_ORIGIN}${url}` : url;
  }
  return undefined;
}

function nameOf(holder: unknown): string {
  const name = attributesOf(holder).name;
  return typeof name === "string" ? name : "";
}

function seasonIdOf(attrs: Record<string, unknown>): number | null {
  const seasons = attrs.seasons;
  if (!Array.isArray(seasons)) return null;
  for (const s of seasons) {
    if (s && typeof s === "object") {
      const a = attributesOf(s as { attributes?: unknown });
      const id = Number(a.id);
      if (Number.isFinite(id) && id > 0) return id;
    }
  }
  return null;
}

function extractLink(attrs: Record<string, unknown>): string | null {
  const direct = typeof attrs.link === "string" ? attrs.link : firstUrl(attrs.link);
  if (direct) return direct;
  const buttons = attrs.buttons;
  if (Array.isArray(buttons)) {
    for (const b of buttons) {
      const u = firstUrl(b);
      if (u) return u;
    }
  }
  return null;
}

function filterGameTime(gameTime: string | null): string | null {
  if (typeof gameTime !== "string") return null;
  const m = gameTime.match(/(\d{1,2}):(\d{2})/);
  if (!m) return null;
  return `${m[1].padStart(2, "0")}:${m[2]}:00`;
}

function gamesUrl(cfg: ClubCfg, opts: { seasonId?: number; sort?: string }): string {
  const p = new URLSearchParams();
  p.set("populate[homeTeam][populate]", "shield");
  p.set("populate[awayTeam][populate]", "shield");
  p.set("populate[competition][populate]", "logo");
  p.set("populate[seasons]", "*");
  p.set("populate[link]", "*");
  p.set("populate[buttons]", "*");
  p.set("filters[$or][0][homeTeam][name][$eq]", cfg.team);
  p.set("filters[$or][1][awayTeam][name][$eq]", cfg.team);
  if (opts.seasonId) p.set("filters[seasons][id][$eq]", String(opts.seasonId));
  p.set("sort[0]", opts.sort ?? "gameDate:asc");
  p.set("pagination[pageSize]", "100");
  p.set("locale", "es");
  return `${CMS_ORIGIN}/api/games-items?${p.toString()}`;
}

async function fetchGamesItems(url: string): Promise<unknown[]> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": USER_AGENT },
      next: { revalidate: 120 },
      signal: AbortSignal.timeout(20000),
    });
    if (!res.ok) return [];
    const body = await res.json().catch(() => null);
    const list = (body as { data?: unknown })?.data;
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

async function detectSeasonId(cfg: ClubCfg): Promise<number> {
  const url = gamesUrl(cfg, { sort: "gameDate:desc" });
  const games = await fetchGamesItems(url);
  for (const game of games) {
    const id = seasonIdOf(attributesOf(game));
    if (id) return id;
  }
  return cfg.seasonId;
}

function mapGame(cfg: ClubCfg, game: unknown, index: number): Partido {
  const attrs = attributesOf(game);
  const rawId = (game as { id?: unknown })?.id;
  const id =
    typeof rawId === "string" || typeof rawId === "number"
      ? `${cfg.key}-${String(rawId)}`
      : `${cfg.key}-${index}`;

  const gameDate = typeof attrs.gameDate === "string" ? attrs.gameDate : null;
  const hora = filterGameTime(
    typeof attrs.gameTime === "string" ? attrs.gameTime : null
  );

  let fecha: string | null = null;
  if (gameDate && /^\d{4}-\d{2}-\d{2}/.test(gameDate)) {
    fecha = hora ? `${gameDate}T${hora}+02:00` : `${gameDate}T00:00:00+02:00`;
  }

  const homeScore = attrs.homeScore;
  const awayScore = attrs.awayScore;
  const marcador =
    typeof homeScore === "number" && typeof awayScore === "number"
      ? { local: homeScore, visitante: awayScore }
      : null;

  return {
    id,
    equipo: cfg.key,
    club: cfg.club,
    competicion: nameOf(attrs.competition) || "Competición",
    fecha,
    hora,
    local: { nombre: nameOf(attrs.homeTeam) || "Local", url: firstUrl((attrs.homeTeam as { shield?: unknown })?.shield) },
    visitante: { nombre: nameOf(attrs.awayTeam) || "Visitante", url: firstUrl((attrs.awayTeam as { shield?: unknown })?.shield) },
    estadio: typeof attrs.stadiumName === "string" ? attrs.stadiumName : null,
    marcador,
    link: extractLink(attrs),
    fuente: "cms",
  };
}

async function scrapeClub(cfg: ClubCfg): Promise<Partido[]> {
  const seasonId = await detectSeasonId(cfg);
  const url = gamesUrl(cfg, { seasonId, sort: "gameDate:asc" });
  const games = await fetchGamesItems(url);
  return games.map((game, i) => mapGame(cfg, game, i));
}

export async function scrapePartidosCMS(): Promise<Partido[]> {
  const [baskonia, alaves] = await Promise.allSettled([
    scrapeClub(CLUB_CONFIG.baskonia),
    scrapeClub(CLUB_CONFIG.alaves),
  ]);
  const out: Partido[] = [];
  if (baskonia.status === "fulfilled") out.push(...baskonia.value);
  if (alaves.status === "fulfilled") out.push(...alaves.value);
  return out;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest __tests__/sources/clubCms.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Lint + commit**

Run: `npm run lint`
Expected: sin errores.

```bash
git add lib/sources/clubCms.ts __tests__/sources/clubCms.test.ts
git commit -m "feat: fuente CMS del grupo Baskonia-Alaves (partidos pro)"
```

---

### Task 2: JSON manual de Araski + capa de negocio `lib/partidos.ts`

**Files:**
- Create: `data/partidos/araski.json`
- Create: `lib/partidos.ts`
- Test: `__tests__/partidos.test.ts`

**Interfaces:**
- Consumes: `scrapePartidosCMS`, `Partido`, `Escudo` de `lib/sources/clubCms` (Task 1).
- Produces (usado por Task 3 y 4):
  - `export function getProximosPartidos(nPorEquipo = 1): Promise<Partido[]>`
  - `export function getTodosLosPartidos(): Promise<Partido[]>`

- [ ] **Step 1: Write the failing test**

Create `__tests__/partidos.test.ts`:

```ts
import { getProximosPartidos, getTodosLosPartidos } from "@/lib/partidos";
import { mockFetchWith } from "./helpers";

jest.mock("@/lib/cache", () => ({
  getCachedOrFetch: jest.fn(async (_k: string, _t: number, fn: () => Promise<unknown>) => fn()),
}));

import fs from "fs";
import path from "path";

function mockCms() {
  const now = new Date();
  const far = new Date(now.getTime() + 10 * 86400000).toISOString().slice(0, 10);
  mockFetchWith([
    {
      match: /cms\.deportivoalaves\.com/,
      content: JSON.stringify({ data: [{ id: 1, attributes: { gameDate: far, gameTime: "20:00:00", homeTeam: { data: { attributes: { name: "Kosner Baskonia" } } }, awayTeam: { data: { attributes: { name: "Real Madrid" } } }, competition: { data: { attributes: { name: "Liga Endesa" } } } } }] }),
    },
  ]);
}

describe("getProximosPartidos", () => {
  beforeEach(() => {
    mockCms();
  });

  afterEach(() => jest.restoreAllMocks());

  it("returns only future games, ordered by date, respecting nPorEquipo", async () => {
    const partidos = await getProximosPartidos(1);
    const equiposVistos = new Set(partidos.map((p) => p.equipo));
    expect(equiposVistos).toEqual(new Set(["baskonia", "alaves", "araski"]));
    expect(partidos.filter((p) => p.equipo === "baskonia")).toHaveLength(1);
  });

  it("includes Araski from the manual JSON", async () => {
    const partidos = await getProximosPartidos(1);
    const araski = partidos.filter((p) => p.equipo === "araski");
    expect(araski.length).toBeGreaterThan(0);
    expect(araski[0].fuente).toBe("manual");
    expect(araski[0].club).toBe("Kutxabank Araski");
  });

  it("filters out past games", async () => {
    const partidos = await getTodosLosPartidos();
    const ayer = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    const teamId = "baskonia";
    expect(partidos.some((p) => p.equipo === teamId && p.fecha?.startsWith(ayer))).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest __tests__/partidos.test.ts`
Expected: FAIL — cannot find module '@/lib/partidos'.

- [ ] **Step 3: Write implementation**

Create `data/partidos/araski.json`:

```json
{
  "equipo": "Kutxabank Araski",
  "actualizado": "2026-09-23",
  "partidos": [
    {
      "fecha": "2026-10-11T18:00:00+02:00",
      "competicion": "Liga Femenina Endesa",
      "local": { "nombre": "Kutxabank Araski", "escudo": null },
      "visitante": { "nombre": "IDK Euskotren", "escudo": null },
      "estadio": "Mendizorrotza",
      "link": "https://kutxabankaraski.com"
    }
  ]
}
```

> Nota: el usuario irá actualizando este JSON (fechas y rivales) conforme arranque la temporada. Si no hay partido próximo, `getProximosPartidos` lo omite con elegancia.

Create `lib/partidos.ts`:

```ts
import fs from "fs/promises";
import path from "path";
import { getCachedOrFetch } from "./cache";
import { scrapePartidosCMS, type Partido } from "./sources/clubCms";

const ARASKI_PATH = path.join(process.cwd(), "data", "partidos", "araski.json");

type AraskiPayload = {
  equipo?: string;
  partidos?: Array<{
    fecha?: string;
    competicion?: string;
    local?: { nombre?: string; escudo?: string | null };
    visitante?: { nombre?: string; escudo?: string | null };
    estadio?: string;
    link?: string;
  }>;
};

export async function getPartidosAraski(): Promise<Partido[]> {
  try {
    const raw = await fs.readFile(ARASKI_PATH, "utf-8");
    const payload = JSON.parse(raw) as AraskiPayload;
    const equipo = payload.equipo || "Kutxabank Araski";
    return (payload.partidos ?? []).map((p, i) => ({
      id: `araski-${i}-${p.fecha ?? "sin-fecha"}`,
      equipo: "araski" as const,
      club: equipo,
      competicion: p.competicion || "Liga Femenina Endesa",
      fecha: typeof p.fecha === "string" && !isNaN(new Date(p.fecha).getTime()) ? p.fecha : null,
      hora: typeof p.fecha === "string" ? p.fecha.split("T")[1]?.slice(0, 8) ?? null : null,
      local: { nombre: p.local?.nombre || "Kutxabank Araski", url: p.local?.escudo ?? undefined },
      visitante: { nombre: p.visitante?.nombre || "Rival", url: p.visitante?.escudo ?? undefined },
      estadio: p.estadio || null,
      marcador: null,
      link: p.link || null,
      fuente: "manual" as const,
    }));
  } catch {
    return [];
  }
}

export function getTodosLosPartidos(): Promise<Partido[]> {
  return getCachedOrFetch("partidos-proximos", 5 * 60 * 1000, async () => {
    const [cms, araski] = await Promise.allSettled([scrapePartidosCMS(), getPartidosAraski()]);
    const out: Partido[] = [];
    if (cms.status === "fulfilled") out.push(...cms.value);
    if (araski.status === "fulfilled") out.push(...araski.value);
    return out.sort(
      (a, b) => (a.fecha ? new Date(a.fecha).getTime() : Infinity) - (b.fecha ? new Date(b.fecha).getTime() : Infinity)
    );
  });
}

function esProximo(partido: Partido, now = new Date()): boolean {
  if (!partido.fecha) return false;
  const game = new Date(partido.fecha);
  if (isNaN(game.getTime())) return false;
  const hoy = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const diaPartido = new Date(game.getFullYear(), game.getMonth(), game.getDate());
  return diaPartido >= hoy;
}

export async function getProximosPartidos(nPorEquipo = 1): Promise<Partido[]> {
  const todos = await getTodosLosPartidos();
  const proximos = todos.filter((p) => esProximo(p));
  const porEquipo: Partial<Record<string, Partido[]>> = {};
  for (const p of proximos) {
    const lista = (porEquipo[p.equipo] ||= []);
    if (lista.length < nPorEquipo) lista.push(p);
  }
  return Object.values(porEquipo)
    .flat()
    .sort((a, b) => (a.fecha ? new Date(a.fecha).getTime() : Infinity) - (b.fecha ? new Date(b.fecha).getTime() : Infinity));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest __tests__/partidos.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Lint + commit**

Run: `npm run lint`
Expected: sin errores.

```bash
git add data/partidos/araski.json lib/partidos.ts __tests__/partidos.test.ts
git commit -m "feat: capa de partidos locales (CMS + Araski manual)"
```

---

### Task 3: Bloque de partidos en la home (`PartidosSection`)

**Files:**
- Create: `app/components/PartidosSection.tsx`
- Modify: `app/page.tsx` (render `<PartidosSection />` tras `<SectionsHub />`)
- Test: `e2e/homepage.spec.ts` (añadir assertions)

**Interfaces:**
- Consumes: `getProximosPartidos(nPorEquipo)` de `lib/partidos.ts` (Task 2), `Partido` de `lib/sources/clubCms.ts`.
- Produces: componente server `PartidosSection` (sin props), usa texto estable para e2e:
  - kicker: `Deporte`
  - título: `Nuestros equipos en acción`
  - enlace: `Ver agenda deportiva` (href `/deporte`).

- [ ] **Step 1: Write the failing e2e assertion**

Append to `e2e/homepage.spec.ts` inside `test.describe("Homepage")`:

```ts
test("shows the pro sports section linking to /deporte", async ({ page }) => {
  await page.goto("/");
  await page.waitForLoadState("networkidle");

  const heading = page.getByRole("heading", { name: /Nuestros equipos en acción/i });
  await expect(heading).toBeVisible({ timeout: 30_000 });
  await expect(page.locator('a[href="/deporte"]').first()).toBeVisible();
});
```

- [ ] **Step 2: Run e2e to verify it fails**

Run: `npx playwright test e2e/homepage.spec.ts`
Expected: FAIL — heading not found (still 3 passing).

> Nota: si Playwright requiere servidor en marcha (ver `playwright.config.ts` / `global-setup.ts`), arranca antes `npm run dev` o el comando que use el setup local.

- [ ] **Step 3: Write the component**

Create `app/components/PartidosSection.tsx`:

```tsx
import Link from "next/link";
import { getProximosPartidos } from "@/lib/partidos";
import type { Partido } from "@/lib/sources/clubCms";

const CLUB_NOMBRE: Record<string, string> = {
  baskonia: "Baskonia",
  alaves: "Alavés",
  araski: "Araski",
};

function formatearDia(fecha: string | null): string {
  if (!fecha) return "Fecha por confirmar";
  const d = new Date(fecha);
  if (isNaN(d.getTime())) return "Fecha por confirmar";
  return new Intl.DateTimeFormat("es-ES", {
    weekday: "short",
    day: "numeric",
    month: "short",
  }).format(d);
}

async function PartidoCard({ partido }: { partido: Partido }) {
  return (
    <article className="double-bezel rounded-2xl p-5 flex flex-col gap-3 card-hover h-full">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-sec-green">
          {CLUB_NOMBRE[partido.equipo] ?? partido.club}
        </span>
        <span className="text-xs text-fg-subtle font-mono">{formatearDia(partido.fecha)}</span>
      </div>
      <p className="text-sm text-fg-muted">{partido.competicion}</p>
      <div className="flex items-center justify-between gap-2 my-1">
        <div className="flex flex-col items-center gap-1 w-20">
          {partido.local.url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={partido.local.url} alt={partido.local.nombre} className="h-9 w-9 object-contain" />
          ) : (
            <span className="h-9 w-9 rounded-full bg-surface-hover flex items-center justify-center text-xs font-bold">
              {partido.local.nombre.slice(0, 1)}
            </span>
          )}
          <span className="text-xs text-center leading-tight">{partido.local.nombre}</span>
        </div>
        <span className="text-fg-subtle font-mono text-sm">vs</span>
        <div className="flex flex-col items-center gap-1 w-20">
          {partido.visitante.url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={partido.visitante.url} alt={partido.visitante.nombre} className="h-9 w-9 object-contain" />
          ) : (
            <span className="h-9 w-9 rounded-full bg-surface-hover flex items-center justify-center text-xs font-bold">
              {partido.visitante.nombre.slice(0, 1)}
            </span>
          )}
          <span className="text-xs text-center leading-tight">{partido.visitante.nombre}</span>
        </div>
      </div>
      <div className="flex items-center justify-between gap-2 mt-auto">
        <span className="text-xs text-fg-subtle">{partido.estadio || "Vitoria-Gasteiz"}</span>
        <span className="text-xs font-mono text-fg-muted">{partido.hora ? partido.hora.slice(0, 5) : "Hora por confirmar"}</span>
      </div>
      {partido.link && (
        <Link href={partido.link} target="_blank" rel="noopener noreferrer"
              className="text-sm font-semibold text-sec-green hover:underline">
          Entradas →
        </Link>
      )}
    </article>
  );
}

function PartidosSkeleton() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      {[1, 2, 3].map((i) => (
        <div key={i} className="h-48 bg-surface rounded-2xl animate-pulse" />
      ))}
    </div>
  );
}

export default async function PartidosSection() {
  const partidos = await getProximosPartidos(1);
  return (
    <section aria-label="Partidos de los equipos de Vitoria" className="px-5 sm:px-6 py-10 md:py-16 max-w-7xl mx-auto">
      <div className="flex items-end justify-between gap-4 flex-wrap mb-6">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-sec-green mb-2">Deporte</p>
          <h2 className="text-2xl md:text-4xl font-semibold text-fg">Nuestros equipos en acción</h2>
          <p className="text-fg-muted mt-1">Baskonia, Alavés y Araski, sus próximas citas.</p>
        </div>
        <Link href="/deporte" className="text-sm font-semibold text-accent hover:underline whitespace-nowrap">
          Ver agenda deportiva →
        </Link>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {partidos.length === 0 ? (
          <p className="text-fg-muted sm:col-span-3">No hay partidos confirmados todavía. Vuelve en unos días.</p>
        ) : (
          partidos.map((p) => <PartidoCard key={p.id} partido={p} />)
        )}
      </div>
    </section>
  );
}
```

> La plantilla usa los tokens actuales (`double-bezel`, `text-sec-green`); la Parte 2 del proyecto lo repintará al lenguaje Fever sin tocar la lógica.

Modify `app/page.tsx` — añadir el import y el nodo tras el `Suspense` de `<SectionsHub />` (entre líneas 217 y 219):

```tsx
// +++ imports
import PartidosSection from "./components/PartidosSection";

// +++ JSX, inmediatamente después de `</Suspense>` del SectionsHub:
      <Suspense
        fallback={
          <section className="px-5 sm:px-6 py-10 md:py-16 max-w-7xl mx-auto">
            <div className="h-3 w-20 bg-surface rounded mb-4" />
            <div className="h-8 w-64 bg-surface rounded-xl mb-6" />
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-48 bg-surface rounded-2xl animate-pulse" />
              ))}
            </div>
          </section>
        }
      >
        <PartidosSection />
      </Suspense>
```

- [ ] **Step 4: Run e2e to verify it passes**

Run: `npx playwright test e2e/homepage.spec.ts`
Expected: PASS (4 tests en "Homepage" + 1 en "Event detail").

- [ ] **Step 5: Lint + commit**

Run: `npm run lint`
Expected: sin errores.

```bash
git add app/components/PartidosSection.tsx app/page.tsx e2e/homepage.spec.ts
git commit -m "feat: seccion de partidos pro en la portada"
```

---

### Task 4: Bloque de partidos pro en `/deporte` (`ProMatchesBlock`)

**Files:**
- Create: `app/components/ProMatchesBlock.tsx`
- Modify: `app/deporte/page.tsx` (render `<ProMatchesBlock />` encima de `<SportPageClient />`)
- Create e2e: `e2e/deporte.spec.ts`

**Interfaces:**
- Consumes: `getProximosPartidos(3)` de `lib/partidos.ts` (Task 2).
- Produces: componente server `ProMatchesBlock` (sin props), título para e2e: `Partidos de los nuestros`.

- [ ] **Step 1: Write the failing e2e test**

Create `e2e/deporte.spec.ts`:

```ts
import { test, expect } from "@playwright/test";

test("deporte page shows the pro teams block", async ({ page }) => {
  await page.goto("/deporte");
  await page.waitForLoadState("networkidle");

  const heading = page.getByRole("heading", { name: /Partidos de los nuestros/i });
  await expect(heading).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText(/Baskonia/i).first()).toBeVisible();
  await expect(page.getByText(/Alavés/i).first()).toBeVisible();
});
```

- [ ] **Step 2: Run e2e to verify it fails**

Run: `npx playwright test e2e/deporte.spec.ts`
Expected: FAIL — heading not found.

- [ ] **Step 3: Write the component**

Create `app/components/ProMatchesBlock.tsx`:

```tsx
import Link from "next/link";
import { getProximosPartidos } from "@/lib/partidos";
import type { Partido } from "@/lib/sources/clubCms";

function formatearDia(fecha: string | null): string {
  if (!fecha) return "Fecha por confirmar";
  const d = new Date(fecha);
  if (isNaN(d.getTime())) return "Fecha por confirmar";
  return new Intl.DateTimeFormat("es-ES", { weekday: "short", day: "numeric", month: "short" }).format(d);
}

function RowPartido({ partido, index }: { partido: Partido; index: number }) {
  return (
    <li className="flex items-center gap-3 py-3 border-b border-border">
      <span className="font-mono text-xs text-fg-subtle w-5">{index + 1}</span>
      <div className="flex items-center gap-2 flex-1 min-w-0">
        {partido.local.url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={partido.local.url} alt={partido.local.nombre} className="h-6 w-6 object-contain shrink-0" />
        )}
        <span className="text-sm truncate">{partido.local.nombre}</span>
        <span className="text-xs text-fg-subtle">vs</span>
        <span className="text-sm truncate">{partido.visitante.nombre}</span>
      </div>
      <div className="text-right shrink-0">
        <p className="text-sm font-semibold">{formatearDia(partido.fecha)}</p>
        <p className="text-xs text-fg-subtle">
          {partido.hora ? partido.hora.slice(0, 5) : "Hora por confirmar"} · {partido.competicion}
        </p>
      </div>
    </li>
  );
}

export default async function ProMatchesBlock() {
  const partidos = await getProximosPartidos(3);
  if (partidos.length === 0) return null;

  return (
    <section aria-label="Partidos pro" className="px-5 sm:px-6 py-10 md:py-14 max-w-7xl mx-auto">
      <div className="flex items-end justify-between gap-4 flex-wrap mb-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-sec-green mb-2">Deporte · Profesional</p>
          <h2 className="text-2xl md:text-3xl font-semibold text-fg">Partidos de los nuestros</h2>
        </div>
        <Link href="/deporte" className="text-sm font-semibold text-accent hover:underline whitespace-nowrap">
          Agenda deportiva →
        </Link>
      </div>
      <ul className="double-bezel rounded-2xl px-4">
        {partidos.map((p, i) => (
          <RowPartido key={p.id} partido={p} index={i} />
        ))}
      </ul>
    </section>
  );
}
```

Modify `app/deporte/page.tsx` — import y render entre el `<JsonLd>` y `<SportPageClient />`:

```tsx
import ProMatchesBlock from "../components/ProMatchesBlock";
```

```tsx
      <Suspense
        fallback={
          <div className="px-5 sm:px-6 py-10 max-w-7xl mx-auto">
            <div className="h-6 w-56 bg-surface rounded-lg animate-pulse" />
          </div>
        }
      >
        <ProMatchesBlock />
      </Suspense>
      <SportPageClient eventos={eventos} />
```

> El archivo `app/components/SportPageClient.tsx` no se toca; el bloque nuevo va por encima.

- [ ] **Step 4: Run e2e to verify it passes**

Run: `npx playwright test e2e/deporte.spec.ts`
Expected: PASS.

- [ ] **Step 5: Lint + full test + commit**

Run: `npm run lint; if ($?) { npx jest }`
Expected: lint limpio; todo Jest verde.

```bash
git add app/components/ProMatchesBlock.tsx app/deporte/page.tsx e2e/deporte.spec.ts
git commit -m "feat: bloque de partidos pro en /deporte"
```

---

## Self-review notes (resumen para el executor)

- **Cobertura spec:** §1.1 → Task 1 (fuente CMS + auto-curación de temporada con `detectSeasonId`), §1.2 → Task 2 (Araski + fusión), §1.3 → Task 3 (home) y Task 4 (`/deporte`). Cifras de home ("Z partidos") y el pepper Fever de los componentes se implementan en el plan de la Parte 2, no en este.
- **Placeholder scan:** no hay "TBD/TODO"; cada paso lleva código real.
- **Consistencia de tipos:** `Partido`, `Escudo`, `ClubKey` y `getProximosPartidos(nPorEquipo)` se definen una vez (Task 1/2) y se consumen con las mismas firmas en Tasks 3-4. El e2e usa textos fijos: "Nuestros equipos en acción", "Partidos de los nuestros", "Ver agenda deportiva".