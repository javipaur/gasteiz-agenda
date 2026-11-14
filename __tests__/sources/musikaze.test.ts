import { loadFixture, mockFetchWith, EMPTY_HTML } from "../helpers";
import { scrapeMusikaze } from "@/lib/sources/musikaze";

const MESES = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

/**
 * El fixture con la fecha de cada ficha puesta a `dias[i]` días de hoy.
 *
 * **Por qué se reescribe aquí y no con `loadFixtureWithFutureDates`.** El fixture se
 * capturó en septiembre de 2026 y `scrapeMusikaze` descarta lo que ya pasó, así que
 * tal cual no devuelve nada y el test se pudre solo: deja de comprobar y falla.
 * `loadFixtureWithFutureDates` solo entiende el texto `"Fecha: …"`, y aquí la fecha va
 * partida en tres `<span>` (`monthday`, `month`, `year`) que además pueden traer un
 * rango ("14 Oct -", "2 Sep", "2022 - 2029"). Se resuelve en el test por el mismo
 * motivo que en `helldorado.test.ts`.
 */
function htmlConFechas(dias: readonly number[]): string {
  let i = 0;
  return loadFixture("musikaze-listing.html").replace(
    /<span class="mkp-ticket-date-monthday">[^<]*<\/span>\s*<span class="mkp-ticket-date-month">[^<]*<\/span>\s*<span class="mkp-ticket-date-year">[^<]*<\/span>/g,
    () => {
      const fecha = new Date();
      fecha.setDate(fecha.getDate() + (dias[i] ?? 30));
      i += 1;
      return (
        `<span class="mkp-ticket-date-monthday">${fecha.getDate()}</span>` +
        `<span class="mkp-ticket-date-month">${MESES[fecha.getMonth()]}</span>` +
        `<span class="mkp-ticket-date-year">${fecha.getFullYear()}</span>`
      );
    }
  );
}

describe("scrapeMusikaze", () => {
  it("parses ticket items and filters future events", async () => {
    // 51 fichas dentro de un mes y una de hace diez días. El `length > 0` de antes no
    // distinguía "el filtro funciona" de "el filtro no filtra": con todo en el futuro
    // pasa igual, y con todo en el pasado lo único que falla es que no hay eventos.
    const dias = Array.from({ length: 52 }, (_, i) => (i === 0 ? -10 : 30));
    const html = htmlConFechas(dias);

    // El fixture es **una** página. Servirlo también para `pag=2` no es un detalle:
    // `scrapeMusikaze` pide la segunda en cuanto la primera trae 50 o más, así que
    // devolvía la misma lista otra vez y el total salía al doble sin que nada fallara.
    const fetchMock = mockFetchWith([
      {
        match: /musikaze\.com/,
        content: (url) => (url.includes("pag=1") ? html : EMPTY_HTML),
      },
      { match: /.*/, content: EMPTY_HTML },
    ]);

    const events = await scrapeMusikaze();

    expect(fetchMock).toHaveBeenCalled();
    expect(Array.isArray(events)).toBe(true);
    expect(events.length).toBe(51);

    const today = new Date().toISOString().slice(0, 10);
    for (const e of events) {
      expect(typeof e.title).toBe("string");
      expect(e.title.length).toBeGreaterThan(0);
      expect(e.date >= today).toBe(true);
      expect(typeof e.link).toBe("string");
    }
  });

  it("propaga el fallo cuando la petición falla", async () => {
    mockFetchWith([{ match: /musikaze\.com/, content: "", status: 500 }]);
    await expect(scrapeMusikaze()).rejects.toThrow(/Musikaze/i);
  });

  it("lanza si no hay tarjetas del formato esperado (posible cambio de estructura)", async () => {
    mockFetchWith([
      { match: /.*/, content: "<html><body><p>sin eventos</p></body></html>" },
    ]);

    await expect(scrapeMusikaze()).rejects.toThrow(/no se encontraron tarjetas/i);
  });
});