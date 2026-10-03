import { loadFixture, mockFetchWith } from "../helpers";
import { getCachedOrFetch } from "@/lib/cache";
import { scrapeRula } from "@/lib/sources/rula";

const TOKEN_PREVIO = process.env.MEC_TOKEN;

/** El TTL que declara la entrada `rula` del registro. */
const TTL_RULA = 2 * 60 * 60 * 1000;

describe("scrapeRula", () => {
  // El token viene del entorno y sin el el API responde 500, asi que los tests
  // que llegan al fetch tienen que ponerlo.
  beforeEach(() => {
    process.env.MEC_TOKEN = "token-de-prueba";
  });

  afterAll(() => {
    if (TOKEN_PREVIO === undefined) {
      delete process.env.MEC_TOKEN;
    } else {
      process.env.MEC_TOKEN = TOKEN_PREVIO;
    }
  });

  it("envia el token MEC en la cabecera", async () => {
    const json = loadFixture("rula-response.json");
    const fetchMock = mockFetchWith([
      { match: /lagenterula\.com\/wp-json\/mec\//, content: json },
    ]);

    await scrapeRula();

    const [, init] = fetchMock.mock.calls[0];
    expect((init?.headers as Record<string, string>)["mec-token"]).toBe(
      "token-de-prueba"
    );
  });

  it("sin token no llama a la red y rechaza", async () => {
    // Sin token el API responde 500: es mejor no gastar la descarga de 6,5 MB. Y
    // la fuente caerse sola no puede tumbar la agenda.
    //
    // **Rechaza** y no devuelve `[]`, y esa es toda la diferencia. Antes devolvía
    // `[]`, que `lib/cache.ts` escribía en disco con el TTL de 2 h de la entrada
    // del registro: cambiar `MEC_TOKEN` en Dokploy no recalculaba nada, y
    // recuperar la fuente exigía 2 h o un redeploy. El `README` promete justo lo
    // contrario —"es deliberado, para que rotar el token sea cambiar una variable y
    // no editar código"— y con `return []` la promesa era falsa.
    //
    // `fetchAndStore` solo escribe **después** de que el `fetcher` resuelva, así que
    // una promesa rechazada no deja nada cacheado. Y `Promise.allSettled` en
    // `lib/agenda.ts` recoge el fallo, lo loguea como `scraping_failed` y sigue.
    delete process.env.MEC_TOKEN;
    const fetchMock = mockFetchWith([
      { match: /lagenterula\.com/, content: loadFixture("rula-response.json") },
    ]);

    await expect(scrapeRula()).rejects.toThrow(/MEC_TOKEN/);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("la ausencia de token no se cachea: en la siguiente llamada ya se lee la variable", async () => {
    // La propiedad de punta a punta, que es la que el `README` promete: definir el
    // token tiene efecto en la petición siguiente, sin esperar al TTL ni reiniciar.
    //
    // La clave lleva marca de tiempo a propósito. Con una clave fija, una ejecución
    // anterior que escribiese el fichero en `%TEMP%/gasteiz-cache` haría que este
    // test pasara por el motivo equivocado —leería una caché de otro día— en vez de
    // por el que lo está comprobando.
    const clave = `test:rula-sin-token:${process.pid}:${Date.now()}`;
    delete process.env.MEC_TOKEN;

    const fetchMock = mockFetchWith([
      { match: /lagenterula\.com/, content: loadFixture("rula-response.json") },
    ]);

    await expect(getCachedOrFetch(clave, TTL_RULA, scrapeRula)).rejects.toThrow(/MEC_TOKEN/);
    expect(fetchMock).not.toHaveBeenCalled();

    // Se define la variable y la siguiente llamada sale a la red: no hay nada
    // escrito en disco que la shortcircuitee.
    process.env.MEC_TOKEN = "token-de-prueba";
    const events = await getCachedOrFetch(clave, TTL_RULA, scrapeRula);

    expect(fetchMock).toHaveBeenCalled();
    expect(Array.isArray(events)).toBe(true);
  });

  it("parses the MEC API JSON response into normalized events", async () => {
    const json = loadFixture("rula-response.json");

    const fetchMock = mockFetchWith([
      { match: /lagenterula\.com\/wp-json\/mec\//, content: json },
    ]);

    const events = await scrapeRula();

    expect(fetchMock).toHaveBeenCalled();
    expect(Array.isArray(events)).toBe(true);

    if (events.length > 0) {
      for (const e of events) {
        expect(typeof e.title).toBe("string");
        expect(e.title.length).toBeGreaterThan(0);
        expect(typeof e.date).toBe("string");
        expect(typeof e.link).toBe("string");
      }
    }
  });

  it("returns an empty array when the API returns an error", async () => {
    mockFetchWith([
      { match: /lagenterula\.com/, content: "", status: 500 },
    ]);

    const events = await scrapeRula();
    expect(events).toEqual([]);
  });

  it("filters out past events", async () => {
    const fixture = JSON.parse(loadFixture("rula-response.json"));
    const today = new Date().toISOString().slice(0, 10);

    mockFetchWith([
      { match: /lagenterula\.com/, content: JSON.stringify(fixture) },
    ]);

    const events = await scrapeRula();
    for (const e of events) {
      expect(e.date >= today).toBe(true);
    }
  });
});