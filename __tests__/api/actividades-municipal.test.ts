import { loadFixture, mockFetchWith } from "../helpers";

/**
 * `/api/actividades` y `/api/actividades/navidad` devolvían lista vacía para
 * siempre, y no se enteraba nadie.
 *
 * Las dos rutas montaban su propia consulta a `CalendarioServlet?accion=buscar` y
 * leían `data.resultados`. **Esa clave no existe.** La respuesta es una bolsa de
 * secciones —en el fixture, `exposiciones`, `filtros`, `actividades` y `vista`— y
 * los eventos están dentro de cada sección, en `seccion.resultados`. Por eso
 * `lib/sources/municipal.ts` aplana con `Object.values(data).reduce(...)`.
 *
 * El `(data?.resultados || [])` convertía "no sé dónde está el dato" en "no hay
 * actividades", así que la respuesta era `200 {count: 0, data: []}` para siempre:
 * sin excepción, sin status raro y sin un solo log, porque leer una clave que no
 * existe no lanza nunca.
 *
 * Ahora las dos piden el dato a `scrapeMunicipalCalendar`, que es la única puerta
 * al calendario (lo mismo que hizo `d09f311` en `.../eventos/agenda`).
 *
 * La forma de la respuesta es contrato con la app móvil, así que se fija campo a
 * campo: no solo que ahora haya datos, sino que sigan siendo los mismos y con los
 * mismos nombres.
 */

type Envelope = {
  source: string;
  category: string;
  count: number;
  data: Record<string, unknown>[];
};

const CLAVES_ACTIVIDAD = [
  "category",
  "date",
  "description",
  "dest",
  "id",
  "image",
  "link",
  "source",
  "tipo",
  "title",
];

describe("las dos rutas del calendario municipal", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  async function get(calendario: "actividades" | "navidad"): Promise<Response> {
    jest.resetModules();
    const ruta =
      calendario === "actividades"
        ? "@/app/api/actividades/route"
        : "@/app/api/actividades/navidad/route";
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { GET } = require(ruta) as { GET: () => Promise<Response> };
    return GET();
  }

  const CALENDARIOS = [
    { nombre: "actividades", calendarioID: 196 },
    { nombre: "navidad", calendarioID: 566 },
  ] as const;

  for (const { nombre, calendarioID } of CALENDARIOS) {
    describe(`GET /api/${nombre}`, () => {
      it("devuelve las actividades del calendario, no una lista vacía", async () => {
        // Este es el que muerde. Con el código viejo la respuesta era
        // `{count: 0, data: []}` para siempre, y un test que solo mirara que la
        // ruta devuelve 200 seguía en verde.
        mockFetchWith([
          {
            match: /vitoria-gasteiz\.org/,
            content: loadFixture("municipal-response.json"),
          },
        ]);

        const res = await get(nombre);
        const body = (await res.json()) as Envelope;

        expect(res.status).toBe(200);
        expect(body.count).toBeGreaterThan(0);
        expect(body.data).toHaveLength(body.count);
      });

      it("pregunta a su calendario y sin filtros de tipo ni de destinatario", async () => {
        // `tipo` y `dest` son filtros de la *consulta*, no campos del evento: así
        // los usa el registro (`{ tipo: [6] }`, `{ dest: ["infantil"] }`). Estas dos
        // rutas piden el calendario entero, y si metieran un filtro las dos
        // devolverían listas distintas.
        const fetchMock = mockFetchWith([
          {
            match: /vitoria-gasteiz\.org/,
            content: loadFixture("municipal-response.json"),
          },
        ]);

        await get(nombre);

        const url = String(fetchMock.mock.calls[0][0]);
        expect(url).toContain(`calendariosID=${calendarioID}`);
        expect(url).not.toContain("%22tipo%22");
        expect(url).not.toContain('"tipo"');
        expect(url).not.toContain("%22dest%22");
        expect(url).not.toContain('"dest"');
      });

      it("conserva el envelope y los nueve campos que espera el cliente", async () => {
        mockFetchWith([
          {
            match: /vitoria-gasteiz\.org/,
            content: loadFixture("municipal-response.json"),
          },
        ]);

        const body = (await (await get(nombre)).json()) as Envelope;

        // Estas cuatro claves de fuera son lo que distingue la ruta: otras
        // envelopes del repo no las tienen.
        expect(Object.keys(body).sort()).toEqual(["category", "count", "data", "source"]);
        expect(body.source).toBe("vitoria-gasteiz");
        expect(body.category).toBe("eventos");

        for (const actividad of body.data) {
          // Conjunto cerrado de campos: uno nuevo no rompe al cliente, pero uno que
          // se vaya sí, y por eso se fija la lista entera.
          expect(Object.keys(actividad).sort()).toEqual(CLAVES_ACTIVIDAD);

          expect(typeof actividad.id).toBe("string");
          expect(actividad.id).not.toBe("");
          expect(typeof actividad.title).toBe("string");
          expect(typeof actividad.description).toBe("string");
          expect(typeof actividad.date).toBe("string");
          expect(typeof actividad.link).toBe("string");
          // La imagen sí puede ser `null`, que es lo que ya devolvía la versión
          // anterior; el resto de campos no admiten `null` porque el cliente los
          // pinta sin comprobar nada.
          expect(actividad.image === null || typeof actividad.image === "string").toBe(
            true
          );
          expect(actividad.category).toBe("eventos");
          expect(actividad.source).toBe("vitoria-gasteiz");
        }
      });

      it("da un id que no cambia entre peticiones, en vez de uno aleatorio", async () => {
        mockFetchWith([
          {
            match: /vitoria-gasteiz\.org/,
            content: loadFixture("municipal-response.json"),
          },
        ]);

        const primera = (await (await get(nombre)).json()) as Envelope;
        const segunda = (await (await get(nombre)).json()) as Envelope;

        // Antes el id caía a `crypto.randomUUID()` en la propia ruta, así que dos
        // peticiones del mismo evento daban dos ids: nada que deduplicar y ningún
        // favorito que sobreviva a un refresco. Ahora el id lo pone `normalizeEvento`
        // del scraper.
        expect(segunda.data.map((a) => a.id)).toEqual(primera.data.map((a) => a.id));
      });

      it("conserva el prefijo absoluto de las imágenes del Ayuntamiento", async () => {
        mockFetchWith([
          {
            match: /vitoria-gasteiz\.org/,
            content: loadFixture("municipal-response.json"),
          },
        ]);

        const body = (await (await get(nombre)).json()) as Envelope;

        for (const actividad of body.data) {
          if (actividad.image !== null) {
            expect(actividad.image).toMatch(/^https:\/\/www\.vitoria-gasteiz\.org\//);
          }
        }
      });

      it("no disfraza de cero actividades un calendario que no responde", async () => {
        // La ruta no inventa el dato ni lo aplana: si `scrapeMunicipalCalendar` falla,
        // se propaga como fallo. Lo que no puede pasar es un `200 {count: 0,
        // data: []}`, porque eso es idéntico a "el calendario respondió y no publica
        // nada" y el cliente no tiene forma de distinguirlos —ni de reintentar.
        mockFetchWith([{ match: /vitoria-gasteiz\.org/, content: "", status: 503 }]);

        const res = await get(nombre);
        const body = (await res.json()) as Partial<Envelope> & { error?: string };

        expect(res.status).toBeGreaterThanOrEqual(500);
        expect(body.error).toBeTruthy();
        expect(body.data).toBeUndefined();
      });

      it("sí responde con lista vacía cuando el calendario responde sin actividades", async () => {
        // El otro lado de la frontera, que es el que hay que seguir respetando: un
        // origen que contesta bien y no trae nada **es** un dato. `{}` son las
        // secciones sin `resultados`, que es lo que devuelve el aplanado cuando no
        // hay nada que aplanar.
        mockFetchWith([{ match: /vitoria-gasteiz\.org/, content: "{}" }]);

        const res = await get(nombre);

        expect(res.status).toBe(200);
        expect(await res.json()).toEqual({
          source: "vitoria-gasteiz",
          category: "eventos",
          count: 0,
          data: [],
        });
      });
    });
  }

  it("las dos piden calendarios distintos: Navidad no es el general", async () => {
    // Si las dos copiaran el mismo `calendariosID`, arreglar el aplanado en una y
    // no en la otra dejaría dos rutas devolviendo exactamente lo mismo sin que nada
    // se quejara.
    const urls: string[] = [];
    mockFetchWith([
      {
        match: /vitoria-gasteiz\.org/,
        content: loadFixture("municipal-response.json"),
      },
    ]);

    for (const { nombre } of CALENDARIOS) {
      const fetchMock = jest.spyOn(global, "fetch");
      await get(nombre);
      urls.push(String(fetchMock.mock.calls[0][0]));
      fetchMock.mockRestore();
    }

    expect(new Set(urls).size).toBe(2);
  });
});