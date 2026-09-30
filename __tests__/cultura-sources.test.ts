jest.mock("@/lib/agenda", () => ({
  getAgendaEventos: jest.fn(),
}));

import {
  CULTURE_SOURCES,
  CULTURE_SOURCE_LABELS,
  CULTURE_SOURCE_PILLS,
  getCultureEventos,
} from "@/lib/cultura";
import { getAgendaEventos, type AgendaEvento } from "@/lib/agenda";
import { CULTURE_SOURCE_IDS } from "@/lib/source-data";

// El agregado se mockea entero. La version del brief —llamar a
// `getCultureEventos()` de verdad— scrapea las 27 fuentes del registro, y una de
// ellas se baja 8,7 MB: un test que depende de lo que publicen las salas y de que
// haya red no protege de nada. Lo que hay que atar aqui es la regla de la vista, y
// la regla se puede comprobar con eventos de mentira.

const mockAgenda = getAgendaEventos as jest.MockedFunction<typeof getAgendaEventos>;

// `id` y `slug` distintos a propósito. Con los dos iguales, una vista que los
// intercambiara —o que se inventara un id— pasaría el test sin que se notara, que
// es el bug de `/evento/[slug]` que esta vista podía reintroducir.
const BASE = {
  id: "codigo-jimmy-jazz-8891",
  slug: "concierto-2027-03-15-abc123",
  title: "Evento de prueba",
  date: "2027-03-15T20:00:00.000Z",
  location: "Vitoria-Gasteiz",
  link: "https://example.com/a",
};

function evento(over: Partial<AgendaEvento>): AgendaEvento {
  return { ...BASE, source: "municipal-agenda", category: "Otros", ...over };
}

describe("cultura source mapping", () => {
  it("cada fuente de cultura tiene pill y label", () => {
    const pillKeys = CULTURE_SOURCE_PILLS.conciertos.map((p) => p.key);
    for (const source of CULTURE_SOURCES) {
      expect(pillKeys).toContain(source);
      expect(CULTURE_SOURCE_LABELS[source]).toBeTruthy();
    }
  });

  it("la clave antigua lagenterula no existe", () => {
    expect(CULTURE_SOURCE_LABELS.lagenterula).toBeUndefined();
  });

  it("las pills son solo del bucket que las pinta y cubren todas las fuentes de cultura", () => {
    // `CulturePageClient.tsx:137` solo pinta `CULTURE_SOURCE_PILLS.conciertos` y
    // filtra con `e.source === pill.key`. Una clave escrita a mano que no sea un id
    // del registro no puede coincidir con ningún evento, y el síntoma es una
    // página vacía al pulsar la pill en vez de un error.
    expect(Object.keys(CULTURE_SOURCE_PILLS)).toEqual(["conciertos"]);

    const keys = CULTURE_SOURCE_PILLS.conciertos.map((p) => p.key);
    expect(keys[0]).toBe("all");
    expect(keys.slice(1)).toEqual([...CULTURE_SOURCE_IDS]);
  });

  it("cada pill lleva la forma { key, label } con la etiqueta del registro", () => {
    // El contrato de `CulturePageClient` es `{ key, label }`. Si la forma cambiara,
    // `pill.label` se pintaría undefined en pantalla sin que nada se queje.
    for (const pill of CULTURE_SOURCE_PILLS.conciertos) {
      expect(typeof pill.key).toBe("string");
      expect(typeof pill.label).toBe("string");
      if (pill.key !== "all") {
        expect(pill.label).toBe(CULTURE_SOURCE_LABELS[pill.key]);
      }
    }
  });
});

describe("getCultureEventos como vista del agregado", () => {
  beforeEach(() => {
    mockAgenda.mockResolvedValue([]);
  });

  it("el subconjunto de cultura no se vacía ni se sale de los cuatro cubos", async () => {
    mockAgenda.mockResolvedValue([
      evento({ source: "municipal-teatro", category: "Teatro" }),
      evento({ source: "municipal-conciertos", category: "Música" }),
      evento({ source: "municipal-exposiciones", category: "Exposiciones" }),
      evento({ source: "municipal-agenda", category: "Otros" }),
      evento({ source: "fever", category: "Festival" }),
      evento({ source: "rula", category: "Gastronomía" }),
      evento({ source: "gasteizhoy", category: "" }),
    ]);

    const evs = await getCultureEventos();
    expect(evs.length).toBeGreaterThan(0);
    for (const e of evs) {
      expect(["teatro", "conciertos", "exposiciones", "agenda"]).toContain(e.category);
    }
  });

  it("colapsa las categorías reales a los cuatro cubos de vista", async () => {
    mockAgenda.mockResolvedValue([
      evento({ source: "municipal-teatro", category: "Teatro" }),
      evento({ source: "jimmyjazz", category: "Música" }),
      evento({ source: "vam-conciertos", category: "Música" }),
      evento({ source: "municipal-exposiciones", category: "Exposiciones" }),
      evento({ source: "municipal-agenda", category: "Otros" }),
      evento({ source: "gasteizhoy", category: "Cine" }),
      // Una fuente que no trae categoría: el agregador la deja en "Otros" y de
      // aquí sale "agenda", que es lo que hacía el módulo viejo con su `|| "agenda"`.
      evento({ source: "rula", category: "" }),
    ]);

    const evs = await getCultureEventos();
    expect(evs.map((e) => [e.source, e.category])).toEqual([
      ["municipal-teatro", "teatro"],
      ["jimmyjazz", "conciertos"],
      ["vam-conciertos", "conciertos"],
      ["municipal-exposiciones", "exposiciones"],
      ["municipal-agenda", "agenda"],
      ["gasteizhoy", "agenda"],
      ["rula", "agenda"],
    ]);
  });

  it("solo deja pasar las fuentes de cultura del registro", async () => {
    // `municipal-visitas` es el caso que importa: el registro le pone `category:
    // "Visitas"` pero no `culture: true`, así que no entra en `/culture`.
    mockAgenda.mockResolvedValue([
      evento({ source: "municipal-agenda" }),
      evento({ source: "municipal-visitas", category: "Visitas" }),
      evento({ source: "eventbrite" }),
      evento({ source: "buscametas-calendario" }),
    ]);

    const evs = await getCultureEventos();
    expect(evs.map((e) => e.source)).toEqual(["municipal-agenda"]);
  });

  it("reproduce id y slug del agregado, y conserva el resto del evento", async () => {
    // La vista no rehace el evento: si tocara `id` o `slug`, el enlace de la
    // tarjeta daría 404 contra `/evento/[slug]`, que resuelve en el agregado. La
    // matriz `[id, slug]` de los dos eventos cubre las tres cosas a la vez: que
    // cada campo conserve su valor (si los intercambiara, saldrían cruzados), que
    // no se cuele ninguno de fuera y que no se caiga ninguno.
    mockAgenda.mockResolvedValue([
      evento({
        id: "codigo-jimmy-jazz-8891",
        slug: "concierto-2027-03-15-abc123",
        source: "jimmyjazz",
        category: "Música",
        image: "https://cdn/x.jpg",
        description: "Concierto de prueba",
      }),
      evento({
        id: "codigo-vam-1207",
        slug: "vam-2027-03-20-def456",
        source: "vam-conciertos",
        category: "Música",
      }),
      // Fuera de la vista: `buscametas-calendario` no es fuente de cultura.
      evento({ id: "codigo-buscametas-3311", slug: "carrera-2027-03-15-ef789", source: "buscametas-calendario" }),
    ]);

    const evs = await getCultureEventos();
    expect(evs.map((e) => [e.id, e.slug])).toEqual([
      ["codigo-jimmy-jazz-8891", "concierto-2027-03-15-abc123"],
      ["codigo-vam-1207", "vam-2027-03-20-def456"],
    ]);
    expect(evs[0].image).toBe("https://cdn/x.jpg");
    expect(evs[0].description).toBe("Concierto de prueba");
  });
});
