/**
 * @jest-environment jsdom
 */

/**
 * Un carrusel con un solo evento no es un carrusel.
 *
 * **Medido en producción el 9 de octubre de 2026:** `Planes familiares` pintaba
 * **una tarjeta en 470 px**, un tercio de pantalla para un club de lectura infantil.
 * La causa está en una línea de `CategoryCarousel.tsx`, que se ocultaba solo con
 * `events.length === 0` y por lo tanto se Dibujaba entero con uno.
 *
 * **Por qué el umbral es tres y no uno.** Con dos ya no hay carrusel: hay dos
 * tarjetas sueltas con un hueco enorme al lado, y es lo mismo que pasa con una pero
 * con la mitad de la culpa visual. Tres es donde una fila empieza a leerse como fila.
 *
 * **Y por qué no se pierde nada.** Los eventos del carboxil que no llegan al umbral
 * siguen saliendo en «Próximos 7 días» y en «Próximos eventos», que son la lista del
 * día y el resto de la agenda. Lo que se deja de hacer es **darles una sección entera
 * para una tarjeta**; el enlace a la categoría tampoco desaparece, porque vive en
 * `SectionsHub`, más arriba.
 */
import { escenario } from "../helpers-a11y";

type Modulo = {
  default: (props: Record<string, unknown>) => unknown;
};

function ev(i: number) {
  return {
    id: `e${i}`,
    slug: `evento-${i}`,
    title: `Evento ${i}`,
    date: "2030-05-01T20:00:00.000Z",
    location: "Sala X",
    link: `/evento/evento-${i}`,
    category: "Infantil",
    source: "municipal",
    image: "https://sarrerak.jimmyjazzgasteiz.com/cartel.jpg",
  };
}

function montar(eventos: unknown[]) {
  const esc = escenario<Modulo>("@/app/components/CategoryCarousel");
  const nodo = esc.crear(esc.modulo.default, {
    title: "Planes familiares",
    subtitle: "Con niños y para todos",
    href: "/kids",
    events: eventos,
    categoryColors: {},
    variant: "grid",
    tag: "Niños",
    tagColor: "var(--teal)",
  });
  const vista = esc.montar(esc.conProviders(nodo));

  // Se guarda la función, no su resultado: `vista.texto()` lee el DOM en el momento
  // en que se llama, y tras el montaje es cuando hay algo que leer.
  return { texto: vista.texto, desmontar: () => vista.desmontar() };
}

describe("los carruseles de categoría de la home", () => {
  it("con un solo evento no pinta sección", () => {
    // El caso que se vio: 470 px para una tarjeta.
    const { texto, desmontar } = montar([ev(0)]);

    expect(texto()).not.toContain("Planes familiares");
    desmontar();
  });

  it("con dos tampoco: no hay carrusel que arrastrar", () => {
    const { texto, desmontar } = montar([ev(0), ev(1)]);

    expect(texto()).not.toContain("Planes familiares");
    desmontar();
  });

  it("con tres ya es una fila y se pinta", () => {
    const { texto, desmontar } = montar([ev(0), ev(1), ev(2)]);

    expect(texto()).toContain("Planes familiares");
    expect(texto()).toContain("Evento 0");
    desmontar();
  });

  it("sin ninguno tampoco, que es lo que ya hacía", () => {
    const { texto, desmontar } = montar([]);

    expect(texto()).not.toContain("Planes familiares");
    desmontar();
  });
});