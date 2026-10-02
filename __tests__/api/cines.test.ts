import { loadFixture, mockFetchWith } from "../helpers";

/**
 * El contrato de estas tres rutas lo consume la app movil, asi que es contrato:
 * por eso el test mira la forma, los nombres y los codigos de estado, y no solo
 * que la ruta devuelva algo.
 *
 * El cambio que motivates el fichero: las tres devolvian `{peliculas: []}` con
 * **200** cuando el scraping fallaba, y eso es indistinguible de "hoy no hay
 * peliculas". El cliente cacheaba el vacio. Ahora un fallo es 502 y un cine
 * sin cartelera sigue siendo un 200 con lista vacia, que es la distincion que
 * permitia perder datos sin que nadie se enterara.
 */

const FLORIDA_HTML = () => loadFixture("florida-listing.html");
const BOULEVARD_HTML = () => loadFixture("boulevard-listing.html");

function mockAmbosCines(opts: { florida?: number; boulevard?: number } = {}) {
  return mockFetchWith([
    {
      match: /reservaentradas\.com/,
      content: FLORIDA_HTML(),
      status: opts.florida ?? 200,
    },
    {
      match: /sensacine\.com/,
      content: BOULEVARD_HTML(),
      status: opts.boulevard ?? 200,
    },
  ]);
}

describe("GET /api/cines", () => {
  beforeEach(() => {
    jest.resetModules();
    // La cache de `lib/cache.ts` escribe en disco y sobrevive entre tests: sin
    // esto el segundo caso leeria el resultado del primero.
    jest.mock("@/lib/cache", () => ({
      getCachedOrFetch: <T>(_key: string, _ttl: number, fetcher: () => Promise<T>) =>
        fetcher(),
    }));
  });

  afterEach(() => {
    jest.restoreAllMocks();
    jest.unmock("@/lib/cache");
  });

  async function get() {
    const { GET } = await import("@/app/api/cines/route");
    return GET();
  }

  it("devuelve las peliculas de los dos cines con su etiqueta", async () => {
    mockAmbosCines();

    const res = await get();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(Array.isArray(body.peliculas)).toBe(true);
    expect(body.total).toBe(body.peliculas.length);

    const etiquetas = new Set(body.peliculas.map((p: { cine: string }) => p.cine));
    expect(etiquetas).toEqual(new Set(["Florida", "Boulevard"]));
  });

  it("anuncia las dos fuentes y no solo una", async () => {
    // Antes ponia la URL de Florida en las tres rutas, incluso aqui, que
    // devuelve los dos cines: el campo describia la mitad de lo que venia
    // debajo.
    mockAmbosCines();

    const body = await (await get()).json();

    expect(Array.isArray(body.urls)).toBe(true);
    expect(body.urls.length).toBe(2);
    expect(body.urls[0]).toContain("reservaentradas.com");
    expect(body.urls[1]).toContain("sensacine.com");
  });

  it("no dice que un cine fallo cuando los dos responden", async () => {
    mockAmbosCines();

    const body = await (await get()).json();

    expect(body.cinesConError).toBeUndefined();
  });

  it("devuelve 502 si los dos cines fallan", async () => {
    mockAmbosCines({ florida: 500, boulevard: 503 });

    const res = await get();
    const body = await res.json();

    expect(res.status).toBe(502);
    expect(body.error).toBeTruthy();
    // Sin `peliculas`, para que un cliente que lea el array por costumbre no
    // confunda un fallo con una cartelera vacia.
    expect(body.peliculas).toBeUndefined();
  });

  it("devuelve 200 con lo que hay y dice que cine fallo", async () => {
    // El caso que antes moria: si Boulevard caia, la respuesta era la de Florida
    // con status 200 y nada mas, y no habia forma de saber que faltaba medio cine.
    mockAmbosCines({ boulevard: 503 });

    const res = await get();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.cinesConError).toEqual(["Boulevard"]);
    expect(body.peliculas.length).toBeGreaterThan(0);
    expect(body.peliculas.every((p: { cine: string }) => p.cine === "Florida")).toBe(
      true
    );
  });

  it("devuelve 200 con lista vacia si un cine responde sin peliculas", async () => {
    // Un cine sin cartelera es un dato, no un fallo: el HTML responde bien y no
    // tiene peliculas.
    mockFetchWith([
      { match: /reservaentradas\.com/, content: "<html><body></body></html>" },
      { match: /sensacine\.com/, content: BOULEVARD_HTML() },
    ]);

    const res = await get();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.cinesConError).toBeUndefined();
    expect(body.peliculas.length).toBeGreaterThan(0);
    expect(body.peliculas.every((p: { cine: string }) => p.cine === "Boulevard")).toBe(
      true
    );
  });
});

describe("GET /api/cines/florida", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  async function get() {
    const { GET } = await import("@/app/api/cines/florida/route");
    return GET();
  }

  it("devuelve la cartelera de Florida con su URL", async () => {
    mockFetchWith([{ match: /reservaentradas\.com/, content: FLORIDA_HTML() }]);

    const res = await get();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.url).toContain("reservaentradas.com");
    expect(body.total).toBe(body.peliculas.length);
    expect(body.peliculas.length).toBeGreaterThan(0);
    // Esta ruta es de un solo cine: la etiqueta no aporta y no se añade.
    expect(body.peliculas[0].cine).toBeUndefined();
  });

  it("devuelve 502 si la fuente falla", async () => {
    mockFetchWith([{ match: /reservaentradas\.com/, content: "", status: 500 }]);

    const res = await get();

    expect(res.status).toBe(502);
    expect((await res.json()).peliculas).toBeUndefined();
  });
});

describe("GET /api/cines/boulevard", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  async function get() {
    const { GET } = await import("@/app/api/cines/boulevard/route");
    return GET();
  }

  it("devuelve la cartelera de Boulevard con su URL", async () => {
    mockFetchWith([{ match: /sensacine\.com/, content: BOULEVARD_HTML() }]);

    const res = await get();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.url).toContain("sensacine.com");
    expect(body.total).toBe(body.peliculas.length);
    expect(body.peliculas.length).toBeGreaterThan(0);
  });

  it("devuelve 502 si la fuente falla", async () => {
    mockFetchWith([{ match: /sensacine\.com/, content: "", status: 503 }]);

    const res = await get();

    expect(res.status).toBe(502);
    expect((await res.json()).peliculas).toBeUndefined();
  });
});