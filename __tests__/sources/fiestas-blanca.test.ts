import { loadFixture, mockFetchWith } from "../helpers";

const MUNICIPAL = /vitoria-gasteiz\.org/;
const GASTEIZHOY = /gasteizhoy\.com/;

/**
 * El scraper de La Blanca no lleva el año escrito: lo lee de las fechas que
 * devuelve el calendario `calendariosID=513`, que vienen con su año en
 * `fechaInicio`.
 *
 * El fixture municipal es de **2027** a propósito. Si el scraper tuviera el año
 * cableado, estos tests pasarían igual con un fixture de 2026 y el fallo llegaría
 * en agosto de 2027, cuando la edición terminara y el rango pedido se hubiera
 * quedado en el año pasado. Con el año en los datos, el rango por defecto de
 * `fetchMunicipalCalendar` cubre la edición que haya.
 *
 * Se usa `jest.resetModules()` porque el scraper lleva una caché de 6 horas a
 * nivel de módulo: sin recargar, el segundo test recibiría el resultado del
 * primero.
 */
async function scraperLimpio() {
  jest.resetModules();
  return import("@/lib/sources/fiestas-blanca");
}

describe("scrapeFiestasBlanca", () => {
  it("lee el año de los datos del calendario, no del reloj", async () => {
    const { scrapeFiestasBlanca } = await scraperLimpio();
    const fetchMock = mockFetchWith([
      { match: MUNICIPAL, content: loadFixture("blanca-municipal.json") },
      { match: GASTEIZHOY, content: loadFixture("blanca-gasteizhoy.html") },
    ]);

    // La llamada importa por lo que provoca, no por lo que devuelve: lo que se
    // mira aquí son las URLs que se pidieron.
    await scrapeFiestasBlanca();

    // La página de GasteizHoy lleva el año en la URL, así que si el scraper
    // pidiera la del año equivocado no casaría ningún título con ninguna fecha y
    // las categorías se perderían sin un solo error.
    const pedidas = fetchMock.mock.calls.map((c) => String(c[0]));
    const deGasteizHoy = pedidas.filter((u) => GASTEIZHOY.test(u));
    expect(deGasteizHoy.length).toBeGreaterThan(0);
    for (const url of deGasteizHoy) {
      expect(url).toContain("la-blanca-2027-fiestas-de-vitoria");
      expect(url).not.toContain("2026");
    }
  });

  it("enriquece con la categoría de GasteizHoy que sí describe el evento", async () => {
    const { scrapeFiestasBlanca } = await scraperLimpio();
    mockFetchWith([
      { match: MUNICIPAL, content: loadFixture("blanca-municipal.json") },
      { match: GASTEIZHOY, content: loadFixture("blanca-gasteizhoy.html") },
    ]);

    const porTitulo = new Map(
      (await scrapeFiestasBlanca()).map((f) => [f.title, f.category])
    );

    // La etiqueta genérica de la fiesta no dice qué es el evento, así que se
    // descarta; la que sí lo dice se queda.
    expect(porTitulo.get("Chupinazo de las Fiestas")).toBe("La Blanca 2027");
    expect(porTitulo.get("Verbena en la Plaza de la Virgen Blanca")).toBe(
      "Conciertos La Blanca"
    );
  });

  it("hace una sola petición al calendario, no una por día", async () => {
    const { scrapeFiestasBlanca } = await scraperLimpio();
    const fetchMock = mockFetchWith([
      { match: MUNICIPAL, content: loadFixture("blanca-municipal.json") },
      { match: GASTEIZHOY, content: loadFixture("blanca-gasteizhoy.html") },
    ]);

    await scrapeFiestasBlanca();

    const alCalendario = fetchMock.mock.calls.filter((c) =>
      MUNICIPAL.test(String(c[0]))
    );
    // Antes: 27 días del 15 de julio al 10 de agosto, en lotes de 5. El rango
    // por defecto de `fetchMunicipalCalendar` es de hoy a hoy más un año, que es
    // la misma consulta en un solo `fd`/`fh`.
    expect(alCalendario).toHaveLength(1);
    expect(String(alCalendario[0][0])).toContain("calendariosID=513");
  });

  it("pide el calendario 513, no el de la agenda", async () => {
    const { scrapeFiestasBlanca } = await scraperLimpio();
    const fetchMock = mockFetchWith([
      { match: MUNICIPAL, content: loadFixture("blanca-municipal.json") },
      { match: GASTEIZHOY, content: loadFixture("blanca-gasteizhoy.html") },
    ]);

    await scrapeFiestasBlanca();

    const alCalendario = String(fetchMock.mock.calls[0][0]);
    expect(alCalendario).toContain("calendariosID=513");
    // 196 es el calendario general, del que se sirve `municipal-general`. Pedirlo
    // aquí devolvería la agenda entera con la categoría de La Blanca pegada.
    expect(alCalendario).not.toContain("calendariosID=196");
  });

  it("fuera de temporada no pide Gasteizhoy: no hay año que preguntarle", async () => {
    const { scrapeFiestasBlanca } = await scraperLimpio();
    const fetchMock = mockFetchWith([
      { match: MUNICIPAL, content: JSON.stringify({ actividades: { resultados: [] } }) },
      { match: GASTEIZHOY, content: loadFixture("blanca-gasteizhoy.html") },
    ]);

    const fiestas = await scrapeFiestasBlanca();

    expect(fiestas).toEqual([]);
    const aGasteizHoy = fetchMock.mock.calls.filter((c) =>
      GASTEIZHOY.test(String(c[0]))
    );
    expect(aGasteizHoy).toEqual([]);
  });

  it("mapea los campos que los consumidores de La Blanca leen de verdad", async () => {
    const { scrapeFiestasBlanca } = await scraperLimpio();
    mockFetchWith([
      { match: MUNICIPAL, content: loadFixture("blanca-municipal.json") },
      { match: GASTEIZHOY, content: loadFixture("blanca-gasteizhoy.html") },
    ]);

    const fiestas = await scrapeFiestasBlanca();
    const verbena = fiestas.find((f) => f.title.startsWith("Verbena"));

    expect(verbena).toMatchObject({
      date: "2027-07-26",
      dateEnd: "2027-07-26",
      timeStart: "22:00",
      timeEnd: "00:00",
      location: "Plaza de la Virgen Blanca",
      target: "Todos los públicos",
      dayWeek: "martes",
      cancelled: false,
    });
    // `url`, no `link`: es lo que leen `FiestasBlancaSection` y
    // `FiestasBlancaPageClient`, y lo que `agendaSlug` resuelve para la tarjeta.
    expect(verbena?.url).toContain("uid=blanca-verbena");
    // La imagen sale del `picture` cuando no hay `imagen`, que es el caso difícil
    // que se pierde si solo se lee `imagen`.
    expect(verbena?.image).toContain("verbena_smart.webp");
  });

  it("descarta lo cancelado antes de leer el año", async () => {
    const { scrapeFiestasBlanca } = await scraperLimpio();
    mockFetchWith([
      { match: MUNICIPAL, content: loadFixture("blanca-municipal.json") },
      { match: GASTEIZHOY, content: loadFixture("blanca-gasteizhoy.html") },
    ]);

    const fiestas = await scrapeFiestasBlanca();

    // El fixture trae un torneo cancelado. Si el cancelado se colara, su año
    // contaría para decidir en qué página de GasteizHoy buscar.
    expect(fiestas.map((f) => f.title)).not.toContain("Torneo de la Blanca");
  });

  it("devuelve vacío si el calendario falla, sin lanzar", async () => {
    const { scrapeFiestasBlanca } = await scraperLimpio();
    mockFetchWith([{ match: MUNICIPAL, content: "", status: 500 }]);

    await expect(scrapeFiestasBlanca()).resolves.toEqual([]);
  });
});