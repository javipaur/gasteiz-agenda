import { scoreEvento, getPopularEvents } from "@/lib/popularity";
import type { Evento } from "@/lib/eventos";

const today = new Date("2026-09-16T12:00:00Z");

function makeEvento(overrides: Partial<Evento> = {}): Evento {
  return {
    id: "e1",
    slug: "concierto-de-prueba-2026-09-18",
    title: "Concierto de prueba",
    date: "2026-09-18",
    image: "https://example.com/img.jpg",
    location: "Vitoria-Gasteiz",
    link: "https://example.com/evento",
    category: "Conciertos",
    source: "fever",
    description: "Un concierto de prueba con una descripción lo bastante larga para sumar puntos.",
    ...overrides,
  };
}

describe("scoreEvento", () => {
  it("prioritizes high-weight sources and categories", () => {
    const fever = makeEvento({ source: "fever", category: "Conciertos" });
    const unknown = makeEvento({ source: "desconocido", category: "Otros", image: undefined, price: undefined, rating: undefined, description: "" });

    expect(scoreEvento(fever, today)).toBeGreaterThan(scoreEvento(unknown, today));
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

describe("getPopularEvents", () => {
  it("filters out events without images and sorts by score desc", () => {
    const withImg1 = makeEvento({ id: "a", title: "A", date: "2026-09-20", image: "https://example.com/a.jpg" });
    const withImg2 = makeEvento({ id: "b", title: "B", date: "2026-09-30", source: "desconocido" });
    const noImg = makeEvento({ id: "c", title: "C", image: undefined });

    const result = getPopularEvents([noImg, withImg2, withImg1], 10, today);

    expect(result).toHaveLength(2);
    expect(result.find((e) => e.id === "c")).toBeUndefined();
    // `AgendaEvento` no lleva `popularity` a propósito: el campo solo existía
    // mientras `lib/eventos.ts` se lo ponía a mano, y el agregador no lo produce.
    // `getPopularEvents` lo calcula para ordenar y lo tira al devolver, así que
    // aquí se recalcula con la misma función en vez de leer un campo que ya no
    // existe.
    const scores = result.map((e) => scoreEvento(e, today));
    expect(scores[0]).toBeGreaterThanOrEqual(scores[1]);
  });

  it("respects the limit", () => {
    const eventos = Array.from({ length: 5 }, (_, i) =>
      makeEvento({ id: `e${i}`, title: `Evento ${i}`, date: `2026-09-2${i}` })
    );

    const result = getPopularEvents(eventos, 2, today);
    expect(result).toHaveLength(2);
  });
});