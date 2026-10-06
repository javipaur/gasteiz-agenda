/**
 * Las fechas de este fichero se construyen a partir del reloj en vez de escribirse.
 *
 * Los eventos llegan a estas aserciones después de pasar por `lib/agenda.ts:249`,
 * que descarta el pasado contra la **medianoche local de hoy** —`hoy.setHours(0, 0,
 * 0, 0)`—. Es decir: la mitad de lo que este fichero comprueba lo decide la hora que
 * es, y una fecha escrita a mano es una fecha que caduca. Se caducó el 6 de octubre
 * de 2026: los datos decían `"2026-10-05T20:00:00.000Z"`, el test pedía dos eventos y
 * recibía uno, porque "Evento Duplicado" ya era ayer. El rojo señalaba la aserción de
 * longitud, no la fecha, que es la forma más ilegible de Pudrir un fixture.
 *
 * Es la misma respuesta que `loadFixtureWithFutureDates` da a los fixtures HTML
 * —reescribir a futuro en vez de congelar—, con una diferencia: aquí no hay texto que
 * reescribir, las fechas **son** el dato. La otra respuesta posible, clavar el reloj
 * con `jest.setSystemTime`, es la que usa `gasteizhoy.test.ts` y es la correcta **allí**
 * porque su fixture es una rejilla de mes que no se puede mover sin entender su
 * parser. Aquí no hay nada que entender y nada que clavar: con reloj real el test
 * comprueba contra la misma medianoche que el código, y no tiene fecha de caducidad.
 */
function relativo(dias: number, hora = 20): Date {
  // Local y no UTC a propósito: se construye la misma magnitud que construye el
  // código bajo prueba. Con UTC la diferencia de día en las horas del borde haría que
  // este test se pusiera rojo una vez al año, y un test que solo falla por el huso es
  // un test roto.
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + dias);
  d.setHours(hora, 0, 0, 0);
  return d;
}

/** `YYYY-MM-DD` **local** de un instante, para los `startDate`/`endDate`. */
function claveLocal(d: Date): string {
  return `${d.getFullYear()}-${`${d.getMonth() + 1}`.padStart(2, "0")}-${`${d.getDate()}`.padStart(2, "0")}`;
}

// Dos días de margen entre los tres, para que ningún caso de borde de zona horaria
// pueda empujarlos dentro o fuera del rango del test de `startDate`/`endDate`.
const futureDate = relativo(1).toISOString();
const futureDate2 = relativo(3).toISOString();
const pastDate = relativo(-30).toISOString();

jest.mock("@/lib/sources/fever", () => ({
  scrapeFever: jest.fn().mockResolvedValue([
    { id: "f1", title: "Evento Duplicado", date: futureDate, location: "Sala 1", link: "/f1", image: "https://example.com/f1.jpg" },
  ]),
}));

jest.mock("@/lib/sources/rula", () => ({
  scrapeRula: jest.fn().mockResolvedValue([
    { title: "Evento Duplicado", date: futureDate, location: "Sala 2", link: "/f2", image: "https://example.com/f2.jpg" },
    { title: "Evento Unico", date: futureDate2, location: "Sala 3", link: "/f3", image: "https://example.com/f3.jpg" },
  ]),
}));

jest.mock("@/lib/sources/gasteizhoy", () => ({
  scrapeGasteizHoy: jest.fn().mockResolvedValue([
    { title: "Evento Pasado", date: pastDate, location: "Sala 4", link: "/p", image: "https://example.com/p.jpg" },
  ]),
}));

jest.mock("@/lib/sources/vam", () => ({
  scrapeVamEvents: jest.fn().mockResolvedValue([]),
  scrapeVamConciertos: jest.fn().mockResolvedValue([]),
}));

jest.mock("@/lib/sources/municipal", () => ({
  scrapeMunicipalCalendar: jest.fn().mockResolvedValue([]),
}));

jest.mock("@/lib/sources/euskadi", () => ({
  scrapeEuskadi: jest.fn().mockResolvedValue([]),
}));

jest.mock("@/lib/sources/municipal-rss", () => ({
  scrapeMunicipalRss: jest.fn().mockResolvedValue([]),
}));

jest.mock("@/lib/sources/eventbrite", () => ({
  scrapeEventbrite: jest.fn().mockResolvedValue([]),
}));

jest.mock("@/lib/sources/entradium", () => ({
  scrapeEntradium: jest.fn().mockResolvedValue([]),
}));

jest.mock("@/lib/sources/vital", () => ({
  scrapeVital: jest.fn().mockResolvedValue([]),
}));

jest.mock("@/lib/sources/arkabia", () => ({
  scrapeArkabia: jest.fn().mockResolvedValue([]),
}));

jest.mock("@/lib/sources/miniature", () => ({
  scrapeMiniature: jest.fn().mockResolvedValue([]),
}));

// `getProximosEventos` ya no scrapea: delega en `getAgendaEventos`, que corre las
// 27 entradas del registro. Las seis de aquí no estaban porque el módulo viejo no
// las usaba; sin estos mocks el test se iría a la red de verdad —y `rula` se baja
// 8,7 MB— y el recuento dependería de lo que publicaran las salas.
jest.mock("@/lib/sources/jimmyjazz", () => ({
  scrapeJimmyJazz: jest.fn().mockResolvedValue([]),
}));

jest.mock("@/lib/sources/helldorado", () => ({
  scrapeHelldorado: jest.fn().mockResolvedValue([]),
}));

jest.mock("@/lib/sources/musikaze", () => ({
  scrapeMusikaze: jest.fn().mockResolvedValue([]),
}));

// `scrapeBuscametasInscripciones` pasa a devolver `dateRango` ademas de `date`
// (el sitio publica algunos como "31/10/2026 - 01/11/2026"). El mock lo refleja
// para que un test de este fichero no falle por la forma.
jest.mock("@/lib/sources/buscametas", () => ({
  scrapeBuscametasCalendario: jest.fn().mockResolvedValue([]),
  scrapeBuscametasInscripciones: jest.fn().mockResolvedValue([]),
}));

jest.mock("@/lib/sources/senderismo", () => ({
  scrapeSenderismo: jest.fn().mockResolvedValue([]),
}));

jest.mock("@/lib/sources/fiestas-blanca", () => ({
  scrapeFiestasBlanca: jest.fn().mockResolvedValue([]),
}));

jest.mock("@/lib/cache", () => ({
  getCachedOrFetch: jest.fn(
    async (_key: string, _ttlMs: number, fetcher: () => Promise<unknown>) =>
      fetcher()
  ),
}));

import { SOURCE_DATA } from "@/lib/source-data";
import { getProximosEventos } from "@/lib/eventos";

describe("getProximosEventos", () => {
  it("deduplicates by title|date and excludes past events", async () => {
    const eventos = await getProximosEventos();

    expect(Array.isArray(eventos)).toBe(true);
    expect(eventos.length).toBe(2);

    const titles = eventos.map((e) => e.title);
    expect(titles).toContain("Evento Duplicado");
    expect(titles).toContain("Evento Unico");
    expect(titles).not.toContain("Evento Pasado");

    const dupCount = eventos.filter((e) => e.title === "Evento Duplicado").length;
    expect(dupCount).toBe(1);
  });

  it("normalizes events to the canonical Evento shape", async () => {
    const eventos = await getProximosEventos();

    for (const e of eventos) {
      expect(typeof e.id).toBe("string");
      expect(e.id.length).toBeGreaterThan(0);
      expect(typeof e.title).toBe("string");
      expect(typeof e.date).toBe("string");
      expect(typeof e.link).toBe("string");
      expect(typeof e.source).toBe("string");
    }
  });

  it("filters by startDate range", async () => {
    // La ventana se construye con el mismo reloj que las fechas de los mocks, y
    // no en las últimas: cae entre los dos futuros, así que el caso de abajo sigue
    // distinguiendo "filtra por rango" de "devuelve los dos".
    const eventos = await getProximosEventos({
      startDate: claveLocal(relativo(2)),
      endDate: claveLocal(relativo(4)),
    });

    expect(Array.isArray(eventos)).toBe(true);
    expect(eventos.length).toBe(1);
    expect(eventos[0].title).toBe("Evento Unico");
  });

  it("sorts events chronologically", async () => {
    const eventos = await getProximosEventos();
    const dates = eventos.map((e) => new Date(e.date).getTime());
    for (let i = 1; i < dates.length; i++) {
      expect(dates[i - 1]).toBeLessThanOrEqual(dates[i]);
    }
  });

  it("devuelve el agregado sin retocar: id === slug y la fuente es un id del registro", async () => {
    // Lo que hacía especial al módulo viejo era justo esto: `id` era un
    // `crypto.randomUUID()` que cambiaba en cada re-scraping, y `source` era una
    // etiqueta inventada ("vitoria-gasteiz", "vitoria-gasteiz-rss"). Si el
    // wrapper volviera a renombrar algo, sería para volver a romper los
    // favoritos guardados, así que se ata aquí.
    const ids = new Set(SOURCE_DATA.map((e) => e.id));
    const eventos = await getProximosEventos();

    expect(eventos.length).toBeGreaterThan(0);
    for (const e of eventos) {
      expect(e.id).toBe(e.slug);
      expect(ids.has(e.source)).toBe(true);
    }
  });
});
