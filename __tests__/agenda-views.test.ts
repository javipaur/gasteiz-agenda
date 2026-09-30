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
 */

jest.mock("@/lib/agenda", () => ({
  getAgendaEventos: jest.fn(),
}));

import { getAgendaEventos, type AgendaEvento } from "@/lib/agenda";

const mockAgenda = getAgendaEventos as jest.MockedFunction<typeof getAgendaEventos>;

const BASE = {
  id: "e1",
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
      evento({ id: "a", slug: "a", kind: "agenda" }),
      evento({ id: "b", slug: "b", kind: "calendario" }),
      evento({ id: "c", slug: "c", kind: "inscripciones" }),
      evento({ id: "d", slug: "d", kind: "excursiones" }),
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
      evento({ id: "a", slug: "a", kind: "agenda" }),
      // Esto no es deporte aunque su categoría lo parezca: `kind` es el tramo del
      // calendario y es lo que decide que un evento entre en esta vista.
      evento({ id: "b", slug: "b", category: "Deporte" }),
      evento({ id: "c", slug: "c", source: "municipal-agenda", category: "Teatro" }),
    ]);

    const evs = await getDeporteEventos();
    expect(evs.map((e) => e.id)).toEqual(["a"]);
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
      evento({ id: "a", slug: "a", kind: "competicion" }),
    ]);

    expect(await getDeporteEventos()).toEqual([]);
  });

  it("no toca el id ni el slug del agregado", async () => {
    // Es el invariante que cerró el 404 de `/evento/[slug]`: la tarjeta y el
    // detalle tienen que leer el mismo slug, y este lo resuelve una sola vez.
    const { getDeporteEventos } = await import("@/lib/deporte");

    mockAgenda.mockResolvedValue([evento({ id: "x", slug: "x", kind: "agenda" })]);

    const [ev] = await getDeporteEventos();
    expect(ev.id).toBe("x");
    expect(ev.slug).toBe("x");
  });
});
