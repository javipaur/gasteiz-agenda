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

  it("uses the real Europe/Madrid offset for winter dates", async () => {
    mockFetchWith([
      { match: /cms\.deportivoalaves\.com/, content: game({ gameDate: "2026-11-15", gameTime: "20:45:00" }) },
    ]);
    const [primero] = await scrapePartidosCMS();
    expect(primero.fecha).toBe("2026-11-15T20:45:00+01:00");
  });
});