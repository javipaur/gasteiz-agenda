import { loadFixture, mockFetchWith, EMPTY_HTML } from "../helpers";
import { scrapeHelldorado } from "@/lib/sources/helldorado";

/**
 * La lista de la API de WordPress trae `date`, y esa es la fecha en que se
 * **publicó el artículo**, no la del concierto. `scrapeHelldorado` la usaba como
 * reserva —`date: date || e.postDate`— así que si la ficha de detalle fallaba el
 * concierto salía en la agenda el día que se anunció.
 *
 * El proyecto decidió lo contrario como norma explícita: **una fuente sin fecha no
 * entra en el registro**. Es la regla que Sacaron adelante Civitatis y Kora, y aquí
 * se incumplía en silencio, sin el `console.warn` que sí tienen ellas.
 */

/**
 * Un artículo con `postDate` dentro de un mes.
 *
 * Se genera en vez de leerse de un fixture porque el filtro de la lista compara
 * `postDate` con hoy: un fixture con fechas fijas deja de devolver eventos el día
 * que pasan, y el test se pudre solo. Es la trampa que `loadFixtureWithFutureDates`
 * resuelve para los fixtures de texto, y que aquí se resuelve en el test porque la
 * fecha va en un JSON.
 */
function articulos(n: number) {
  const dentro = new Date();
  dentro.setDate(dentro.getDate() + 30);
  const publicado = dentro.toISOString();

  return JSON.stringify(
    Array.from({ length: n }, (_, i) => ({
      id: 2300 + i,
      date: publicado,
      slug: `evento-${i}`,
      link: `https://helldorado.net/evento/evento-${i}/`,
      title: { rendered: `EVENTO ${i}` },
    }))
  );
}

describe("scrapeHelldorado", () => {
  it("parses future events from the WordPress REST API", async () => {
    const listJson = loadFixture("helldorado-future.json");
    const detailHtml = loadFixture("helldorado-detail.html");

    const fetchMock = mockFetchWith([
      { match: /helldorado\.net\/wp-json/, content: listJson },
      { match: /helldorado\.net\/evento\//, content: detailHtml },
      { match: /.*/, content: EMPTY_HTML },
    ]);

    const events = await scrapeHelldorado();

    expect(fetchMock).toHaveBeenCalled();
    expect(Array.isArray(events)).toBe(true);
    expect(events.length).toBeGreaterThan(0);

    for (const e of events) {
      expect(typeof e.title).toBe("string");
      expect(e.title.length).toBeGreaterThan(0);
      expect(typeof e.date).toBe("string");
      expect(e.date.length).toBeGreaterThan(0);
      expect(typeof e.location).toBe("string");
    }
  });

  it("parses the real captured list (past events are filtered out)", async () => {
    const realList = loadFixture("helldorado-response.json");

    mockFetchWith([
      { match: /helldorado\.net\/wp-json/, content: realList },
      { match: /.*/, content: EMPTY_HTML },
    ]);

    const events = await scrapeHelldorado();
    expect(Array.isArray(events)).toBe(true);
  });

  it("returns an empty array when the API is unreachable", async () => {
    mockFetchWith([
      { match: /helldorado\.net/, content: "", status: 500 },
    ]);

    const events = await scrapeHelldorado();
    expect(events).toEqual([]);
  });
});

describe("scrapeHelldorado, la fecha no se fabrica", () => {
  it("si la ficha de detalle no trae fecha, el evento no sale", async () => {
    // Este es el bug. `date || e.postDate` convertía "no hemos podido leer la
    // ficha" en "el concierto es el día que se anunció", que es un dato falso
    // en la agenda, en la home y en el digest — y con el slug dentro, tampoco
    // casaba con la ficha de detalle. La regla del repo es que sin fecha no entra.
    mockFetchWith([
      { match: /helldorado\.net\/wp-json/, content: articulos(2) },
      { match: /.*/, content: EMPTY_HTML },
    ]);

    const events = await scrapeHelldorado();

    expect(events).toEqual([]);
  });

  it("la fecha de la ficha sigue siendo la que manda", async () => {
    // El otro lado de la regla: quitar la reserva no puede condenar a los
    // artículos que sí traen fecha, que son los que funcionan.
    mockFetchWith([
      { match: /helldorado\.net\/wp-json/, content: articulos(1) },
      { match: /helldorado\.net\/evento\//, content: loadFixture("helldorado-detail.html") },
    ]);

    const events = await scrapeHelldorado();

    expect(events).toHaveLength(1);
    expect(events[0].date).toBe("2026-12-15");
  });
});

describe("scrapeHelldorado, los cortes se dicen", () => {
  it("avisa cuando la primera página falla", async () => {
    // El `break` sin log del bucle de paginación devolvía `[]` sin decir nada: un
    // 500 puntual era indistinguible de una sala sin cartelera. Y como la fecha
    // ya no se fabrica, ese `[]` es además la diferencia entre "no hay eventos" y
    // "no lo hemos podido mirar".
    const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => undefined);

    mockFetchWith([{ match: /helldorado\.net/, content: "", status: 500 }]);

    const events = await scrapeHelldorado();

    expect(events).toEqual([]);
    expect(warnSpy).toHaveBeenCalledWith(expect.stringMatching(/helldorado/i));
  });

  it("avisa cuando una página intermedia falla", async () => {
    // Un 500 en la página 2 con la 1 buena: el bucle salía por `break` y se
    // quedaba con la mitad de la cartelera, también sin decir nada.
    const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => undefined);

    mockFetchWith([
      { match: /page=1/, content: articulos(3), headers: { "X-WP-TotalPages": "5" } },
      { match: /.*/, content: "", status: 500 },
    ]);

    const events = await scrapeHelldorado();

    expect(warnSpy).toHaveBeenCalledWith(expect.stringMatching(/helldorado/i));
    expect(Array.isArray(events)).toBe(true);
  });
});