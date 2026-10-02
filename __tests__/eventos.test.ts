const futureDate = "2026-10-05T20:00:00.000Z";
const futureDate2 = "2026-10-10T20:00:00.000Z";
const pastDate = "2025-05-01T10:00:00.000Z";

jest.mock("@/lib/sources/fever", () => ({
  scrapeFever: jest.fn().mockResolvedValue([
    { id: "f1", title: "Evento Duplicado", date: futureDate, location: "Sala 1", link: "/f1", image: "https://example.com/f1.jpg" },
  ]),
}));

jest.mock("@/lib/sources/rula", () => ({
  scrapeRula: jest.fn().mockResolvedValue([
    { title: "Evento Duplicado", date: futureDate, location: "Sala 2", link: "/f2", image: "https://example.com/f2.jpg" },
    { title: "Evento Unico", date: futureDate2, location: "Sala 3", link: "/f3", image: "https://example.com/f3.jpg" },
  ]),
}));

jest.mock("@/lib/sources/gasteizhoy", () => ({
  scrapeGasteizHoy: jest.fn().mockResolvedValue([
    { title: "Evento Pasado", date: pastDate, location: "Sala 4", link: "/p", image: "https://example.com/p.jpg" },
  ]),
}));

jest.mock("@/lib/sources/vam", () => ({
  scrapeVamEvents: jest.fn().mockResolvedValue([]),
  scrapeVamConciertos: jest.fn().mockResolvedValue([]),
}));

jest.mock("@/lib/sources/municipal", () => ({
  scrapeMunicipalCalendar: jest.fn().mockResolvedValue([]),
}));

jest.mock("@/lib/sources/euskadi", () => ({
  scrapeEuskadi: jest.fn().mockResolvedValue([]),
}));

jest.mock("@/lib/sources/municipal-rss", () => ({
  scrapeMunicipalRss: jest.fn().mockResolvedValue([]),
}));

jest.mock("@/lib/sources/eventbrite", () => ({
  scrapeEventbrite: jest.fn().mockResolvedValue([]),
}));

jest.mock("@/lib/sources/entradium", () => ({
  scrapeEntradium: jest.fn().mockResolvedValue([]),
}));

jest.mock("@/lib/sources/vital", () => ({
  scrapeVital: jest.fn().mockResolvedValue([]),
}));

jest.mock("@/lib/sources/arkabia", () => ({
  scrapeArkabia: jest.fn().mockResolvedValue([]),
}));

jest.mock("@/lib/sources/miniature", () => ({
  scrapeMiniature: jest.fn().mockResolvedValue([]),
}));

// `getProximosEventos` ya no scrapea: delega en `getAgendaEventos`, que corre las
// 27 entradas del registro. Las seis de aquí no estaban porque el módulo viejo no
// las usaba; sin estos mocks el test se iría a la red de verdad —y `rula` se baja
// 8,7 MB— y el recuento dependería de lo que publicaran las salas.
jest.mock("@/lib/sources/jimmyjazz", () => ({
  scrapeJimmyJazz: jest.fn().mockResolvedValue([]),
}));

jest.mock("@/lib/sources/helldorado", () => ({
  scrapeHelldorado: jest.fn().mockResolvedValue([]),
}));

jest.mock("@/lib/sources/musikaze", () => ({
  scrapeMusikaze: jest.fn().mockResolvedValue([]),
}));

// `scrapeBuscametasInscripciones` pasa a devolver `dateRango` ademas de `date`
// (el sitio publica algunos como "31/10/2026 - 01/11/2026"). El mock lo refleja
// para que un test de este fichero no falle por la forma.
jest.mock("@/lib/sources/buscametas", () => ({
  scrapeBuscametasCalendario: jest.fn().mockResolvedValue([]),
  scrapeBuscametasInscripciones: jest.fn().mockResolvedValue([]),
}));

jest.mock("@/lib/sources/senderismo", () => ({
  scrapeSenderismo: jest.fn().mockResolvedValue([]),
}));

jest.mock("@/lib/sources/fiestas-blanca", () => ({
  scrapeFiestasBlanca: jest.fn().mockResolvedValue([]),
}));

jest.mock("@/lib/cache", () => ({
  getCachedOrFetch: jest.fn(
    async (_key: string, _ttlMs: number, fetcher: () => Promise<unknown>) =>
      fetcher()
  ),
}));

import { SOURCE_DATA } from "@/lib/source-data";
import { getProximosEventos } from "@/lib/eventos";

describe("getProximosEventos", () => {
  it("deduplicates by title|date and excludes past events", async () => {
    const eventos = await getProximosEventos();

    expect(Array.isArray(eventos)).toBe(true);
    expect(eventos.length).toBe(2);

    const titles = eventos.map((e) => e.title);
    expect(titles).toContain("Evento Duplicado");
    expect(titles).toContain("Evento Unico");
    expect(titles).not.toContain("Evento Pasado");

    const dupCount = eventos.filter((e) => e.title === "Evento Duplicado").length;
    expect(dupCount).toBe(1);
  });

  it("normalizes events to the canonical Evento shape", async () => {
    const eventos = await getProximosEventos();

    for (const e of eventos) {
      expect(typeof e.id).toBe("string");
      expect(e.id.length).toBeGreaterThan(0);
      expect(typeof e.title).toBe("string");
      expect(typeof e.date).toBe("string");
      expect(typeof e.link).toBe("string");
      expect(typeof e.source).toBe("string");
    }
  });

  it("filters by startDate range", async () => {
    const eventos = await getProximosEventos({
      startDate: "2026-10-09",
      endDate: "2026-10-11",
    });

    expect(Array.isArray(eventos)).toBe(true);
    expect(eventos.length).toBe(1);
    expect(eventos[0].title).toBe("Evento Unico");
  });

  it("sorts events chronologically", async () => {
    const eventos = await getProximosEventos();
    const dates = eventos.map((e) => new Date(e.date).getTime());
    for (let i = 1; i < dates.length; i++) {
      expect(dates[i - 1]).toBeLessThanOrEqual(dates[i]);
    }
  });

  it("devuelve el agregado sin retocar: id === slug y la fuente es un id del registro", async () => {
    // Lo que hacía especial al módulo viejo era justo esto: `id` era un
    // `crypto.randomUUID()` que cambiaba en cada re-scraping, y `source` era una
    // etiqueta inventada ("vitoria-gasteiz", "vitoria-gasteiz-rss"). Si el
    // wrapper volviera a renombrar algo, sería para volver a romper los
    // favoritos guardados, así que se ata aquí.
    const ids = new Set(SOURCE_DATA.map((e) => e.id));
    const eventos = await getProximosEventos();

    expect(eventos.length).toBeGreaterThan(0);
    for (const e of eventos) {
      expect(e.id).toBe(e.slug);
      expect(ids.has(e.source)).toBe(true);
    }
  });
});
