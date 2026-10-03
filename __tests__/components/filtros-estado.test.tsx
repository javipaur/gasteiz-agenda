/**
 * @jest-environment jsdom
 */

/**
 * Los filtros de píldoras son un grupo de botones conmutables. Sin `aria-pressed`
 * el único rastro de cuál está activo es el color de fondo, así que quien no
 * distingue ese color —o quien usa un lector de pantalla— no sabe qué filtro hay
 * puesto. El mismo componente, `MoodFilter`, ya lo hacía bien en su fila de
 * ambientaciones; estos ocho grupos se quedaron sin ello.
 */
import { escenario } from "../helpers-a11y";

type Cliente = { default: (props: Record<string, unknown>) => unknown };

const EVENTO = {
  id: "e1",
  slug: "un-evento",
  title: "Un evento",
  date: "2099-03-04",
  location: "Sala Gimeno",
  link: "https://example.com",
  category: "Teatro",
  source: "jimmyjazz",
};

/**
 * Las píldoras de filtro, y solo ellas.
 *
 * Se distinguen por dos cosas a la vez: son `rounded-full` y no llevan `aria-label`.
 * El botón de favorito y el de compartir sí son redondos, pero llevan nombre
 * accesible, así que quedan fuera — que es justo lo que se quiere, porque el
 * `aria-pressed` de un filtro no tiene nada que ver con ellos.
 */
const SELECTOR_FILTRO = "button.rounded-full:not([aria-label])";

describe("estado de los filtros", () => {
  it.each([
    ["MoviesPageClient", "@/app/components/MoviesPageClient", {
      peliculas: [
        { titulo: "Peli", duracion: "120", genero: "Drama", imagen: "i.jpg", link: "l", horarios: ["18:00"], cine: "Florida" },
      ],
    }],
    ["MoodFilter (cines)", "@/app/components/MoodFilter", {
      eventos: [EVENTO],
      peliculas: [
        { titulo: "Peli", cine: "Florida", horarios: ["18:00"], imagen: "i.jpg", link: "l", genero: "Drama", duracion: "120" },
      ],
    }],
    ["ConciertosPageClient", "@/app/components/ConciertosPageClient", { eventos: [EVENTO] }],
    ["SportPageClient", "@/app/components/SportPageClient", { eventos: [EVENTO] }],
  ])("%s marca la selección con aria-pressed", (_nombre, ruta, props) => {
    const { crear, montar, conProviders, modulo } = escenario<Cliente>(ruta);

    const vista = montar(conProviders(crear(modulo.default, props as Record<string, unknown>)));
    const botones = vista.consultarTodos(SELECTOR_FILTRO);
    // Sin esto el `it.each` pasaría con cero botones, que es lo mismo que no mirar.
    expect(botones.length).toBeGreaterThan(1);

    for (const boton of botones) {
      expect(boton.getAttribute("aria-pressed")).not.toBeNull();
    }
    // Y solo uno del grupo está activo: es un grupo conmutable, no ocho interruptores.
    expect(botones.filter((b) => b.getAttribute("aria-pressed") === "true")).toHaveLength(1);

    vista.desmontar();
  });

  it("CulturePageClient marca los dos grupos: categoría y recinto", () => {
    const { act, crear, montar, conProviders, modulo } = escenario<Cliente>(
      "@/app/components/CulturePageClient"
    );
    const vista = montar(
      conProviders(crear(modulo.default, { eventos: [EVENTO], ahora: Date.UTC(2099, 0, 1) }))
    );

    const categorias = vista.consultarTodos(SELECTOR_FILTRO);
    expect(categorias.length).toBe(7); // 5 categorías + "Populares" y "Próximos"
    for (const b of categorias) expect(b.getAttribute("aria-pressed")).not.toBeNull();
    expect(
      categorias.filter((b) => b.getAttribute("aria-pressed") === "true")
    ).toHaveLength(2); // "Todos" y "Populares"

    // El segundo grupo solo aparece al elegir "conciertos", y también lleva estado.
    act(() => vista.botonPorNombre("Conciertos")!.click());
    const conRecintos = vista.consultarTodos(SELECTOR_FILTRO);
    expect(conRecintos.length).toBeGreaterThan(categorias.length);
    for (const b of conRecintos) expect(b.getAttribute("aria-pressed")).not.toBeNull();

    vista.desmontar();
  });

  it("FiestasBlancaPageClient marca categoría y día", () => {
    const { crear, montar, conProviders, modulo } = escenario<Cliente>(
      "@/app/components/FiestasBlancaPageClient"
    );
    const vista = montar(
      conProviders(
        crear(modulo.default, {
          fiestas: [
            { id: "f1", title: "Concierto", date: "2099-08-04", category: "Conciertos, Teatro", location: "Plaza", url: "https://x", timeStart: "20:00", image: "" },
            { id: "f2", title: "Coros", date: "2099-08-05", category: "Teatro", location: "Plaza", url: "https://x", timeStart: "20:00", image: "" },
          ],
        })
      )
    );

    const botones = vista.consultarTodos(SELECTOR_FILTRO);
    expect(botones.length).toBeGreaterThan(3);
    for (const b of botones) expect(b.getAttribute("aria-pressed")).not.toBeNull();
    // "Todas" de categoría y "Todos" de día: uno por grupo.
    expect(botones.filter((b) => b.getAttribute("aria-pressed") === "true")).toHaveLength(2);

    vista.desmontar();
  });

  it("la navegación de /culture/[categoria] dice cuál es la página actual", async () => {
    // Aquí no es un filtro de botones sino una navegación de enlaces, así que lo
    // que corresponde es `aria-current="page"`: sin él, el enlace activo se
    // distingue solo por el color de fondo.
    jest.mock("@/lib/cultura", () => ({
      getCultureEventos: async () => [
        {
          id: "e1",
          slug: "un-evento",
          title: "Un evento",
          date: "2099-03-04",
          location: "Sala",
          link: "https://example.com",
          category: "teatro",
          source: "jimmyjazz",
        },
      ],
    }));

    const { crear, montar, modulo } = escenario<{
      default: (props: Record<string, unknown>) => Promise<unknown>;
    }>("@/app/culture/[categoria]/page");

    const nodo = await modulo.default({ params: Promise.resolve({ categoria: "teatro" }) });
    const vista = montar(crear("div", { children: nodo }));

    const enlaces = vista.consultarTodos("nav[aria-label='Categorías'] a");
    expect(enlaces.length).toBeGreaterThan(1);
    expect(enlaces.filter((a) => a.getAttribute("aria-current") === "page")).toHaveLength(1);

    vista.desmontar();
  });
});