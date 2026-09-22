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

jest.mock("@/lib/cache", () => ({
  getCachedOrFetch: jest.fn(
    async (_key: string, _ttlMs: number, fetcher: () => Promise<unknown>) =>
      fetcher()
  ),
}));

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
});