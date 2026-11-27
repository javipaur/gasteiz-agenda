/**
 * @jest-environment jsdom
 */

/**
 * Los dos bloques centrales de la home se comprueban por los enlaces que pinta
 * el navegador, no por el array que sale del selector.
 *
 * `Hoy en Vitoria` y `Qué recomendamos` son dos componentes distintos y el
 * solape no daba ningún error: los dos pintaban `/evento/<slug>` válidos. Un
 * test que mirara solo `seleccionHome` comprobaría la aritmética, pero no que
 * `app/page.tsx` pasa ese resultado a los dos sitios y que los dos enlazan al
 * mismo sitio. Aquí se montan los dos con exactamente las props que les pasa
 * la página y se comparan los `href` del DOM.
 */
import { escenario } from "../helpers-a11y";
import type { Vista } from "../helpers-dom";
import { seleccionHome } from "@/lib/home-seleccion";
import type { Evento } from "@/lib/eventos";

type Modulo = { default: (props: Record<string, unknown>) => unknown };

function ev(id: string, conHora: boolean): Evento {
  return {
    id,
    slug: id,
    title: `Plan ${id}`,
    date: "2026-11-26T19:00:00.000Z",
    time: conHora ? "20:00" : undefined,
    image: "https://www.vitoria-gasteiz.org/c.jpg",
    location: "Sala",
    link: `/evento/${id}`,
    category: "Música",
    source: "municipal",
  };
}

function enlaces(vista: Vista): string[] {
  return vista
    .consultarTodos("a[href^='/evento/']")
    .map((a) => a.getAttribute("href"))
    .filter((h): h is string => h !== null);
}

function montar(ruta: string, props: Record<string, unknown>) {
  const esc = escenario<Modulo>(ruta);
  const vista = esc.montar(esc.conProviders(esc.crear(esc.modulo.default, props)));
  return { esc, vista };
}

describe("los dos bloques centrales de la home", () => {
  it("ningún /evento/<slug> aparece en «Hoy» y en «Qué recomendamos»", () => {
    // Diez planes de hoy: los seis primeros tienen hora y son los que pinta el
    // bloque de arriba. Los otros cuatro son los que tiene que encontrar el
    // riel. Si el selector no excluyera, los seis de arriba ganarían también
    // abajo y este test vería seis href repetidos.
    const eventos = Array.from({ length: 10 }, (_, i) => ev(`plan-${i}`, i < 6));
    const seleccion = seleccionHome(eventos, new Date("2026-11-26T18:00:00.000Z").getTime());

    const hoy = montar("@/app/components/TodayDecision", {
      planesDeHoy: seleccion.planesDeHoy,
      totalDeHoy: seleccion.totalDeHoy,
    });
    const top = montar("@/app/components/TopEventsSection", {
      events: seleccion.recomendadosDeHoy,
    });

    const deHoy = enlaces(hoy.vista);
    const delRiel = enlaces(top.vista);

    expect(deHoy).toHaveLength(6);
    expect(delRiel).toHaveLength(4);
    expect(deHoy.filter((href) => delRiel.includes(href))).toEqual([]);

    hoy.vista.desmontar();
    top.vista.desmontar();
  });

  it("aria-labelledby apunta al h2 y no al envoltorio", () => {
    const eventos = [ev("plan-0", true)];
    const seleccion = seleccionHome(eventos, new Date("2026-11-26T18:00:00.000Z").getTime());
    const { vista } = montar("@/app/components/TodayDecision", {
      planesDeHoy: seleccion.planesDeHoy,
      totalDeHoy: seleccion.totalDeHoy,
    });

    expect(vista.consultar("section")?.getAttribute("aria-labelledby")).toBe("hoy-en-vitoria");
    expect(vista.consultar("#hoy-en-vitoria")?.tagName).toBe("H2");

    vista.desmontar();
  });
});
