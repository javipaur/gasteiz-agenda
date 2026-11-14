import { espiaErrores, loadFixture, mockFetchWith } from "../helpers";
import { scrapeEuskadi } from "@/lib/sources/euskadi";
import { CATEGORY_COLORS, normalizeCategory } from "@/lib/categories";

/**
 * Las fixtures de esta suite son **la página 1 duplicada**: declaran
 * `totalItems: 311` y sirven 20 ítems por página, así que el aviso de «declaraba
 * 311 y ha servido 80» sale en cada caso y es del fixture, no del scraper.
 *
 * Se silencia aquí y no en `helpers.ts` para no tapar los avisos de las otras 27
 * fuentes, y se recupera con la espía en los tests que sí miden el aviso.
 */
let avisos: jest.SpyInstance;

beforeEach(() => {
  avisos = jest.spyOn(console, "warn").mockImplementation(() => undefined);
});

/** Las URLs que el scraper pidió de verdad, para contar páginas. */
function urlsPedidas(fetchMock: jest.SpyInstance): string[] {
  return fetchMock.mock.calls.map((c) => String(c[0]));
}

/**
 * Una página de la API con `porPagina` ítems como máximo y una identidad única
 * por página, para que la deduplicación por `id` no disfrace el recuento.
 */
function paginaFalsa(totalItems: number, page: number, porPagina: number): string {
  const inicio = (page - 1) * porPagina;
  const cuantos = Math.max(0, Math.min(porPagina, totalItems - inicio));
  return JSON.stringify({
    totalItems,
    items: Array.from({ length: cuantos }, (_, i) => ({
      id: `euskadi-${page}-${i}`,
      nameEs: `Evento ${page}-${i}`,
      startDate: "2027-01-15T00:00:00Z",
      placeEs: "Vitoria-Gasteiz",
      typeEs: "Concierto",
    })),
  });
}

describe("scrapeEuskadi", () => {
  it("parses the Euskadi API JSON response", async () => {
    const json = loadFixture("euskadi-response.json");

    const fetchMock = mockFetchWith([
      { match: /api\.euskadi\.eus/, content: json },
    ]);

    const events = await scrapeEuskadi();

    expect(fetchMock).toHaveBeenCalled();
    expect(Array.isArray(events)).toBe(true);
    expect(events.length).toBe(20);

    for (const e of events) {
      expect(typeof e.title).toBe("string");
      expect(typeof e.date).toBe("string");
      expect(typeof e.source).toBe("string");
      expect(typeof e.category).toBe("string");
      expect(typeof e.location).toBe("string");
    }
  });

  it("normalizes every category the real payload produces into one with a color", async () => {
    // Euskadi manda `typeEs` en crudo, y cuando no lo reconoce manda "evento".
    // Sin un alias, esa categoria sale sin color en la tarjeta y con el
    // identificador en crudo en /agenda/[mes].
    //
    // **Lo que este test cubre, medido sobre la propia fixture: cinco tipos.**
    // `euskadi-response.json` son 20 ítems de los 311 que declara `totalItems`, la
    // página 1 de 16, y sus `typeEs` son Teatro, Concierto, Conferencia, Exposición
    // y Danza. Los cinco normalizan. Ese es su alcance real y está bien que sea
    // estrecho: es un guard de las cinco primeras páginas.
    //
    // Lo que **no** cubre es lo que hizo que 41 eventos de esta fuente llegaran sin
    // color a producción el 5 de octubre de 2026: `otro`, `formación` y `feria`, que
    // solo aparecen en las páginas 2 a 16 y que no están en ninguna fixture del
    // repo. La traducción de esos tres está en `__tests__/categories.test.ts`, con
    // el número medido al lado. Ningún test offline puede ver un vocabulario que
    // solo existe en la página 2 de una API: por eso aquí no se promete lo que no
    // comprueba, y por eso los aliases llevan la cuenta de dónde salió cada uno.
    mockFetchWith([
      { match: /api\.euskadi\.eus/, content: loadFixture("euskadi-response.json") },
    ]);

    const events = await scrapeEuskadi();
    expect(events.length).toBeGreaterThan(0);

    const sinColor = events
      .map((e) => normalizeCategory(e.category))
      .filter((c) => !CATEGORY_COLORS[c]);

    expect(sinColor).toEqual([]);
  });

  it("traps the 'evento' fallback the scraper uses when there is no type", () => {
    // El fallback literal del scraper, para que el alias no se pueda borrar
    // sin que alguien note que vuelve el bug.
    expect(normalizeCategory("evento")).toBe("Otros");
    expect(CATEGORY_COLORS[normalizeCategory("evento")]).toBeDefined();
  });

  it("maps rich fields (description, price, time, image, location)", async () => {
    const json = loadFixture("euskadi-response.json");

    mockFetchWith([{ match: /api\.euskadi\.eus/, content: json }]);

    const events = await scrapeEuskadi();
    const e = events[0];

    expect(e).toMatchObject({
      id: "2026090714222818",
      title: "Semana de Música Antigua de Álava 2026: Manuel Ruiz & Ílliber Ensemble",
      date: "2026-09-16T00:00:00Z",
      category: "concierto",
      price: "Gratis (con invitación)",
      time: "19:00",
      source: "euskadi",
    });
    expect(e.description).toBeTruthy();
    expect(e.description).toContain("Manuel Ruiz");
    expect(e.description).not.toContain("<");
  });

  it("returns an empty array when the API returns an error, and says so", async () => {
    mockFetchWith([
      { match: /api\.euskadi\.eus/, content: "", status: 500 },
    ]);
    const errorSpy = espiaErrores();

    const events = await scrapeEuskadi();
    expect(events).toEqual([]);
    /*
     * La lista vacía no es el contrato: el contrato es "lista vacía **y que se
     * diga**". Sin esta línea el test pasa igual con el scraper roto, y era
     * justo lo que pasaba — era la única fuente del registro sin un solo log.
     */
    expect(errorSpy).toHaveBeenCalledWith(expect.stringMatching(/euskadi/i));
  });

  it("returns an empty array when the response has no items", async () => {
    mockFetchWith([
      { match: /api\.euskadi\.eus/, content: JSON.stringify({ items: [] }) },
    ]);

    const events = await scrapeEuskadi();
    expect(events).toEqual([]);
  });

  /*
   * Las dos mitades del arreglo de paginación, y por qué cada una mira lo que
   * mira.
   *
   * El bug no era «se pierden eventos»: era que **cuántas páginas hay lo decía
   * una constante** (`MAX_PAGES = 5`) mientras la API lo decía en `totalItems`.
   * El día que la fuente pasara de 500 eventos, del 501 en adelante desaparecía
   * de la agenda sin un error y con la salud en 37/37.
   *
   * Por eso el primer test no comprueba un recuento de eventos «suficiente»:
   * comprueba que se piden **las páginas que la API declara**, contando las
   * peticiones. Un `events.length === 700` a secas pasaría igual si el scraper
   * pidiera una sola página con 700 ítems dentro, que no es lo que hace.
   */
  it("pide tantas páginas como declara totalItems, no un número fijo", async () => {
    const TOTAL = 700; // 7 páginas de 100
    const fetchMock = mockFetchWith([
      {
        match: /api\.euskadi\.eus/,
        content: (url) =>
          paginaFalsa(TOTAL, Number(new URL(url).searchParams.get("_page")) || 1, 100),
      },
    ]);

    const events = await scrapeEuskadi();

    // Siete páginas y no cinco: el techo viejo dejaba fuera 200 eventos.
    expect(urlsPedidas(fetchMock)).toHaveLength(7);
    expect(events).toHaveLength(TOTAL);
  });

  it("un totalItems absurdo se corta en el techo de seguridad y lo dice", async () => {
    const TOTAL = 20000; // 200 páginas declaradas; el techo son 100
    const fetchMock = mockFetchWith([
      {
        match: /api\.euskadi\.eus/,
        content: (url) =>
          paginaFalsa(TOTAL, Number(new URL(url).searchParams.get("_page")) || 1, 100),
      },
    ]);

    await scrapeEuskadi();

    // El techo existe para que un `totalItems` disparatado no se traduzca en
    // mil peticiones. Se piden 100, ni una más.
    expect(urlsPedidas(fetchMock)).toHaveLength(100);

    // Y lo que se queda fuera **se dice**, que es lo que convierte el corte en
    // algo visible y no en la desaparición silenciosa que este fichero persigue.
    expect(avisos).toHaveBeenCalledWith(expect.stringMatching(/20000 eventos declarados/));
  });
});
