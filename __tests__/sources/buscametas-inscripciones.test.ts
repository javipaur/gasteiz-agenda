import { loadFixture, mockFetchWith } from "../helpers";
import { scrapeBuscametasInscripciones } from "@/lib/sources/buscametas";

/**
 * Inscripciones de buscametás.
 *
 * Este test no existía, y esa es la razón de que el scraper estuviera roto en
 * producción sin que la suite se enterara: `__tests__/eventos.test.ts:79` lo
 * mockea con `mockResolvedValue([])`, así que daba igual que el selector
 * apuntara a un DOM inexistente. Un test que mockea lo que quiere probar no
 * prueba nada.
 *
 * El fixture es el HTML real de `buscametas.com/inscripciones/`. Fijar el
 * recuento de tarjetas es lo que hace que un cambio de markup se vea: los
 * selectores se apuntaron a `tr.card` cuando la pagina ya usaba `.insc-item`, el
 * `.each()` recorrio cero elementos y la ruta respondio 200 con `{"eventos":[]}`
 * durante meses.
 */
describe("scrapeBuscametasInscripciones", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  function mockPagina() {
    return mockFetchWith([
      {
        match: /buscametas\.com\/inscripciones/,
        content: loadFixture("buscametas-inscripciones.html"),
      },
    ]);
  }

  it("extrae las tarjetas de la pagina", async () => {
    mockPagina();

    const eventos = await scrapeBuscametasInscripciones();

    // El fixture tiene 21 tarjetas y se extraen las 21. El numero exacto es lo
    // que ata el scraper al markup: si el sitio cambia de clase, este numero
    // baja y se ve. No se pone ">= 1", que es lo que hacia el selector muerto
    // (`tr.card`) pasara el filtro de "devuelve algo".
    expect(eventos.length).toBe(21);
  });

  it("rellena los cinco campos que lee la app movil", async () => {
    mockPagina();

    const eventos = await scrapeBuscametasInscripciones();

    for (const e of eventos) {
      expect(e.title.length).toBeGreaterThan(0);
      expect(e.location.length).toBeGreaterThan(0);
      expect(e.date.length).toBeGreaterThan(0);
      expect(e.image).toMatch(/^https:\/\//);
    }

    // El `link` puede venir vacio, y no es un fallo del scraper: las tarjetas
    // con cinta "Proximamente" no tienen CTA porque la inscripcion aun no esta
    // abierta. Se comprueba que **las que lo tienen** salen absolutas, porque en
    // el HTML son relativas (`/modulos/ticket/evento.php?codigo=...`) y sin
    // absolutizar el movil no podria abrirlas.
    const conLink = eventos.filter((e) => e.link);
    expect(conLink.length).toBeGreaterThan(0);
    for (const e of conLink) {
      expect(e.link).toMatch(/^https:\/\//);
    }

    // Y que las imagenas salen todas: si el sitio dejara de poner `src`, aqui
    // tiene que verse.
    const conImagen = eventos.filter((e) => e.image);
    expect(conImagen.length).toBe(eventos.length);
  });

  it("deja la fecha en dd/mm/yyyy, que es lo que espera el cliente", async () => {
    // `InscribeteTabs.tsx` la parte con `split('/')` para pintar dia y mes. Si
    // esto pasara a ISO, `month` seria "2026-10-04" y `parseInt` daria NaN: la
    // pantalla saldria en blanco sin error.
    //
    // Cuando el sitio publica un rango ("31/10/2026 - 01/11/2026"), `date` queda
    // con la de inicio, que es la que ordena. El rango completo se conserva en
    // `dateRango`.
    mockPagina();

    const eventos = await scrapeBuscametasInscripciones();

    for (const e of eventos) {
      expect(e.date).toMatch(/^\d{2}\/\d{2}\/\d{4}$/);
    }

    const conRango = eventos.filter((e) => e.dateRango);
    expect(conRango.length).toBeGreaterThan(0);
    for (const e of conRango) {
      expect(e.dateRango).toMatch(
        /\d{2}\/\d{2}\/\d{4}\s*-\s*\d{2}\/\d{2}\/\d{4}/
      );
      expect(e.date).toBe(
        (e.dateRango!.match(/\d{2}\/\d{2}\/\d{4}/) as RegExpMatchArray)[0]
      );
    }
  });

  it("ordena por fecha de inicio", async () => {
    // Con el rango recortado, comparar `new Date("04/10/2026")` seria
    // ambiguo: algunos navegadores lo leen como 4 de octubre y otros como
    // 4 de abril. Se pasa a ISO antes de comparar.
    mockPagina();

    const eventos = await scrapeBuscametasInscripciones();

    const aIso = (ddmmyyyy: string) => {
      const [d, m, y] = ddmmyyyy.split("/");
      return new Date(`${y}-${m}-${d}`).getTime();
    };

    for (let i = 1; i < eventos.length; i++) {
      expect(aIso(eventos[i - 1].date)).toBeLessThanOrEqual(
        aIso(eventos[i].date)
      );
    }
  });

  it("devuelve una lista vacia si la pagina no trae tarjetas", async () => {
    mockFetchWith([
      {
        match: /buscametas\.com\/inscripciones/,
        content: "<html><body><p>No hay inscripciones abiertas</p></body></html>",
      },
    ]);

    const eventos = await scrapeBuscametasInscripciones();
    expect(eventos).toEqual([]);
  });
});