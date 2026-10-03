const mockAgenda = jest.fn();

jest.mock("@/lib/agenda", () => ({ getAgendaEventos: mockAgenda }));

import { loadFixture, mockFetchWith } from "../helpers";

/**
 * Dos rutas que convertían un fallo en un `200` con lista vacía, que es la cosa
 * que no se puede hacer cuando hay un cliente detrás que cachea.
 *
 * **La forma buena no se toca.** `/api/farmacias` y `/api/search` son contrato con
 * la app móvil, así que los tests fijan el envelope del camino que funciona, campo a
 * campo, antes de comprobar el camino que falla. Si las dos cosas se mezclaran, un
 * "arreglo" que cambiara la forma por el camino bueno pasaría igual.
 *
 * Los dos fallos tienen la misma raíz y son dos implementaciones distintas:
 *
 * - En `farmacias` el `catch` de la ruta era **inalcanzable**, porque
 *   `lib/sources/farmacias.ts` devolvía `[]` en sus dos salidas de error. Un 503 de
 *   opendata con la caché fría salía como `200 {count: 0, data: []}`.
 * - En `search` el `catch` existía pero devolvía `{results: []}` con 200 y sin mirar
 *   el error, que es byte a byte la respuesta de una búsqueda que no encuentra nada.
 *
 * El patrón es el que `389e5a5` aplicó a los cines: un origen que responde y no
 * tiene datos **es** un dato, y un origen que no responde es un fallo. Lo que no
 * puede ser es que los dos se vean iguales.
 */

type FarmaciasEnvelope = {
  source: string;
  date: string;
  count: number;
  fetchedAt: number;
  data: { id: string; name: string }[];
};

type SearchEnvelope = { results: unknown[] } & { error?: string };

const GEOJSON = () => loadFixture("farmacias-euskadi.geojson");

describe("GET /api/farmacias", () => {
  async function get(): Promise<Response> {
    jest.resetModules();
    return (await modulo()).GET();
  }

  /**
   * El módulo de la ruta, sin `resetModules` en medio.
   *
   * La caché de las 6 h vive en `lib/sources/farmacias.ts`, que es un módulo: sin
   * recargar el registro entre las dos llamadas, la segunda vería la copia de la
   * primera, que es justo lo que este caso necesita comprobar.
   */
  async function modulo(): Promise<{ GET: () => Promise<Response> }> {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require("@/app/api/farmacias/route") as { GET: () => Promise<Response> };
  }

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("el camino bueno no ha cambiado de forma", async () => {
    mockFetchWith([{ match: /opendata\.euskadi\.eus/, content: GEOJSON() }]);

    const res = await get();
    const body = (await res.json()) as FarmaciasEnvelope;

    expect(res.status).toBe(200);
    // El envelope entero, no solo que haya data: el cliente móvil y
    // `FarmaciasPageClient` leen las cinco claves.
    expect(Object.keys(body).sort()).toEqual([
      "count",
      "data",
      "date",
      "fetchedAt",
      "source",
    ]);
    expect(body.source).toBe("opendata-euskadi");
    expect(body.count).toBe(78);
    expect(body.data).toHaveLength(78);
    expect(typeof body.fetchedAt).toBe("number");
    // El directorio no publica turno, así que estos dos salen vacíos y el mapa ya
    // los trata como "no mostrar". Que sigan siendo "" y no null importa.
    expect(body.date).toBe("");
  });

  it("un 503 con la caché fría es un 502, no un directorio vacío", async () => {
    // Este es el que muerde. Con el código viejo: 200, `count: 0`, `data: []`, y
    // el móvil guardándose ese vacío en su caché sin reintentar nunca.
    mockFetchWith([{ match: /opendata\.euskadi\.eus/, content: "", status: 503 }]);

    const res = await get();
    const body = (await res.json()) as FarmaciasEnvelope & { error?: string };

    expect(res.status).toBe(502);
    expect(body.error).toBeTruthy();
    // Sin `data`: un cliente que lea el array por costumbre no puede confundir un
    // fallo con un directorio vacío.
    expect(body.data).toBeUndefined();
    expect(body.count).toBeUndefined();
  });

  it("un cuerpo que no es el GeoJSON también es un fallo, aunque venga con 200", async () => {
    // El WAF de Cofalava devolvía HTML con status 200 y eso acababa en el mapa
    // como "no hay farmacias". Cero farmacias no existe como dato: el GeoJSON
    // tiene 78 en Vitoria sin excepción.
    mockFetchWith([
      { match: /opendata\.euskadi\.eus/, content: "<html><body>Forbidden</body></html>" },
    ]);

    const res = await get();

    expect(res.status).toBe(502);
    expect((await res.json()).data).toBeUndefined();
  });

  it("con la copia de las 6 h poblada, una caída posterior sale 200 con los datos viejos", async () => {
    // La caché es lo que hace útil tenerla: datos viejos son datos, y vaciar un
    // mapa que se acaba de pintar porque opendata tuvo un mal momento sería peor que
    // servir lo de hace seis horas. Solo la caché fría propaga el fallo.
    jest.resetModules();
    const { GET } = await modulo();

    mockFetchWith([{ match: /opendata\.euskadi\.eus/, content: GEOJSON() }]);
    const primera = (await (await GET()).json()) as FarmaciasEnvelope;
    expect(primera.count).toBe(78);

    // Ahora la fuente se cae, y sin recargar el registro: la caché sigue en el
    // mismo módulo y es lo que decide entre propagar y servir lo viejo.
    jest.spyOn(global, "fetch").mockResolvedValue(new Response("", { status: 503 }));

    const segunda = await GET();
    const body = (await segunda.json()) as FarmaciasEnvelope;

    expect(segunda.status).toBe(200);
    expect(body.count).toBe(78);
    expect(body.data).toHaveLength(78);
  });
});

describe("GET /api/search", () => {
  function evento(over: { title: string; date?: string }) {
    const d = new Date();
    d.setDate(d.getDate() + 5);
    return {
      id: over.title,
      slug: over.title.toLowerCase().replace(/\s+/g, "-"),
      title: over.title,
      date: over.date ?? d.toISOString(),
      image: "https://example.com/img.jpg",
      location: "Vitoria-Gasteiz",
      link: "https://example.com/a",
      category: "Música",
      source: "fever",
    };
  }

  async function get(query: string): Promise<Response> {
    jest.resetModules();
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { GET } = require("@/app/api/search/route") as { GET: (r: Request) => Promise<Response> };
    return GET(new Request(`https://gasteizclick.test/api/search${query}`));
  }

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("el camino bueno no ha cambiado de forma", async () => {
    mockAgenda.mockResolvedValue([evento({ title: "Noche de jazz" })]);

    const res = await get("?q=jazz");
    const body = (await res.json()) as SearchEnvelope;

    expect(res.status).toBe(200);
    // Solo `results`, y con la forma de `SearchHit`. Un envelope de error aquí
    // rompería a `Header` y a `HeroSearch`, que leen `results` sin comprobar nada.
    expect(Object.keys(body).sort()).toEqual(["results"]);
    expect(body.results).toHaveLength(1);
    expect(Object.keys(body.results[0] as object).sort()).toEqual([
      "category",
      "date",
      "image",
      "location",
      "slug",
      "title",
    ]);
  });

  it("una búsqueda sin resultados sigue siendo un 200 con lista vacía", async () => {
    // El otro lado de la frontera, y no es un cambio: es lo que siempre fue un
    // "no hay resultados" de verdad. Si esto pasara a ser 503, el buscador
    // enseñaría un error donde no lo hay.
    mockAgenda.mockResolvedValue([evento({ title: "Noche de jazz" })]);

    const res = await get("?q=zarzuela-que-no-existe");

    expect(res.status).toBe(200);
    expect((await res.json()).results).toEqual([]);
  });

  it("no consulta la agenda si la búsqueda es demasiado corta", async () => {
    // Con menos de dos caracteres no hay nada que buscar, y eso se contesta sin
    // tocar el agregado. Es una respuesta real, no un fallo.
    const res = await get("?q=a");

    expect(res.status).toBe(200);
    expect((await res.json()).results).toEqual([]);
    expect(mockAgenda).not.toHaveBeenCalled();
  });

  it("un fallo al leer el agregado no se disfraza de 'sin resultados'", async () => {
    // Este es el que muerde. Con el código viejo: 200, `{results: []}` y ni un log.
    // El buscador pintaba "no hay nada" cuando lo que pasaba es que no se pudo leer
    // el índice, y eso no se distingue de un resultado honesto.
    mockAgenda.mockRejectedValue(new Error("EACCES: permiso denegado, .cache"));

    const res = await get("?q=jazz");
    const body = (await res.json()) as SearchEnvelope;

    expect(res.status).toBe(503);
    expect(body.error).toBeTruthy();
    expect(body.results).toBeUndefined();
  });

  it("el fallo queda escrito en el log, no solo en el status", async () => {
    // El `catch` viejo no miraba el error: ni lo guardaba ni lo imprimía. Con un
    // `results: []` y un 200 no había nada que buscar en los logs a la hora de
    // preguntarse por qué el buscador estaba vacío.
    const error = new Error("EACCES: permiso denegado, .cache");
    mockAgenda.mockRejectedValue(error);
    const log = jest.spyOn(console, "error").mockImplementation(() => {});

    await get("?q=jazz");

    expect(log).toHaveBeenCalled();
    expect(log.mock.calls[0].join(" ")).toContain("EACCES");
    log.mockRestore();
  });
});