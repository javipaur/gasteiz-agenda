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

describe("GET /api/promo", () => {
  const FECHA = ymdEnDias(2);

  async function pedir(params = `?fecha=${FECHA}`) {
    jest.resetModules();
    mockSoloMunicipal(FECHA);
    const { GET } = await import("@/app/api/promo/route");
    return GET(new Request(`https://gasteizclick.javierpalacio.es/api/promo/${params}`));
  }

  it("devuelve el paquete con la forma cerrada que consume la publicación", async () => {
    const res = await pedir();
    const body = await res.json();

    expect(res.status).toBe(200);
    // Conjunto cerrado y no "tiene estas claves": un campo que sobra lo lee el
    // copiador sin querer y uno que falta rompe la publicación.
    expect(Object.keys(body).sort()).toEqual([
      "enlace",
      "imagenes",
      "pie",
      "portada",
      "texto",
    ]);
    expect(typeof body.portada).toBe("string");
    expect(Array.isArray(body.imagenes)).toBe(true);
    expect(typeof body.pie).toBe("string");
    expect(typeof body.texto).toBe("string");
    expect(typeof body.enlace).toBe("string");
  });

  it("el enlace lleva la utm con la fecha, y la del competidor no puede", async () => {
    // El competidor usa `utm_content=link_in_bio` fijo, que no dice qué post
    // funcionó. El nuestro lleva la fecha, y esa es toda la gracia: sin esto no hay
    // forma de saber qué post trajo gente.
    const body = await (await pedir()).json();

    expect(body.enlace).toContain("utm_source=ig");
    expect(body.enlace).toContain("utm_medium=social");
    expect(body.enlace).toContain(`utm_content=gasteizclick-${FECHA}`);
  });

  it("las URLs de las diapositivas son absolutas y del sitio desplegado", async () => {
    const body = await (await pedir()).json();

    expect(body.portada).toMatch(/^https:\/\/gasteizclick\.javierpalacio\.es\/api\/promo\//);
    // Y que haya diapositivas de verdad, que es lo que distingue este caso del anterior:
    // con la lista vacía el `for` no se ejecuta ni una vez y el test pasa sin comprobar
    // nada de las URLs.
    expect(body.imagenes.length).toBeGreaterThan(0);
    for (const url of body.imagenes) {
      expect(url).toMatch(/^https:\/\/gasteizclick\.javierpalacio\.es\/api\/promo\//);
    }
  });

  it("nunca más de nueve diapositivas, que es el límite de Instagram con la portada", async () => {
    const body = await (await pedir(`?fecha=${FECHA}&limite=50`)).json();

    // Portada más nueve. Si un día trae más, el selector recorta y el texto lo dice.
    expect(body.imagenes.length).toBeLessThanOrEqual(9);
  });

  it("acepta la ventana larga con `?desde=` y `?hasta=`", async () => {
    const body = await (
      await pedir(`?desde=${ymdEnDias(1)}&hasta=${FECHA}`)
    ).json();

    expect(body.enlace).toContain(`desde=${ymdEnDias(1)}`);
    expect(body.enlace).toContain(`hasta=${FECHA}`);
  });

  it("sin parámetros es el día de hoy, que es lo que hace falta para el post del día", async () => {
    // El caso de no tener que pasar `?fecha=` es el que se usa a diario, y por eso
    // necesita su propio caso: si la fecha por defecto no fuera la de hoy, el paquete
    // del día saldría con la agenda de otro día sin que nadie lo viera.
    const body = await (await pedir("")).json();

    const hoy = new Date();
    const ymd = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, "0")}-${String(
      hoy.getDate()
    ).padStart(2, "0")}`;

    expect(body.enlace).toContain(`desde=${ymd}`);
    expect(body.portada).toContain(ymd);
  });
});