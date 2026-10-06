import { loadFixture, mockFetchWith } from "../helpers";
import { scrapeEuskadi } from "@/lib/sources/euskadi";
import { CATEGORY_COLORS, normalizeCategory } from "@/lib/categories";

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

  it("returns an empty array when the API returns an error", async () => {
    mockFetchWith([
      { match: /api\.euskadi\.eus/, content: "", status: 500 },
    ]);

    const events = await scrapeEuskadi();
    expect(events).toEqual([]);
  });

  it("returns an empty array when the response has no items", async () => {
    mockFetchWith([
      { match: /api\.euskadi\.eus/, content: JSON.stringify({ items: [] }) },
    ]);

    const events = await scrapeEuskadi();
    expect(events).toEqual([]);
  });
});
