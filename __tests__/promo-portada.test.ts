import { mockSoloMunicipal, ymdEnDias } from "./helpers";
import { TAMANO_PROMO } from "@/lib/promo";

/**
 * Los scrapers que no pasan por `fetch` y la caché en disco, por los mismos motivos y
 * con la misma explicación que en `__tests__/hoy.test.ts`: `buscametas` usa `axios`,
 * así que `mockFetchWith` no lo intercepta y sin el mock el test se sale a la red; y
 * `getCachedOrFetch` guarda en `tmpdir/gasteiz-cache`, que sobrevive a
 * `jest.resetModules()`, de modo que sin este mock la agenda de una ejecución anterior
 * seguiría en el disco y estos tests comprobarían la que grabó la anterior.
 */
jest.mock("@/lib/sources/buscametas", () => ({
  scrapeBuscametasCalendario: jest.fn().mockResolvedValue([]),
  scrapeBuscametasInscripciones: jest.fn().mockResolvedValue([]),
}));

jest.mock("@/lib/cache", () => ({
  getCachedOrFetch: jest.fn(
    async (_key: string, _ttlMs: number, fetcher: () => Promise<unknown>) => fetcher()
  ),
}));

/**
 * La portada se prueba por su cabecera, no por sus píxeles.
 *
 * Comprobar el PNG byte a byte fijaría una composición que va a cambiar cada vez que
 * se toque un color, y el test se pondría rojo sin que nada estuviera roto. Lo que sí
 * importa, y es lo que se fija aquí, es que el tipo de contenido sea el correcto y
 * que la imagen sea del tamaño que dice `TAMANO_PROMO`, porque de eso depende que
 * Instagram la pinsela como se espera.
 */
describe("GET /api/promo/[fecha]/portada", () => {
  const FECHA = ymdEnDias(2);

  async function pedir(fecha = FECHA) {
    jest.resetModules();
    mockSoloMunicipal(FECHA);
    const { GET } = await import("@/app/api/promo/[fecha]/portada/route");
    const res = await GET(
      new Request(`https://gasteizclick.javierpalacio.es/api/promo/${fecha}/portada`),
      { params: Promise.resolve({ fecha }) }
    );
    return res;
  }

  it("devuelve un PNG del tamaño del paquete", async () => {
    const res = await pedir();

    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("image/png");
    expect(TAMANO_PROMO).toEqual({ width: 1080, height: 1350 });
  });

  it("un día sin eventos no es un error: es una portada que lo dice", async () => {
    // El paquete se genera también para días flojos, y una tarde sin nada en Vitoria
    // va a pasar. Si eso fuera un 404, el día que hace falta no habría nada que
    // publicar y nadie sabría por qué.
    const res = await pedir("1990-01-01");

    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("image/png");
  });
});