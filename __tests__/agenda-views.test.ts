/**
 * Las vistas sobre el agregado, con el agregado mockeado.
 *
 * Van en un fichero aparte de `agenda.test.ts` y no dentro, y el motivo es
 * `jest.mock`: ese fichero importa `aggregate` y `findBySlug` de `@/lib/agenda`
 * para probar el agregador, así que sustituir el módulo ahí apagaría veinte tests
 * para poder encender cuatro. Aquí el módulo se sustituye entero y solo se prueba
 * lo que las vistas le hacen encima.
 *
 * Y no se llama a `getAgendaEventos()` de verdad: eso corre los 27 scrapers del
 * registro —uno se baja 8,7 MB— y el resultado dependería de lo que publicaran
 * las salas. La regla de cada vista es una función pura sobre la lista que recibe.
 *
 * `id` y `slug` son **siempre distintos** en los fixtures, también en `BASE`. Con
 * los dos iguales, una vista que los intercambiara —o que inventara un id nuevo—
 * pasaría el test sin que se notara, que es justo el bug que estos tests existen
 * para cazar: el 404 de `/evento/[slug]` cuando la tarjeta y el detalle
 * calculaban el slug por su cuenta.
 */

jest.mock("@/lib/agenda", () => ({
  getAgendaEventos: jest.fn(),
}));

import { getAgendaEventos, type AgendaEvento } from "@/lib/agenda";

const mockAgenda = getAgendaEventos as jest.MockedFunction<typeof getAgendaEventos>;

const BASE = {
  id: "codigo-municipal-4471",
  slug: "carrera-2027-03-15-abc123",
  title: "Evento de prueba",
  date: "2027-03-15T20:00:00.000Z",
  location: "Vitoria-Gasteiz",
  link: "https://example.com/a",
};

function evento(over: Partial<AgendaEvento>): AgendaEvento {
  return { ...BASE, source: "municipal-deporte", category: "Deporte", ...over };
}

describe("vista de deporte", () => {
  beforeEach(() => {
    mockAgenda.mockResolvedValue([]);
  });

  it("expone los cuatro tramos que consume SportPageClient", async () => {
    const { getDeporteEventos } = await import("@/lib/deporte");

    mockAgenda.mockResolvedValue([
      evento({ id: "id-a", slug: "tramo-agenda-2027-03-15-a1", kind: "agenda" }),
      evento({ id: "id-b", slug: "tramo-calendario-2027-03-15-b2", kind: "calendario" }),
      evento({ id: "id-c", slug: "tramo-inscripciones-2027-03-15-c3", kind: "inscripciones" }),
      evento({ id: "id-d", slug: "tramo-excursiones-2027-03-15-d4", kind: "excursiones" }),
    ]);

    const evs = await getDeporteEventos();
    expect(evs.map((e) => e.category).sort()).toEqual([
      "agenda",
      "calendario",
      "excursiones",
      "inscripciones",
    ]);
  });

  it("solo incluye eventos con kind, y category es el kind", async () => {
    const { getDeporteEventos } = await import("@/lib/deporte");

    mockAgenda.mockResolvedValue([
      evento({ id: "id-a", slug: "tramo-agenda-2027-03-15-a1", kind: "agenda" }),
      // Esto no es deporte aunque su categoría lo parezca: `kind` es el tramo del
      // calendario y es lo que decide que un evento entre en esta vista.
      evento({ id: "id-b", slug: "sin-kind-2027-03-15-b2", category: "Deporte" }),
      evento({ id: "id-c", slug: "teatro-2027-03-15-c3", source: "municipal-agenda", category: "Teatro" }),
    ]);

    const evs = await getDeporteEventos();
    expect(evs.map((e) => e.id)).toEqual(["id-a"]);
    expect(evs[0].category).toBe(evs[0].kind);
  });

  it("descarta un kind que no sea uno de los cuatro tramos", async () => {
    // `TRAMOS` es una lista blanca y el coste de ampliarla es doble: si mañana una
    // entrada declara un tramo nuevo, `/deporte` lo mostraría con una etiqueta que
    // ninguna de las cuatro pills de `SportPageClient` sabe filtrar, y el usuario
    // solo podría verlo con "Todos". Se descarta aquí, y el olvido de verlo se
    // evita añadiendo la pill en el mismo commit.
    const { getDeporteEventos } = await import("@/lib/deporte");

    mockAgenda.mockResolvedValue([
      evento({ id: "id-a", slug: "competicion-2027-03-15-a1", kind: "competicion" }),
    ]);

    expect(await getDeporteEventos()).toEqual([]);
  });

  it("reproduce id y slug del agregado, en el mismo orden y sin cambiar nada", async () => {
    // El invariante que cerró el 404 de `/evento/[slug]`: la tarjeta y el detalle
    // tienen que leer el mismo slug, y este lo resuelve una sola vez.
    //
    // Una sola aserción sobre la matriz `[id, slug]` de los dos eventos, y
    // comprueba las tres cosas a la vez: que cada campo conserva su valor (si
    //alguna vista los intercambiara, saldrían cruzados), que no se cuela ningún
    // evento (sobran filas) y que no se cae ninguno (faltan filas).
    const { getDeporteEventos } = await import("@/lib/deporte");

    mockAgenda.mockResolvedValue([
      evento({ id: "id-agenda", slug: "carrera-de-montana-2027-03-15-aa11", kind: "agenda" }),
      evento({ id: "id-inscripciones", slug: "maraton-vitoria-2027-04-02-bb22", kind: "inscripciones" }),
      // Este no es de la vista: si apareciera, la matriz no cuadraría.
      evento({ id: "id-fuera", slug: "teatro-2027-03-15-cc33", kind: undefined }),
    ]);

    const evs = await getDeporteEventos();
    expect(evs.map((e) => [e.id, e.slug])).toEqual([
      ["id-agenda", "carrera-de-montana-2027-03-15-aa11"],
      ["id-inscripciones", "maraton-vitoria-2027-04-02-bb22"],
    ]);
  });
});

describe("vista infantil", () => {
  beforeEach(() => {
    mockAgenda.mockResolvedValue([]);
  });

  it("filtra por el tag infantil y marca la categoría", async () => {
    const { getKidsEventos } = await import("@/lib/kids");

    mockAgenda.mockResolvedValue([
      evento({
        id: "id-a",
        slug: "taller-decarton-2027-03-15-a1",
        source: "municipal-infantil",
        category: "Otros",
        tags: ["infantil"],
      }),
    ]);

    const evs = await getKidsEventos();
    expect(evs).toHaveLength(1);
    expect(evs[0].tags).toContain("infantil");
    expect(evs[0].category).toBe("Infantil");
  });

  it("deja fuera lo que no lleva el tag, aunque su categoría sea Infantil", async () => {
    // `kind` y `tags` son ejes distintos de `category`: `municipal-infantil` no
    // declara categoría, es el tag el que mete el evento en esta vista, y
    // `municipal-deporte` no la trae aunque el scraping diga "infantil" en el texto.
    const { getKidsEventos } = await import("@/lib/kids");

    mockAgenda.mockResolvedValue([
      evento({ id: "id-a", slug: "taller-decarton-2027-03-15-a1", source: "municipal-infantil", tags: ["infantil"] }),
      evento({ id: "id-b", slug: "sin-tag-2027-03-15-b2", source: "municipal-infantil", category: "Infantil" }),
      evento({ id: "id-c", slug: "carrera-2027-03-15-c3", source: "municipal-deporte", category: "Deporte" }),
      evento({ id: "id-d", slug: "blanca-2027-08-26-d4", source: "fiestas-blanca", tags: ["la-blanca"] }),
    ]);

    const evs = await getKidsEventos();
    expect(evs.map((e) => e.id)).toEqual(["id-a"]);
  });

  it("reproduce id y slug del agregado, en el mismo orden y sin cambiar nada", async () => {
    const { getKidsEventos } = await import("@/lib/kids");

    mockAgenda.mockResolvedValue([
      evento({ id: "id-a", slug: "taller-decarton-2027-03-15-a1", source: "municipal-infantil", tags: ["infantil"] }),
      evento({ id: "id-b", slug: "cuentacuentos-2027-03-20-b2", source: "municipal-infantil", tags: ["infantil"] }),
      evento({ id: "id-fuera", slug: "teatro-2027-03-15-cc3", source: "municipal-teatro" }),
    ]);

    const evs = await getKidsEventos();
    expect(evs.map((e) => [e.id, e.slug])).toEqual([
      ["id-a", "taller-decarton-2027-03-15-a1"],
      ["id-b", "cuentacuentos-2027-03-20-b2"],
    ]);
  });
});
