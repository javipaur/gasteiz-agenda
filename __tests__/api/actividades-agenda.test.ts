import { loadFixture, mockFetchWith } from "../helpers";

/**
 * La forma de esta respuesta la consume una app móvil con `x-api-key`, así que es
 * contrato: por eso el test mira los nombres y los tipos de los campos, y no solo
 * que la ruta devuelva algo.
 *
 * Antes de que esta ruta usara `scrapeMunicipalCalendar` montaba su propia
 * consulta a `CalendarioServlet`. El cambio de dónde viene el dato no puede
 * cambiar lo que sale, así que esto fija los cinco campos que el cliente lee.
 */
describe("GET /api/actividades/eventos/agenda", () => {
  async function get() {
    const { GET } = await import("@/app/api/actividades/eventos/agenda/route");
    return GET();
  }

  it("devuelve una lista plana con los cinco campos que espera el cliente", async () => {
    mockFetchWith([
      { match: /vitoria-gasteiz\.org/, content: loadFixture("municipal-response.json") },
    ]);

    const res = await get();
    const body = await res.json();

    expect(Array.isArray(body)).toBe(true);
    expect(body.length).toBeGreaterThan(0);

    for (const evento of body) {
      // Exacto estos y ninguno más: un campo nuevo no rompe al cliente, pero un
      // campo que se va sí, y por eso se fija el conjunto cerrado.
      expect(Object.keys(evento).sort()).toEqual([
        "date",
        "image",
        "link",
        "location",
        "title",
      ]);
      expect(typeof evento.title).toBe("string");
      expect(typeof evento.date).toBe("string");
      expect(typeof evento.link).toBe("string");
      expect(typeof evento.location).toBe("string");
      // La imagen sí puede ser `null`: es lo que devolvía la versión anterior.
      expect(evento.image === null || typeof evento.image === "string").toBe(true);
    }
  });

  it("pregunta el calendario 196, que es el general, y no uno con filtro", async () => {
    const fetchMock = mockFetchWith([
      { match: /vitoria-gasteiz\.org/, content: loadFixture("municipal-response.json") },
    ]);

    await get();

    const url = String(fetchMock.mock.calls[0][0]);
    expect(url).toContain("calendariosID=196");
    // `tipo: 6` es lo que pide `.../agenda/eventos`. Si esta ruta lo añadiera, las
    // dos rutas devolverían listas distintas y dejarían de ser la misma consulta.
    expect(url).not.toContain("%22tipo%22");
    expect(url).not.toContain('"tipo"');
  });

  it("conserva el prefijo absoluto de las imágenes del Ayuntamiento", async () => {
    mockFetchWith([
      { match: /vitoria-gasteiz\.org/, content: loadFixture("municipal-response.json") },
    ]);

    const body = await (await get()).json();

    for (const evento of body) {
      if (evento.image !== null) {
        expect(evento.image).toMatch(/^https:\/\/www\.vitoria-gasteiz\.org\//);
      }
    }
  });

  it("devuelve una lista vacía si el calendario falla, no un 500", async () => {
    // `scrapeMunicipalCalendar` ya devuelve `[]` cuando la respuesta no es 2xx, y
    // esta ruta solo tiene que traducirlo. Un 500 aquí dejaría sin agenda a un
    // cliente que antes sí sabía leer una lista vacía.
    mockFetchWith([{ match: /vitoria-gasteiz\.org/, content: "", status: 500 }]);

    const res = await get();

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual([]);
  });
});