jest.mock("@/lib/agenda", () => ({
  getAgendaEventos: jest.fn(),
}));

import { buscarAgenda } from "@/lib/buscar";
import { getAgendaEventos, type AgendaEvento } from "@/lib/agenda";

/**
 * La búsqueda sobre el agregado entero.
 *
 * El agregado se mockea entero, por lo mismo que en `cultura-sources.test.ts`: la
 * versión de verdad scrapea las 28 fuentes y una de ellas se baja 6,5 MB. Lo que
 * hay que atar aquí es la regla de la búsqueda, y la regla se comprueba con
 * eventos de mentira.
 *
 * Estas fechas son de 2027 a propósito. Con 2026 pasarían hoy y solo fallarían a
 * partir de 2027, que es la forma que tiene un test de pudrirse sin que se note.
 */

const mockAgenda = getAgendaEventos as jest.MockedFunction<typeof getAgendaEventos>;

function evento(over: Partial<AgendaEvento>): AgendaEvento {
  return {
    id: over.slug ?? "slug",
    slug: "slug",
    title: "Evento",
    date: "2027-03-15T20:00:00.000Z",
    location: "Vitoria-Gasteiz",
    link: "https://example.com/a",
    category: "Otros",
    source: "municipal-agenda",
    ...over,
  };
}

describe("buscarAgenda", () => {
  beforeEach(() => {
    mockAgenda.mockResolvedValue([]);
  });

  it("busca en las 28 fuentes, no solo en las nueve de la vista de cultura", async () => {
    // Este es el test que ata el arreglo. El enlace "Ver todos los resultados"
    // apuntaba a `/culture?q=`, que es un filtro por `CULTURE_SOURCE_IDS`: nueve
    // ids. Una carrera de `buscametas-inscripciones` o un senderismo de
    // `cm-gazteiz` salía en el desplegable y luego la página no lo enseñaba.
    //
    // Con 2027 hay que mirar bien que el evento sea futuro: `getAgendaEventos` ya
    // no filtra el pasado, pero esta función vuelve a comprobar que sea hoy o
    // posterior, y un evento de 2027 no lo es hasta 2027.
    mockAgenda.mockResolvedValue([
      evento({ slug: "jazz-vam", title: "Jazz en el VAM", source: "vam" }),
      evento({
        slug: "jazz-calles",
        title: "Jazz por la calle",
        source: "gasteizhoy",
        date: "2026-12-20T20:00:00.000Z",
      }),
    ]);

    const { results, total } = await buscarAgenda("jazz");

    expect(total).toBe(2);
    expect(results.map((r) => r.source).sort()).toEqual(["gasteizhoy", "vam"]);
  });

  it("devuelve el total aparte, porque una lista recortada no dice si falta nada", async () => {
    mockAgenda.mockResolvedValue(
      Array.from({ length: 30 }, (_, i) =>
        evento({
          slug: `evento-${i}`,
          id: `evento-${i}`,
          title: `Concierto número ${i}`,
          source: "jimmyjazz",
          date: new Date(Date.UTC(2027, 0, 1 + i)).toISOString(),
        })
      )
    );

    const { results, total } = await buscarAgenda("concierto");

    expect(total).toBe(30);
    expect(results).toHaveLength(24);
    expect(results[0].slug).toBe("evento-0");
  });

  it("pagina sin repetir ni saltarse", async () => {
    mockAgenda.mockResolvedValue(
      Array.from({ length: 30 }, (_, i) =>
        evento({
          slug: `evento-${i}`,
          id: `evento-${i}`,
          title: `Concierto número ${i}`,
          source: "jimmyjazz",
          date: new Date(Date.UTC(2027, 0, 1 + i)).toISOString(),
        })
      )
    );

    const primera = await buscarAgenda("concierto", { limit: 24, offset: 0 });
    const segunda = await buscarAgenda("concierto", { limit: 24, offset: 24 });

    expect(primera.results).toHaveLength(24);
    expect(segunda.results).toHaveLength(6);
    expect(segunda.total).toBe(30);

    const slugs = [...primera.results, ...segunda.results].map((r) => r.slug);
    expect(new Set(slugs).size).toBe(30);
  });

  it("exige todos los términos, no cualquiera", async () => {
    mockAgenda.mockResolvedValue([
      evento({ slug: "jazz-vitoria", title: "Jazz en Vitoria", location: "Landaberde", source: "jimmyjazz" }),
      evento({ slug: "jazz-bilbao", title: "Jazz en Bilbao", location: "Indautxu", source: "gasteizhoy" }),
      evento({ slug: "rock-vitoria", title: "Rock en Vitoria", location: "Montehermoso", source: "jimmyjazz" }),
    ]);

    const { results, total } = await buscarAgenda("jazz landaberde");

    expect(total).toBe(1);
    expect(results[0].slug).toBe("jazz-vitoria");
  });

  it("buscar el nombre de la ciudad no devuelve la agenda entera", async () => {
    // `normalizeRaw` rellena `location` con "Vitoria-Gasteiz" cuando la fuente no
    // dice dónde es, así que sin quitarlo el haystack de casi todo evento contiene
    // "vitoria" y esta búsqueda —la primera que escribiría quien usa el sitio—
    // devolvería todo.
    mockAgenda.mockResolvedValue([
      evento({ slug: "a", title: "Jazz en Landaberde", location: "Vitoria-Gasteiz" }),
      evento({ slug: "b", title: "Teatro en el aula", location: "Vitoria-Gasteiz" }),
      evento({ slug: "c", title: "Senderismo", location: "Olárrizu" }),
    ]);

    expect((await buscarAgenda("vitoria")).total).toBe(0);
  });

  it("busca también por la etiqueta de la fuente", async () => {
    // "VAM" y "Ayuntamiento" son preguntas reales y el título de la ficha casi
    // nunca menciona al museo o al ayuntamiento.
    mockAgenda.mockResolvedValue([
      evento({ slug: "vam-1", title: "Exposición de cerámica", source: "vam" }),
      evento({ slug: "otro", title: "Exposición de cerámica", source: "municipal-agenda" }),
    ]);

    const { results } = await buscarAgenda("vam");
    expect(results.map((r) => r.slug)).toEqual(["vam-1"]);
  });

  it("con menos de dos letras no busca", async () => {
    mockAgenda.mockResolvedValue([evento({ title: "Jazz" })]);

    expect(await buscarAgenda("j")).toEqual({ results: [], total: 0 });
    expect(await buscarAgenda("  ")).toEqual({ results: [], total: 0 });
    // Y no llega a preguntar por el agregado: una letra es la agenda entera.
    expect(mockAgenda).not.toHaveBeenCalled();
  });

  it("un límite no numérico cae al valor por defecto en vez de devolver vacío", async () => {
    // El route handler pasa `Number(params.get("limit"))`, que para un parámetro
    // ausente es `NaN` y no `undefined`, así que el valor por defecto del
    // parámetro no se aplica. Un `slice(0, NaN)` devuelve lista vacía y el
    // síntoma sería "no hay resultados", que es exactamente el fallo que este
    // fichero arregla, repetido un nivel más abajo.
    mockAgenda.mockResolvedValue([evento({ title: "Jazz" })]);

    const conNaN = await buscarAgenda("jazz", { limit: Number(undefined), offset: Number(null) });
    expect(conNaN.total).toBe(1);
    expect(conNaN.results).toHaveLength(1);
  });

  it("el id del resultado es el slug", async () => {
    mockAgenda.mockResolvedValue([
      evento({ slug: "concierto-2027-03-15-abc123", title: "Concierto de prueba" }),
    ]);

    const { results } = await buscarAgenda("concierto");
    expect(results[0].id).toBe(results[0].slug);
  });
});
