import { getProximosPartidos } from "@/lib/partidos";
import { mockFetchWith } from "./helpers";

jest.mock("@/lib/cache", () => ({
  getCachedOrFetch: jest.fn(async (_k: string, _t: number, fn: () => Promise<unknown>) => fn()),
}));

jest.mock("fs/promises", () => {
  const futuro = new Date(Date.now() + 30 * 86400000).toISOString();
  return {
    readFile: jest.fn(async () =>
      JSON.stringify({
        equipo: "Kutxabank Araski",
        actualizado: new Date().toISOString().slice(0, 10),
        partidos: [
          {
            fecha: futuro,
            competicion: "Liga Femenina Endesa",
            local: { nombre: "Kutxabank Araski", escudo: null },
            visitante: { nombre: "IDK Euskotren", escudo: null },
            estadio: "Mendizorrotza",
            link: "https://kutxabankaraski.com",
          },
        ],
      })
    ),
  };
});

function mockCms() {
  const now = new Date();
  const far = new Date(now.getTime() + 10 * 86400000).toISOString().slice(0, 10);
  const ayer = new Date(now.getTime() - 86400000).toISOString().slice(0, 10);
  mockFetchWith([
    {
      match: /cms\.deportivoalaves\.com/,
      content: JSON.stringify({
        data: [
          { id: 1, attributes: { gameDate: far, gameTime: "20:00:00", homeTeam: { data: { attributes: { name: "Kosner Baskonia" } } }, awayTeam: { data: { attributes: { name: "Real Madrid" } } }, competition: { data: { attributes: { name: "Liga Endesa" } } } } },
          { id: 2, attributes: { gameDate: ayer, gameTime: "20:00:00", homeTeam: { data: { attributes: { name: "Kosner Baskonia" } } }, awayTeam: { data: { attributes: { name: "Real Madrid" } } }, competition: { data: { attributes: { name: "Liga Endesa" } } } } },
        ],
      }),
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
    const partidos = await getProximosPartidos();
    const ayer = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    const teamId = "baskonia";
    expect(partidos.some((p) => p.equipo === teamId && p.fecha?.startsWith(ayer))).toBe(false);
  });
});
