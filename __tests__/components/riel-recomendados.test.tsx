/**
 * @jest-environment jsdom
 */

/**
 * El riel de la home se alimenta del selector de recomendados, no del de populares.
 *
 * **Por qué esto necesita un test y no es una manía de estilo.** El riel se llama
 * `TopEventsSection` y su cabecera decía "Top 10 · Los planes que más suenan esta
 * semana", que es exactamente lo que pintaba `getPopularEvents`: los diez de **toda** la
 * agenda, sin ventana de fecha. Ahora lo que se pinta son los recomendados **de hoy**,
 * por el mismo criterio que `/hoy` y que el paquete de redes. El componente no ha
 * cambiado; lo que ha cambiado es quién le pasa la lista, y eso es invisible para
 * cualquiera que mire el JSX.
 *
 * El caso que importa es el segundo: **que la cabecera no vuelva a decir "Top 10"**. Un
 * riel que se llama así y pinta los recomendados de hoy no es un detalle, es una
 * mentira en la primera pantalla, y es la clase de mentira que sobrevive porque nadie
 * mira el rótulo después de escribirlo una vez.
 */
import { escenario } from "../helpers-a11y";

jest.mock("@/lib/sources/buscametas", () => ({
  scrapeBuscametasCalendario: jest.fn().mockResolvedValue([]),
  scrapeBuscametasInscripciones: jest.fn().mockResolvedValue([]),
}));

jest.mock("@/lib/cache", () => ({
  getCachedOrFetch: jest.fn(
    async (_key: string, _ttlMs: number, fetcher: () => Promise<unknown>) => fetcher()
  ),
}));

type Modulo = {
  default: (props: Record<string, unknown>) => unknown;
};

/** Un evento con imagen, que es lo que el selector deja pasar. */
function ev(over: Record<string, unknown> = {}) {
  return {
    id: "e1",
    slug: "concierto-de-prueba",
    title: "Concierto de prueba",
    date: "2030-05-01T20:00:00.000Z",
    location: "Sala Ganueta",
    link: "/evento/concierto-de-prueba",
    category: "Conciertos",
    source: "jimmyjazz",
    image: "https://sarrerak.jimmyjazzgasteiz.com/cartel.jpg",
    ...over,
  };
}

function montarRiel(eventos: unknown[], ranking = true) {
  const esc = escenario<Modulo>("@/app/components/TopEventsSection");
  const conRanking = ranking
    ? (eventos as Array<Record<string, unknown>>).map((e, i) => ({ ...e, ranking: i + 1 }))
    : eventos;
  const nodo = esc.crear(esc.modulo.default, { events: conRanking });
  return { vista: esc.montar(esc.conProviders(nodo)), ...esc };
}

describe("el riel de recomendados de la home", () => {
  /** Cuatro, que es lo mínimo que el riel pinta: por debajo corta con `return null`. */
const CUATRO = [ev({ id: "a" }), ev({ id: "b" }), ev({ id: "c" }), ev({ id: "d" })];

  it("dice que son los recomendados de hoy, y no un top de toda la agenda", () => {
    const { vista } = montarRiel(CUATRO);

    expect(vista.texto()).toContain("Recomendados");
    // Las dos formas que mienten. El rótulo es lo que se lee, y "top 10" sobre una
    // lista de un solo día es exactamente el tipo de cosa que nadie va a revisar.
    expect(vista.texto()).not.toContain("Top 10");
    expect(vista.texto()).not.toMatch(/m[aá]s suenan/i);
    vista.desmontar();
  });

  it("enlaza a /hoy, que es donde está la lista entera", () => {
    const { vista } = montarRiel(CUATRO);

    const enlaces = vista
      .consultarTodos("a")
      .map((a) => a.getAttribute("href"))
      .filter((h): h is string => h !== null);
    expect(enlaces).toContain("/hoy");
    vista.desmontar();
  });

  it("se pinta con la lista que le llega, sin decidir nada de la ventana", () => {
    // El componente **no** filtra por fecha: la ventana la aplica el selector, en el
    // servidor, antes de llegar aquí. Este caso fija esa frontera a propósito, que es
    // lo que hace que el mismo componente sirva para hoy y para un día futuro sin
    // duplicar la lógica de fechas.
    //
    // Cuatro eventos porque el componente corta por debajo de cuatro, y un caso con
    // menos no miraría nada: el `return null` de abajo lo tapa todo.
    const { vista } = montarRiel(CUATRO);

    expect(vista.consultarTodos("a[href^='/evento/']")).toHaveLength(4);
    vista.desmontar();
  });

  it("con menos de cuatro no pinta nada, como antes", () => {
    // El `return null` con `events.length < 4` viene del componente original y no se ha
    // tocado: una tarde floja no llena el riel de tres tarjetas con huecos al lado de
    // secciones que sí tienen contenido.
    //
    // Se mira que no haya `<section>` y no que el HTML esté vacío, porque los providers
    // del layout pintan su propio `aria-live` en el contenedor: un `innerHTML === ""`
    // daría rojo por un nodo que no es del riel.
    const { vista } = montarRiel([ev({ id: "a" }), ev({ id: "b" }), ev({ id: "c" })]);

    expect(vista.consultarTodos("section")).toHaveLength(0);
    expect(vista.texto()).not.toContain("Recomendados");
    vista.desmontar();
  });
});

/**
 * Y la casa del otro lado del ranking.
 *
 * `getPopularEvents` sigue usando su criterio **sin ventana**, que es el correcto para
 * el destacado del hero: una única tarjeta protagonista quiere "lo más popular de
 * todo", no "lo más popular de hoy". Con este caso, que alguien enxerte `recomendados`
 * dentro de `getPopularEvents` —o le pase una ventana— pone el test en rojo en vez de
 * dejar dos listas con el mismo nombre y reglas distintas.
 *
 * La comparación de las dos listas sobre la agenda real **no cabe aquí**: eso necesita
 * `fetch` y el registro de los 28 scrapers, y este fichero es de jsdom — donde no hay
 * `fetch` y `cheerio` no se puede cargar. Está en `__tests__/recomendados.test.ts`, que
 * es de node.
 */
describe("las dos casas del ranking", () => {
  it("getPopularEvents no mira la fecha: el destacado del hero no la necesita", async () => {
    const { getPopularEvents } = await import("@/lib/popularity");

    // Un evento de dentro de seis meses y otro de hoy, con el mismo peso y categoría.
    // Por cercanía `scoreEvento` le daría ventaja al de hoy, pero `getPopularEvents`
    // ordena por score y los dos empatan, así que lo que se mira aquí es que el
    // lejano **entra**: un filtro de ventana los dejaría fuera.
    const lista = getPopularEvents(
      [
        ev({ id: "hoy", date: new Date().toISOString() }),
        ev({ id: "lejano", date: "2099-01-01T20:00:00.000Z" }),
      ],
      10
    );

    expect(lista.map((e) => e.id).sort()).toEqual(["hoy", "lejano"]);
  });

  });