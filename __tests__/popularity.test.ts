import { getPopularEvents, scoreEvento, SOURCE_WEIGHT, CATEGORY_WEIGHT } from "@/lib/popularity";
import { CATEGORY_COLORS, normalizeCategory } from "@/lib/categories";
import { SOURCE_DATA, SOURCE_GROUPS } from "@/lib/source-data";
import type { Evento } from "@/lib/eventos";

const today = new Date("2026-09-16T12:00:00Z");
/** Tan lejos que ningún evento entra en la ventana de 14 días del bonus de cercanía. */
const lejos = new Date("2020-01-01T00:00:00Z");

function makeEvento(overrides: Partial<Evento> = {}): Evento {
  return {
    id: "e1",
    slug: "concierto-de-prueba-2026-09-18",
    title: "Concierto de prueba",
    date: "2026-09-18",
    image: "https://example.com/img.jpg",
    location: "Vitoria-Gasteiz",
    link: "https://example.com/evento",
    category: "Música",
    source: "fever",
    description: "Un concierto de prueba con una descripción lo bastante larga para sumar puntos.",
    ...overrides,
  };
}

/**
 * Puntuación de un evento pelado: sin imagen, sin precio, sin nota, sin
 * descripción y sin bonus de cercanía. Lo que queda es exactamente
 * `peso de la fuente + peso de la categoría`, que es lo que se quiere comprobar.
 */
function puntua(overrides: Partial<Evento> = {}): number {
  return scoreEvento(
    makeEvento({
      image: undefined,
      price: undefined,
      rating: undefined,
      description: "",
      ...overrides,
    }),
    lejos
  );
}

// Pesos fijados aquí a propósito y no leídos del módulo: un test que compara la
// tabla consigo mismo no puede fallar. Si un día se cambia un peso en
// `lib/popularity.ts`, estos números son los que lo dicen.
const PESO_POR_DEFECTO = 5;
const PESO_MUNICIPAL = 25;
const PESO_CATEGORIA_POR_DEFECTO = 10;

const PESOS_POR_CATEGORIA: Record<string, number> = {
  Música: 30,
  Festival: 26,
  Fiestas: 25,
  Teatro: 22,
  Danza: 22,
  Exposiciones: 18,
  Infantil: 18,
  Gastronomía: 16,
  Visitas: 16,
  Talleres: 16,
  Deporte: 14,
  Cine: 12,
  Conferencias: 12,
  Senderismo: 12,
  Otros: 10,
};

describe("scoreEvento", () => {
  it("las diez entradas municipales puntúan como municipal y no como desconocidas", () => {
    // El bug que se arregla aquí: el peso se leía por id y la tabla tenía
    // "vitoria-gasteiz", un id que desde la T4 no emite nadie. Con eso, las
    // variantes municipales —la fuente con más volumen de la agenda— caían al
    // mínimo por defecto y la home ordenaba "Populares" sin ellas.
    //
    // El número va escrito a propósito: es la undécima variante municipal la que
    // haría fallar esto, y no por su peso —que se resuelve por grupo y sería
    // correcto—, sino porque obliga a mirar la lista al añadirla.
    const municipales = SOURCE_DATA.filter((e) => e.group === "municipal").map((e) => e.id);
    expect(municipales).toHaveLength(10);

    const pesos = municipales.map((id) => puntua({ source: id, category: "Otros" }));

    // Todas iguales, porque el peso se resuelve por grupo: añadir una variante
    // municipal nueva no puede dejarla en el mínimo sin que nadie se entere.
    for (const peso of pesos) {
      expect(peso).toBe(PESO_MUNICIPAL + PESO_CATEGORIA_POR_DEFECTO);
    }
    expect(pesos).not.toContain(PESO_POR_DEFECTO + PESO_CATEGORIA_POR_DEFECTO);
  });

  it("el peso sale del grupo del registro y no del id", () => {
    // Pares que comparten familia en `lib/source-data.ts`. Si el peso se leyera por
    // id, cada id de la pareja caería al mínimo por su cuenta.
    const parejas: [string, string][] = [
      ["vam", "vam-conciertos"],
      ["municipal-agenda", "municipal-rss"],
      ["municipal-deporte", "municipal-infantil"],
      ["buscametas-calendario", "buscametas-inscripciones"],
    ];
    for (const [a, b] of parejas) {
      expect(puntua({ source: a })).toBe(puntua({ source: b }));
    }

    // Y que el grupo sea el que resuelve, con los valores de los que depende la
    // tabla. `SOURCE_GROUPS` no tenía ningún test que lo atara (quedó anotado en
    // la revisión de la T1) y ahora de él depende la puntuación de la home.
    expect(SOURCE_GROUPS["vam-conciertos"]).toBe("vam");
    expect(SOURCE_GROUPS["municipal-rss"]).toBe("municipal");
    expect(SOURCE_GROUPS["municipal-infantil"]).toBe("municipal");
    expect(SOURCE_GROUPS["senderismo"]).toBe("cm-gazteiz");
    expect(SOURCE_GROUPS["buscametas-inscripciones"]).toBe("buscametas");
  });

  it("la diferencia de puntuación entre dos fuentes es la diferencia de sus pesos", () => {
    expect(puntua({ source: "fever" }) - puntua({ source: "rula" })).toBe(40 - 15);
    expect(puntua({ source: "euskadi" }) - puntua({ source: "vam" })).toBe(20 - 18);
    expect(puntua({ source: "gasteizhoy" }) - puntua({ source: "municipal-agenda" })).toBe(20 - 25);
  });

  it("prioritizes high-weight sources and categories", () => {
    const fever = makeEvento({ source: "fever", category: "Música" });
    const flojo = makeEvento({
      source: "jimmyjazz",
      category: "Cine",
      image: undefined,
      price: undefined,
      rating: undefined,
      description: "",
    });

    expect(scoreEvento(fever, today)).toBeGreaterThan(scoreEvento(flojo, today));
  });

  it("las quince categorías reales tienen el peso que les corresponde", () => {
    // El conjunto de pesos y el de `CATEGORY_COLORS` tienen que seguir siendo el
    // mismo, en los dos sentidos: una categoría nueva sin peso puntuaría el
    // mínimo en silencio.
    expect(Object.keys(PESOS_POR_CATEGORIA).sort()).toEqual(Object.keys(CATEGORY_COLORS).sort());

    for (const categoria of Object.keys(CATEGORY_COLORS)) {
      expect(puntua({ category: categoria })).toBe(40 + PESOS_POR_CATEGORIA[categoria]);
    }
  });

  it("la tabla de categorías no tiene claves que ninguna fuente pueda producir", () => {
    // Antes tenía dos: "Conciertos", que `normalizeCategory` convierte en "Música",
    // y "La Blanca", que hoy es la categoría "Fiestas". Una clave así es un número
    // que no puntúa nada y que además esconde que la categoría real sí tiene peso.
    for (const clave of Object.keys(CATEGORY_WEIGHT)) {
      expect(Object.keys(CATEGORY_COLORS)).toContain(clave);
    }
  });

  it("un concierto puntúa por Música y La Blanca por Fiestas", () => {
    // Las dos categorías que se habían quedado sin peso, por el camino viejo:
    // `scrapeJimmyJazz` y compañía emiten `category: "Música"`, y `fiestas-blanca`
    // emite `category: "Fiestas"`.
    expect(normalizeCategory("conciertos")).toBe("Música");
    expect(puntua({ category: normalizeCategory("conciertos") })).toBe(40 + 30);
    expect(puntua({ source: "fiestas-blanca", category: "Fiestas" })).toBe(
      PESO_POR_DEFECTO + 25
    );
  });

  it("una categoría fuera de la taxonomía puntúa el mínimo de categoría", () => {
    // Vive: `lib/sources/euskadi.ts` emite `category: "evento"`, que
    // `normalizeCategory` deja tal cual porque no está en sus alias. El `??` de
    // `CATEGORY_WEIGHT` no es código muerto.
    expect(puntua({ category: "evento" })).toBe(40 + PESO_CATEGORIA_POR_DEFECTO);
  });

  it("adds bonus points for image, price, rating and long description", () => {
    const rich = makeEvento();
    const poor = makeEvento({
      image: undefined,
      price: undefined,
      rating: undefined,
      description: "",
    });

    expect(scoreEvento(rich, today)).toBeGreaterThan(scoreEvento(poor, today));
  });

  it("awards near-term events a recency bonus", () => {
    const soon = makeEvento({ date: "2026-09-17" });
    const late = makeEvento({ date: "2027-03-01" });

    expect(scoreEvento(soon, today)).toBeGreaterThan(scoreEvento(late, today));
  });

  it("handles invalid dates without throwing", () => {
    expect(() => scoreEvento(makeEvento({ date: "not-a-date" }), today)).not.toThrow();
  });
});

describe("SOURCE_WEIGHT", () => {
  it("está indexado por grupo, así que ninguna clave es el id de una variante", () => {
    // Si alguien reintrodujera una clave por id —que es como estaba— el municipal
    // volvería a necesitar ocho o nueve líneas y a pudrirse en el próximo
    // `SOURCE_DATA` que se añada.
    //
    // Se comparan contra los ids cuya `group` **difiere** de su id, que son las
    // variantes: `vam` sí aparece en la lista, pero porque su propio grupo se
    // llama `vam`, y eso es un grupo legítimo y no una variante.
    const variantes = SOURCE_DATA.filter((e) => e.group && e.group !== e.id).map((e) => e.id);
    expect(variantes).toContain("municipal-agenda");
    expect(variantes).toContain("vam-conciertos");

    for (const clave of Object.keys(SOURCE_WEIGHT)) {
      expect(variantes).not.toContain(clave);
    }
    expect(Object.keys(SOURCE_WEIGHT)).toContain("municipal");
  });

  it("cubre la fuente con más volumen de la agenda", () => {
    // Si este test falla, el bloque "Populares" de la home y el destacado del hero
    // han vuelto a ignorar al Ayuntamiento.
    expect(SOURCE_WEIGHT.municipal).toBe(PESO_MUNICIPAL);
    expect(SOURCE_WEIGHT.municipal).toBeGreaterThan(PESO_POR_DEFECTO);
  });
});

describe("getPopularEvents", () => {
  it("filters out events without images and sorts by score desc", () => {
    const withImg1 = makeEvento({ id: "a", title: "A", date: "2026-09-20", image: "https://example.com/a.jpg" });
    const withImg2 = makeEvento({ id: "b", title: "B", date: "2026-09-30", source: "rula" });
    const noImg = makeEvento({ id: "c", title: "C", image: undefined });

    const result = getPopularEvents([noImg, withImg2, withImg1], 10, today);

    expect(result).toHaveLength(2);
    expect(result.find((e) => e.id === "c")).toBeUndefined();
    // `AgendaEvento` no lleva `popularity` a propósito: el campo solo existía
    // mientras `lib/eventos.ts` se lo ponía a mano, y el agregador no lo produce.
    // El score se recalcula con la misma función que se usó para ordenar, en vez
    // de leer un campo que ya no existe.
    const scores = result.map((e) => scoreEvento(e, today));
    expect(scores[0]).toBeGreaterThanOrEqual(scores[1]);
  });

  it("no devuelve los eventos adornados con el score", () => {
    // La puntuación es para ordenar, no un dato del evento: si volviera a colarse
    // una propiedad `popularity` en lo que se devuelve, un consumidor podría
    // llegarse a leer un campo que `AgendaEvento` no declara.
    const [evento] = getPopularEvents([makeEvento()], 1, today);
    expect(Object.keys(evento)).not.toContain("popularity");
  });

  it("los empates conservan el orden de entrada", () => {
    const eventos = [
      makeEvento({ id: "a", title: "A" }),
      makeEvento({ id: "b", title: "B" }),
      makeEvento({ id: "c", title: "C" }),
    ];

    expect(getPopularEvents(eventos, 3, today).map((e) => e.id)).toEqual(["a", "b", "c"]);
  });

  it("prioriza lo municipal por encima de una sala, como antes de la unificación", () => {
    // Regresión de la T4 escrita al revés: si el peso se leyera por id, el
    // Ayuntamiento caería al mínimo y la sala ganaría. Con el mismo resto de
    // campos, lo municipal tiene que ir por delante.
    const municipal = makeEvento({ id: "m", source: "municipal-agenda", category: "Teatro" });
    const sala = makeEvento({ id: "s", source: "jimmyjazz", category: "Teatro" });

    expect(getPopularEvents([sala, municipal], 1, today)[0].id).toBe("m");
  });

  it("respects the limit", () => {
    const eventos = Array.from({ length: 5 }, (_, i) =>
      makeEvento({ id: `e${i}`, title: `Evento ${i}`, date: `2026-09-2${i}` })
    );

    const result = getPopularEvents(eventos, 2, today);
    expect(result).toHaveLength(2);
  });
});
