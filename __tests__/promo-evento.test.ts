import { mockSoloMunicipal, ymdEnDias } from "./helpers";

jest.mock("@/lib/sources/buscametas", () => ({
  scrapeBuscametasCalendario: jest.fn().mockResolvedValue([]),
  scrapeBuscametasInscripciones: jest.fn().mockResolvedValue([]),
}));

jest.mock("@/lib/cache", () => ({
  getCachedOrFetch: jest.fn(
    async (_key: string, _ttlMs: number, fetcher: () => Promise<unknown>) => fetcher()
  ),
}));

describe("GET /api/promo/[fecha]/evento/[slug]", () => {
  const FECHA = ymdEnDias(2);

  async function pedir(slug: string, fecha = FECHA) {
    jest.resetModules();
    mockSoloMunicipal(FECHA);
    const { GET } = await import("@/app/api/promo/[fecha]/evento/[slug]/route");
    return GET(new Request("https://gasteizclick.javierpalacio.es/"), {
      params: Promise.resolve({ fecha, slug }),
    });
  }

  it("devuelve un 404 visible para un slug que no existe", async () => {
    // Y no una tarjeta con un hueco, porque el enlace de una diapositiva publicada
    // tiene que poder romperse de forma visible: un rectángulo que no dice nada en un
    // post que ya está en la calle es peor que un 404, porque nadie va a mirar el
    // código de estado y el hueco parece un fallo del diseño.
    const res = await pedir("no-existe-este-slug");

    expect(res.status).toBe(404);
  });

  it("devuelve un PNG cuando el evento existe", async () => {
    // Para tener un slug real hay que pasar antes por el agregado, y el fixture se
    // pone en `FECHA` porque `getAgendaEventos()` descarta el pasado: con las fechas de
    // captura no quedaría ningún evento y el caso no se podría escribir.
    jest.resetModules();
    mockSoloMunicipal(FECHA);
    const { getAgendaEventos } = await import("@/lib/agenda");
    const [primero] = await getAgendaEventos();
    if (!primero) throw new Error("el fixture no trae eventos");

    const { GET } = await import("@/app/api/promo/[fecha]/evento/[slug]/route");
    const res = await GET(new Request("https://gasteizclick.javierpalacio.es/"), {
      params: Promise.resolve({ fecha: FECHA, slug: primero.slug }),
    });

    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("image/png");
  });
});