import { EMPTY_HTML, loadFixture, mockFetchWith } from "../helpers";
import { scrapeEntradium } from "@/lib/sources/entradium";
import { localDateKey } from "@/lib/slug";

/**
 * La fecha de Entradium salía **un día antes** en todos sus eventos.
 *
 * `parseDate` construía la fecha a medianoche **local** (`new Date(year, month-1,
 * day)`) y la devolvía con `date.toISOString().slice(0,10)`, que es el día **UTC**.
 * En Europe/Madrid la medianoche local son las 22:00 o las 23:00 del día
 * anterior, así que el cambio de día pasaba primero y el día se iba. Medido con
 * la función copiada del repo, en `TZ=Europe/Madrid`:
 *
 *     "26 sep" -> 2027-09-25      "15 oct" -> 2026-10-14
 *     "1 nov"  -> 2026-10-31      "3 ene"  -> 2026-01-02
 *
 * No era cosmético, porque `lib/agenda.ts:164` filtra con
 * `new Date(ev.date) >= hoy`:
 *
 * - un concierto del sábado salía el viernes y desaparecía de la agenda, de la
 *   home y del digest durante el día real;
 * - el slug lleva la fecha dentro (`-2026-10-31-`), así que tampoco casaba con la
 *   ficha de la misma fuente.
 *
 * El arreglo es el patrón de `lib/sources/miniature.ts:137`: **mediodía UTC** para
 * construir la fecha. A las 12:00 UTC el día local y el UTC son el mismo, y el
 * margen hasta medianoche es de doce horas en las dos direcciones.
 *
 * Y el motivo por el que el bug sobrevive tanto tiempo está en la última nota de
 * `AGENTS.md`: Entradium es una de las seis fuentes sin test. Por eso el primero
 * de estos casos falla con el código viejo.
 */

const MESES = [
  "ene", "feb", "mar", "abr", "may", "jun",
  "jul", "ago", "sep", "oct", "nov", "dic",
];

/**
 * El día que se espera de una etiqueta sin año, según la regla del scraper:
 * año actual, y si la fecha ya pasó y el mes es de junio en adelante, año
 * siguiente.
 *
 * Se recalcula en cada ejecución a propósito: una etiqueta como "26 sep" vale
 * para 2027 hoy y para 2028 dentro de nueve meses, y un test con el año escrito
 * se pudre solo. Lo que no depende del año es el **día**, y es lo que estos
 * casos comprueban.
 */
function esperado(etiqueta: string): string {
  const m = etiqueta.toLowerCase().match(/(\d{1,2})\s*(?:de\s*)?([a-z]{2,})/i);
  if (!m) throw new Error(`etiqueta de test no parseable: ${etiqueta}`);

  const dia = Number(m[1]);
  const mes = MESES.indexOf(m[2].slice(0, 3)) + 1;
  const iso = (anio: number) =>
    `${anio}-${String(mes).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;

  let anio = new Date().getFullYear();
  const fecha = new Date(`${iso(anio)}T12:00:00Z`);
  if (fecha.getTime() < Date.now() && mes >= 6) anio += 1;
  return iso(anio);
}

/** Una tarjeta con la forma que lee el scraper, con la fecha que se le pase. */
function tarjeta(etiquetaFecha: string, recinto = "Vitoria-Gasteiz"): string {
  return (
    `<a class="event-card" href="/es/events/x/1">` +
    `<div class="date"><span>${etiquetaFecha}</span></div>` +
    `<h3 class="event-title">Concierto de prueba</h3>` +
    `<div class="event-venue">${recinto}</div>` +
    `</a>`
  );
}

describe("scrapeEntradium", () => {
  it("conserva el día que publica la etiqueta", async () => {
    // El fallo en una línea: la etiqueta dice 26 y la fecha salía 25.
    mockFetchWith([{ match: /entradium\.com/, content: loadFixture("entradium-listing.html") }]);

    const events = await scrapeEntradium();

    expect(events).toHaveLength(1);
    expect(events[0].title).toBe("Concierto de prueba");
    // El día, aislado del año: es lo único que no depende de cuándo se corra.
    expect(events[0].date.slice(-2)).toBe("26");
    expect(events[0].date).toBe(esperado("26 sep"));
  });

  it("una cita de dentro de dos semanas sale en su día, no en el anterior", async () => {
    // El caso general con la etiqueta calculada. Con el código viejo esta fecha
    // salía un día antes, que es exactamente lo que hace que un evento de hoy
    // desaparezca entero: `parseDate` lo fechaba en ayer, y `agenda.ts` descarta
    // todo lo anterior a hoy.
    const dentro = new Date();
    dentro.setDate(dentro.getDate() + 14);
    const etiqueta = `${dentro.getDate()} ${MESES[dentro.getMonth()]}`;

    mockFetchWith([{ match: /entradium\.com/, content: tarjeta(etiqueta) }]);

    const events = await scrapeEntradium();

    expect(events).toHaveLength(1);
    expect(events[0].date).toBe(esperado(etiqueta));
    expect(new Date(`${events[0].date}T12:00:00Z`).getUTCDate()).toBe(dentro.getDate());
  });

  it("descarta lo que no es de Vitoria-Gasteiz", async () => {
    // De regresión: el filtro por recinto no se toca, pero comparte el recorrido
    // de tarjetas con la fecha y por eso conviene que siga en negro.
    mockFetchWith([{ match: /entradium\.com/, content: loadFixture("entradium-listing.html") }]);

    const events = await scrapeEntradium();

    expect(events.map((e) => e.title)).not.toContain("Concierto en Bilbao");
  });

  it("devuelve vacío si la home no responde", async () => {
    const errorSpy = jest.spyOn(console, "error").mockImplementation(() => undefined);
    mockFetchWith([{ match: /entradium\.com/, content: "", status: 500 }]);

    const events = await scrapeEntradium();

    expect(events).toEqual([]);
    expect(errorSpy).toHaveBeenCalled();
  });

  it("cae a la home de escritorio cuando la móvil no trae eventos", async () => {
    // El fallback es la mitad de la función y duplica el `parseDate`: si el arreglo
    // se hiciera solo en el camino móvil, este seguiría desplazado.
    const dentro = new Date();
    dentro.setDate(dentro.getDate() + 14);
    const etiqueta = `${dentro.getDate()} ${MESES[dentro.getMonth()]}`;

    const fetchMock = jest.spyOn(global, "fetch").mockImplementation(async (input) => {
      const url = String(input);
      if (url.startsWith("https://m.entradium.com")) return new Response(EMPTY_HTML);
      return new Response(tarjeta(etiqueta));
    });

    const events = await scrapeEntradium();

    expect(fetchMock).toHaveBeenCalled();
    expect(events).toHaveLength(1);
    expect(events[0].date).toBe(esperado(etiqueta));
  });
});

/**
 * Las dos ventanas de UTC que quedaban dentro del fichero, y que son un bug
 * distinto del que arregla el caso de arriba.
 *
 * El bug grande —la fecha de cada etiqueta salía un día antes— estaba en
 * `parseDate`, y su arreglo fue construir a mediodía UTC y formatear con las partes
 * en UTC. Los dos sitios que quedan no pasan por `parseDate` y por eso no se
 * arreglaron con él: son el `date` de un evento recurrente y el `today` del filtro,
 * y los dos salían de `new Date().toISOString().slice(0, 10)`.
 *
 * **Medido en `TZ=Europe/Madrid`**, no supuesto. El prefijo ISO y el día local se
 * diferencian en una ventana de **dos horas**, de 00:00 a 01:59 locales, en invierno
 * y en verano: son las dos horas en las que el día local ya ha cambiado y el del
 * prefijo ISO todavía no, porque el primero en cruzar la medianoche es el UTC —a las
 * 23:00Z en invierno y a las 22:00Z en verano—.
 *
 *     instante (Z)          toISOString()   día local Madrid
 *     2027-03-15T22:30Z     2027-03-15     2027-03-15
 *     2027-03-15T23:30Z     2027-03-15     2027-03-16   <-- ventana
 *     2027-07-15T22:30Z     2027-07-15     2027-07-16   <-- ventana
 *
 * Los instantes que usan estos casos están en la ventana **por construcción**, no
 * por suerte: 23:30Z del día 15 son las 00:30 del día 16 en Madrid, y marzo es
 * todavía CET (+01:00) porque el cambio a horario de verano es el último domingo de
 * marzo.
 *
 * `jest.setSystemTime` es lo que hace falta y no un esperar: la zona horaria la fija
 * el proceso al arrancar el worker —ver `jest.config.ts` y `__tests__/huso.test.ts`—,
 * pero la **hora del día** sí la manda el reloj, y es la hora del día la que decide
 * en cuál de las dos zonas estamos. Además los números salen escritos en el test: si
 * el reloj real coincidiera con la ventana, la mitad de estos casos pasarían sin
 * probar nada, y esa es exactamente la clase de test que `huso.test.ts` existe para
 * quitar de en medio.
 */
describe("las dos horas en las que el día local y el prefijo ISO no coinciden", () => {
  /** Las 00:30 del 16 de marzo de 2027 en Madrid: 23:30Z del 15. */
  const MEDIANOCHE_MADRID = new Date("2027-03-15T23:30:00Z");

  beforeEach(() => {
    jest.useFakeTimers({ doNotFake: ["setTimeout", "setInterval", "setImmediate"] });
    jest.setSystemTime(MEDIANOCHE_MADRID);
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it("el instante elegido está de verdad en la ventana", () => {
    // El reloj del runner decide la zona horaria, pero no tiene por qué estar en la
    // ventana. Si no lo estuviera, los casos de abajo pasarían sin probar el fallo
    // que dicen medir, así que se afirma antes y por separado.
    const prefijoIso = MEDIANOCHE_MADRID.toISOString().slice(0, 10);
    const diaLocal = localDateKey(MEDIANOCHE_MADRID.toISOString());

    expect(prefijoIso).toBe("2027-03-15");
    expect(diaLocal).toBe("2027-03-16");
    // La hora local es la que hace la gracia, y a las 00:30 se ve en el reloj.
    expect(MEDIANOCHE_MADRID.getHours()).toBe(0);
    expect(MEDIANOCHE_MADRID.getMinutes()).toBe(30);
  });

  it('un "Varias fechas" se fecha hoy local, no ayer', async () => {
    // Falla con el código viejo: el `date` era `2027-03-15` —ayer— porque venía de
    // `toISOString().slice(0, 10)`. Y no era un detalle de la etiqueta: ese `date` es
    // el que `lib/agenda.ts` filtra con `new Date(ev.date) >= hoy`, así que un
    // recurrente que empezaba esa madrugada se quedaba fuera de la agenda, de la home
    // y del digest hasta que pasaban las dos.
    mockFetchWith([{ match: /entradium\.com/, content: tarjeta("Varias fechas") }]);

    const events = await scrapeEntradium();

    expect(events).toHaveLength(1);
    expect(events[0].date).toBe("2027-03-16");
  });

  it("descarta el evento de ayer local, que el filtro con día UTC dejaba pasar", async () => {
    // Falla con el código viejo, y **no** por la ventana de UTC sino al revés de lo
    // que se espera, que es por eso que llevaba meses sin verse: entre las 00:00 y
    // las 01:59 el prefijo ISO está un día por detrás, así que `date < today` se
    // quedaba corto y `2027-03-15 < 2027-03-15` era falso. El evento de ayer se
    // colaba y el de hoy se quedaba, que es el reparto justo del revés del que
    // quiere el filtro.
    //
    // "15 mar" es la etiqueta que hace falta: con marzo no hay salto de año —el
    // scraper solo lo hace de junio en adelante—, así que el 15 sale como el 15 y no
    // como el año siguiente.
    mockFetchWith([{ match: /entradium\.com/, content: tarjeta("15 mar") }]);

    expect(await scrapeEntradium()).toEqual([]);
  });

  it("un evento de hoy local sigue entrando", async () => {
    // El otro lado, y es el que hace que los dos anteriores no se puedan arreglar
    // borrando el filtro: con el día local, lo que es de hoy tiene que seguir
    // apareciendo a las 00:30. Con el código viejo esto también pasaba —el filtro
    // viejo era demasiado permisivo—, así que es un guard.
    mockFetchWith([{ match: /entradium\.com/, content: tarjeta("16 mar") }]);

    const events = await scrapeEntradium();

    expect(events).toHaveLength(1);
    expect(events[0].date).toBe("2027-03-16");
  });
});