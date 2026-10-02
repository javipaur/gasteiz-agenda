import { loadFixture, mockFetchWith, EMPTY_HTML } from "../helpers";
import { scrapeArkabia } from "@/lib/sources/arkabia";

/**
 * Arkabia.
 *
 * El scraper parsea la home, no el AJAX. Antes pedia
 * admin-ajax.php?action=filtrar_eventos, que es lo que hacen los botones del
 * propio sitio, y ese endpoint responde "success: true" con un
 * div.no-results: cero tarjetas, para los tres filtros. No es un fallo nuestro,
 * porque /evento/ y /evento-cat del propio Arkabia tambien salen vacios y los
 * botones de la web vacian la lista al pulsarlos.
 *
 * Los tests de antes pasaban porque mockeaban el AJAX con un
 * arkabia-ajax.json de 20 KB que ya no reproduce lo que el sitio devuelve.
 * Un mock que no reproduce la fuente real deja pasar cualquier error.
 */
describe("scrapeArkabia", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  function mockHome(content: string) {
    return mockFetchWith([
      { match: /arkabia\.eus/, content, status: 200 },
      { match: /.*/, content: EMPTY_HTML },
    ]);
  }

it("extrae las tarjetas de la home", async () => {
    const fetchMock = mockHome(loadFixture("arkabia-home.html"));

    const events = await scrapeArkabia();

    expect(fetchMock).toHaveBeenCalled();
    expect(Array.isArray(events)).toBe(true);
    // El fixture tiene 17 tarjetas. El numero exacto ata el scraper al markup:
    // si el sitio cambia de clase, baja y se ve aqui.
    expect(events.length).toBeGreaterThan(0);
    expect(events.length).toBe(17);
  });

  it("rellena los campos que consume la agenda", async () => {
    mockHome(loadFixture("arkabia-home.html"));

    const events = await scrapeArkabia();

    for (const e of events) {
      expect(e.title.length).toBeGreaterThan(0);
      expect(typeof e.link).toBe("string");
      expect(typeof e.image).toBe("string");
      expect(Array.isArray(e.categoria)).toBe(true);
      expect(e.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });

  it("lee categoria, fecha y precio de la tarjeta", async () => {
    mockHome(loadFixture("arkabia-home.html"));

    const first = (await scrapeArkabia())[0];

    expect(first.categoria.length).toBeGreaterThan(0);
    expect(first.fecha).toBeTruthy();
    expect(first.precio).toBeTruthy();
  });

  it("toma la fecha de inicio cuando el rango va pegado al dia", async () => {
    // El bug que se quedo: el regex enganchaba en el segundo grupo de
    // "03-04/10/2026" y devolvia el 4 de octubre, la fecha **de fin**, como si
    // fuera la de inicio. Ese formato salia en la home en vivo.
    mockHome(plantilla("03-04/10/2026"));

    const [evento] = await scrapeArkabia();

    expect(evento.date).toBe("2026-10-03");
  });

  it("acepta los dos formatos de rango con guion suelto", async () => {
    mockHome(plantilla("04/06 - 12/10/2026"));
    expect((await scrapeArkabia())[0].date).toBe("2026-06-04");

    mockHome(plantilla("26/09/2026 - 21/01/2027"));
    expect((await scrapeArkabia())[0].date).toBe("2026-09-26");

    mockHome(plantilla("07/10/2026"));
    expect((await scrapeArkabia())[0].date).toBe("2026-10-07");
  });

  it("devuelve una lista vacia si la home no trae tarjetas", async () => {
    // Es lo que devuelve hoy el sitio: el modulo vacio. Se distingue del fallo
    // de red, que lanza en vez de devolver lista.
    mockHome("<html><body><div class='no-results'></div></body></html>");

    const events = await scrapeArkabia();
    expect(events).toEqual([]);
  });

  it("devuelve una lista vacia si la home falla", async () => {
    mockFetchWith([{ match: /arkabia\.eus/, content: "", status: 500 }]);

    const events = await scrapeArkabia();
    expect(events).toEqual([]);
  });
});

/** Una tarjeta minima con la fecha que se le pase. */
function plantilla(fecha: string): string {
  // Sin template literal: el fichero es `.ts` sin JSX y los tags de la tarjeta
  // searian sintaxis JSX. Se concatenan con `+` a proposito.
  return [
    '<div class="modulo-programacion__item">',
    '<a class="modulo-programacion__imagen" href="https://arkabia.eus/evento/x/">',
    '<img src="https://arkabia.eus/a.jpg">',
    "</a>",
    '<div class="modulo-programacion__info">',
    '<div class="etiquetas"><a class="etiqueta">EXPOSICION</a></div>',
    '<span class="fecha">' + fecha + "</span>",
    '<span class="precio">GRATIS</span>',
    '<a href="https://arkabia.eus/evento/x/">',
    '<h3 class="modulo-programacion__titular">Digital Floralia</h3>',
    '<h4 class="modulo-programacion__titular"></h4>',
    "</a>",
    "</div>",
    "</div>",
  ].join("");
}