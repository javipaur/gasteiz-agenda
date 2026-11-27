import { seleccionHome } from "@/lib/home-seleccion";
import type { Evento } from "@/lib/eventos";

function ev(id: string, overrides: Partial<Evento> = {}): Evento {
  return {
    id,
    slug: id,
    title: `Plan ${id}`,
    date: "2026-11-26T18:00:00.000Z",
    time: "19:00",
    link: `https://example.com/${id}`,
    image: "https://www.vitoria-gasteiz.org/c.jpg",
    location: "Sala",
    source: "municipal",
    category: "Música",
    ...overrides,
  };
}

const ahora = new Date("2026-11-26T18:00:00.000Z").getTime();

describe("seleccionHome", () => {
  it("los seis de hoy van con hora primero y no se repiten en recomendados", () => {
    const eventos = [
      ev("sin-hora-1", { time: undefined }),
      ...Array.from({ length: 6 }, (_, i) => ev(`hora-${i}`)),
      ev("manana", { date: "2026-11-27T18:00:00.000Z" }),
    ];

    const s = seleccionHome(eventos, ahora);

    expect(s.planesDeHoy.map((e) => e.id)).toEqual([
      "hora-0",
      "hora-1",
      "hora-2",
      "hora-3",
      "hora-4",
      "hora-5",
    ]);
    expect(s.totalDeHoy).toBe(7);
    expect(s.recomendadosDeHoy.map((e) => e.id)).toEqual(["sin-hora-1"]);
  });

  it("usa una sola fecha local y no mezcla el día del proceso", () => {
    const eventos = [
      ev("de-hoy", { date: "2026-11-26T21:00:00.000Z" }),
      ev("de-ayer", { date: "2026-11-25T20:00:00.000Z" }),
    ];

    const s = seleccionHome(eventos, ahora);

    expect(s.planesDeHoy.map((e) => e.id)).toEqual(["de-hoy"]);
    expect(s.totalDeHoy).toBe(1);
  });

  it("no devuelve recomendados si todos los de hoy ya están arriba", () => {
    const eventos = Array.from({ length: 3 }, (_, i) => ev(`hoy-${i}`));

    const s = seleccionHome(eventos, ahora);

    expect(s.planesDeHoy).toHaveLength(3);
    expect(s.recomendadosDeHoy).toEqual([]);
  });
});
