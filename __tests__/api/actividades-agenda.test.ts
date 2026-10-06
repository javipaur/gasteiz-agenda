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

  it("devuelve un 500 si el calendario falla, no una lista vacía", async () => {
    // Antes esta ruta devolvía 200 con `[]` porque `scrapeMunicipalCalendar`
    // resolvía en vez de rechazar al recibir un 5xx. Un 200 con lista vacía es
    // indistinguible de "el calendario no publica nada hoy", que es la razón por
    // la que el fallo se escondía. La ruta ya tenía un `catch` para esto: lo que
    // cambia es que pasa a ser alcanzable.
    mockFetchWith([{ match: /vitoria-gasteiz\.org/, content: "", status: 500 }]);

    const res = await get();

    expect(res.status).toBe(500);
    await expect(res.json()).resolves.toEqual({ error: "Error al consultar eventos" });
  });
});

/**
 * La ruta de visitas guiadas, que es la que se comió el mismo bug que el registro.
 *
 * Esta sí se mira **la URL que sale**, no el resultado, y el motivo está escrito en
 * `__tests__/sources/municipal.test.ts`: si el `tipo` no llegara, el fixture respondería
 * igual y el test pasaría viendo "eventos". Con `"visitias guiadas"` en vez de `[15]`
 * el body salía lleno de eventos del fixture y la ruta contestaba 200 con una lista
 * que el cliente no puede distinguir de "hoy no hay visitas guiadas".
 */
describe("GET /api/actividades/eventos/agenda/visitas", () => {
  async function get() {
    const { GET } = await import("@/app/api/actividades/eventos/agenda/visitas/route");
    return GET();
  }

  it("pregunta el tipo por su número, que es lo único que el servlet acepta", async () => {
    // Medido el 6 de octubre de 2026 contra el calendario 196: `"Visita guiada"`,
    // `"visita guiada"`, `"VISITA GUIADA"` y `"visitias guiadas"` devuelven **0** cada
    // una, y `[15]` devuelve 50. Cuatro formas de cadena, cuatro ceros, y el filtro que
    // no casa no da error: devuelve `[]`. Aquí eso no lo_convertía nadie en un aviso.
    const fetchMock = mockFetchWith([
      { match: /vitoria-gasteiz\.org/, content: loadFixture("municipal-response.json") },
    ]);

    await get();

    // El filtro viaja crudo en el `f` de la query, sin `encodeURIComponent`, así que se
    // lee tal cual sale. Y se separa del resto de la URL porque **una consulta se parte en
    // 38 peticiones al paginar** y todas llevan el mismo `f`: la aserción se queda con los
    // distintos, que son los que deciden el resultado, en vez de con las 38 ventanas.
    const filtros = [
      ...new Set(fetchMock.mock.calls.map((c) => new URL(String(c[0])).searchParams.get("f"))),
    ];
    // El control: la ruta tiene que mandar un filtro. Sin él, la lista de arriba serían
    // `null`s y la aserción de abajo pasaría sobre algo que no dice nada.
    expect(filtros.length).toBeGreaterThan(0);
    // Y el filtro tiene que ser el 15. El fallo sale con el filtro entero, que es el
    // bug entero: con la cadena sale `{"tipo":["visitias guiadas"]}` y el 0 del servlet.
    expect(filtros).toEqual(['{"tipo":[15]}']);
  });
});
