/**
 * @jest-environment jsdom
 */

/**
 * El destacado del hero enseña más de un evento.
 *
 * **Por qué tres y no uno, y por qué no es una preferencia de maquetación.** Una
 * tarjeta sola con foto grande, fecha y una flecha a la derecha es exactamente la
 * gramática de un hueco patrocinado: un solo elemento destacado en la primera pantalla
 * parece comprado. Enseñar tres de la misma categoría y del mismo estilo hace que se
 * lean como una selección editorial, que es lo que es.
 *
 * **El orden y el criterio no cambian.** `HeroSection` sigue usando `getPopularEvents`
 * sin ventana, o sea que puede sacar algo de dentro de la semana, y eso se mantiene a
 * propósito: un destacado que solo puede ser de hoy esconde lo mejor de la semana.
 * Lo que cambia es cuántos se enseñan.
 */
import { escenario } from "../helpers-a11y";

type Modulo = {
  default: (props: Record<string, unknown>) => unknown;
};

/**
 * Doce eventos a días distintos, **en orden inverso al de cercanía**.
 *
 * El array va del más lejano al más cercano a propósito: si el orden de salida fuese
 * el de entrada, el primer caso pasaría sin comprobar nada, que es el modo de fallo
 * más barato que hay en un test de orden.
 */
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

/** Del día 12 al día 1: la entrada está al revés de como deben salir. */
const EVENTOS = Array.from({ length: 12 }, (_, k) => ev(12 - k));

function montar() {
  const esc = escenario<Modulo>("@/app/components/HeroSection");
  const nodo = esc.crear(esc.modulo.default, { eventos: EVENTOS, ahora: Date.UTC(2030, 4, 9) });
  const vista = esc.montar(esc.conProviders(nodo));
  return { ...esc, vista };
}

describe("los destacados del hero", () => {
  it("enseña tres, no uno", () => {
    // El caso que motivó el cambio: una sola tarjeta parece un patrocinio.
    const { vista } = montar();

    expect(vista.consultarTodos('a[href^="/evento/"]')).toHaveLength(3);
    expect(vista.texto()).toContain("Evento número");
    vista.desmontar();
  });

  it("los tres son los tres más próximos a hoy, no los tres primeros de la lista", () => {
    // El criterio no se toca: siguen siendo los más populares, y la cercanía pesa. Como
    // el array entra al revés, que salgan el 1, el 2 y el 3 demuestra que se ha
    // **ordenado** y no solo recortado.
    const { vista } = montar();

    const enlaces = vista
      .consultarTodos('a[href^="/evento/"]')
      .map((a) => a.getAttribute("href"));

    expect(enlaces).toEqual(["/evento/evento-1", "/evento/evento-2", "/evento/evento-3"]);
    vista.desmontar();
  });

  it("cada uno lleva su fecha y su recinto, que es lo que los distingue", () => {
    // Tres tarjetas idénticas sin estos datos serían tres huecos; con ellos se ve que
    // son tres planes distintos.
    const { vista } = montar();

    expect(vista.texto()).toContain("Sala 1");
    expect(vista.texto()).toContain("Sala 2");
    expect(vista.texto()).toContain("Sala 3");
    vista.desmontar();
  });

  it("sin eventos no hay destacados y no se rompe", () => {
    const esc = escenario<Modulo>("@/app/components/HeroSection");
    const nodo = esc.crear(esc.modulo.default, { eventos: [], ahora: Date.UTC(2030, 4, 9) });
    const vista = esc.montar(esc.conProviders(nodo));

    expect(vista.consultarTodos('a[href^="/evento/"]')).toHaveLength(0);
    expect(vista.texto()).toContain("La agenda de Vitoria-Gasteiz");
    vista.desmontar();
  });
});