import { loadFixture, mockFetchWith, EMPTY_HTML } from "../helpers";
import { scrapeGasteizHoy } from "@/lib/sources/gasteizhoy";

/**
 * Todas las celdas de fecha que hay en el fixture, leídas del propio HTML.
 *
 * Escritas a mano serían una segunda copia de la verdad que se pudre con el fixture
 * y en silencio: el día que se recapture con otro mes, estas cadenas seguirían
 * diciendo septiembre y el reloj clavado en septiembre volvería a dar verde sobre un
 * fixture que ya no tiene nada que ver. Leyéndolas del fichero, si el fixture
 * cambia, o el reloj se mueve, o el test dice que no.
 */
function celdasDelFixture(html: string): string[] {
  return [...html.matchAll(/data-mec-cell="(\d{8})"/g)].map((m) => {
    const c = m[1];
    return `${c.slice(0, 4)}-${c.slice(4, 6)}-${c.slice(6, 8)}`;
  });
}

/**
 * El reloj queda clavado en un punto **dentro** del mes que cubre el fixture, y no
 * en "hoy", por la razón que `loadFixtureWithFutureDates` documenta para los otros
 * scrapers y que aquí no se podía resolver con ese helper.
 *
 * Este fixture es un calendario MEC y sus fechas no están en un texto: están en los
 * atributos `data-mec-cell="YYYYMMDD"`, `data-day`, `data-month="YYYYMM"` y en los
 * `id="mec-calendar-events-sec-mec1-YYYYMMDD"`, y el parser las lee de ahí.
 * Reescribirlas a futuro es posible, pero obligaría al helper a entender la rejilla
 * del mes, con su mes vecino arrastrado y su `data-day`. Y un helper que reescribe
 * una rejilla y otro que reescribe una etiqueta textual son dos maneras distintas de
 * que la misma suite se pudra por sitios distintos.
 *
 * Lo que se hace aquí es lo otro, y además ejercita más de lo que ejercitaba:
 *
 * - **Con el reloj real, este test se pudre.** El fixture se capturó con celdas de
 *   `20260901` a `20261004`. En cuanto pasó el 4 de octubre, `dateStr < today` las
 *   descartó todas, `events.length` quedó en `0` y nadie había tocado el scraper. Es
 *   la trampa de siempre —un fixture con fechas fijas caduca—, y el rojo llegó por el
 *   sitio menos legible: el stack señalaba la aserción de longitud, no la fecha que ya
 *   no era de este mes.
 * - **Con el reloj clavado se comprueban las dos mitades de la rejilla a la vez.**
 *   Las celdas anteriores al 15 tienen que desaparecer y las posteriores tienen que
 *   aparecer. Un fixture reescrito al futuro solo probaría la segunda mitad, y el
 *   filtro de "nada del pasado" es justo lo que interesa que no se rompa.
 *
 * `doNotFake` está porque `mockFetchWith` devuelve `Response` de verdad, cuyo
 * `text()` no debe depender de un `setTimeout` que ya no avanza.
 */
const MEDIO_DEL_MES_DEL_FIXTURE = new Date("2026-09-15T12:00:00Z");

const RUTAS_DEL_FIXTURE = [
  { match: /gasteizhoy\.com\/ociogasteiz\/\?view=list/, content: "" },
  { match: /gasteizhoy\.com\/ociogasteiz\/?$/, content: "" },
  { match: /.*/, content: EMPTY_HTML },
];

function mockConElCalendario(calendarHtml: string) {
  return mockFetchWith(
    RUTAS_DEL_FIXTURE.map((r) => (r.content === "" ? { ...r, content: calendarHtml } : r))
  );
}

describe("scrapeGasteizHoy", () => {
  beforeEach(() => {
    jest.useFakeTimers({ doNotFake: ["setTimeout", "setInterval", "setImmediate"] });
    jest.setSystemTime(MEDIO_DEL_MES_DEL_FIXTURE);
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it("el reloj clavado cae dentro de lo que el fixture cubre, y con días a ambos lados", () => {
    // Se afirma antes y por separado, como en `entradium.test.ts`. Sin esto, los
    // casos de abajo pasarían sin probar nada el día que el reloj real coincidiera
    // con el mes del fixture, que es la clase de test que no puede fallar y por eso
    // no vale.
    const celdas = celdasDelFixture(loadFixture("gasteizhoy-listing.html"));
    const hoy = MEDIO_DEL_MES_DEL_FIXTURE.toISOString().slice(0, 10);

    expect(celdas.filter((c) => c < hoy).length).toBeGreaterThan(0);
    expect(celdas.filter((c) => c >= hoy).length).toBeGreaterThan(0);
  });

  it("parses the calendar HTML into normalized events", async () => {
    const fetchMock = mockConElCalendario(loadFixture("gasteizhoy-listing.html"));

    const events = await scrapeGasteizHoy();
    const today = new Date().toISOString().slice(0, 10);

    expect(fetchMock).toHaveBeenCalled();
    expect(Array.isArray(events)).toBe(true);
    expect(events.length).toBeGreaterThan(0);

    for (const e of events) {
      expect(typeof e.title).toBe("string");
      expect(e.title.length).toBeGreaterThan(0);
      expect(e.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(e.date >= today).toBe(true);
      expect(typeof e.link).toBe("string");
      expect(e.source).toBe("gasteizhoy");
    }
  });

  it("descarta las celdas que ya han pasado", async () => {
    // Lo que el caso de arriba no dice: que las celdas anteriores al 15 no salen.
    // Sin esto, "devuelve algo" y "filtra el pasado" serían el mismo test, y un
    // scraper que no filtrara nada pasaría los dos.
    const calendarHtml = loadFixture("gasteizhoy-listing.html");
    mockConElCalendario(calendarHtml);

    const events = await scrapeGasteizHoy();
    const today = new Date().toISOString().slice(0, 10);

    const celdasConEvento = new Set(events.map((e) => e.date.replace(/-/g, "")));
    const celdasPasadas = celdasDelFixture(calendarHtml).filter((c) => c < today);

    expect(celdasPasadas.length).toBeGreaterThan(0);
    for (const c of celdasPasadas) {
      expect(celdasConEvento.has(c.replace(/-/g, ""))).toBe(false);
    }
  });

  it("returns an empty array when the calendar fetch fails", async () => {
    mockFetchWith([{ match: /gasteizhoy\.com/, content: "", status: 500 }]);

    const events = await scrapeGasteizHoy();
    expect(events).toEqual([]);
  });

  it("is resilient to malformed HTML", async () => {
    mockFetchWith([{ match: /.*/, content: "<html><div>no calendar here</div></html>" }]);

    const events = await scrapeGasteizHoy();
    expect(Array.isArray(events)).toBe(true);
  });
});