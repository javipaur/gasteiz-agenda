/**
 * @jest-environment jsdom
 */

/**
 * El hero **no decide** qué plan merece la pena.
 *
 * Antes enseñaba tres tarjetas y, debajo, «Próximos 7 días» y el riel de
 * recomendados volvían a pintar los mismos eventos. Medido el 23 de octubre de
 * 2026, doce tarjetas de la última sección eran las doce de la anterior; con el
 * hero pasaba lo mismo en la primera pantalla.
 *
 * Este test fija la consecuencia: el hero recibe la agenda entera y no pinta
 * ningún enlace a un evento. La decisión de qué hacer hoy va a «Hoy en Vitoria»
 * y la de qué merece la pena va a «Qué recomendamos». Si mañana alguien vuelve a
 * meter tarjetas aquí, este test falla aunque los otros sigan verdes.
 */
import { escenario } from "../helpers-a11y";

type Modulo = {
  default: (props: Record<string, unknown>) => unknown;
};

function ev(i: number) {
  const d = new Date(Date.UTC(2030, 4, 9));
  d.setUTCDate(d.getUTCDate() + i);
  return {
    id: `e${i}`,
    slug: `evento-${i}`,
    title: `Evento número ${i}`,
    date: d.toISOString(),
    location: `Sala ${i}`,
    link: `/evento/evento-${i}`,
    category: "Conciertos",
    source: "jimmyjazz",
    image: `https://sarrerak.jimmyjazzgasteiz.com/${i}.jpg`,
  };
}

/** Del día 12 al día 1: la entrada está al revés de como se ordenaría. */
const EVENTOS = Array.from({ length: 12 }, (_, k) => ev(12 - k));

function montar(eventos: Record<string, unknown>[], ahora: number) {
  const esc = escenario<Modulo>("@/app/components/HeroSection");
  const nodo = esc.crear(esc.modulo.default, { eventos, ahora });
  const vista = esc.montar(esc.conProviders(nodo));
  return { ...esc, vista };
}

describe("el hero no enseña destacados", () => {
  it("recibe la agenda entera y no pinta ningún enlace de evento", () => {
    const { vista } = montar(EVENTOS, Date.UTC(2030, 4, 9));

    expect(vista.consultarTodos('a[href^="/evento/"]')).toHaveLength(0);
    expect(vista.texto()).not.toContain("Sala 1");
    vista.desmontar();
  });

  it("sí pinta los dos contadores: planes hoy y planes esta semana", () => {
    // Los doce eventos de `EVENTOS` están fuera de la semana del instante; con
    // dos eventos más, uno hoy y otro mañana, el número tiene que ser 1 y 2.
    // Si el hero volviera a cortar por cercanía, aquí seguiría leyendo 0 y 0.
    const eventos = [
      { ...ev(0), id: "hoy", slug: "hoy", title: "Plan de hoy", date: "2030-05-09T12:00:00" },
      { ...ev(1), id: "manana", slug: "manana", title: "Plan de mañana", date: "2030-05-10T12:00:00" },
      { ...ev(20), id: "lejos", slug: "lejos", title: "Plan lejano" },
    ];
    const { vista } = montar(eventos, new Date(2030, 4, 9, 12).getTime());

    expect(vista.texto()).toContain("1 planes hoy");
    expect(vista.texto()).toContain("2 esta semana");
    vista.desmontar();
  });

  it("sin eventos no se rompe: siguen la identidad y el buscador", () => {
    const { vista } = montar([], Date.UTC(2030, 4, 9));

    expect(vista.consultarTodos('a[href^="/evento/"]')).toHaveLength(0);
    expect(vista.texto()).toContain("La agenda de Vitoria-Gasteiz");
    expect(vista.texto()).toContain("0 planes hoy");
    vista.desmontar();
  });
});
