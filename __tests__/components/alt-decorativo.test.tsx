/**
 * @jest-environment jsdom
 */

/**
 * La imagen y el título viven en el mismo `<a>`, así que con `alt={titulo}` el
 * lector anuncia el enlace con el título dos veces: una por el `alt` y otra por el
 * texto. Con `alt=""` se anuncia una sola, que es lo correcto cuando la imagen es
 * decorativa respecto al texto que ya está al lado.
 *
 * Ojo al revés: donde la imagen **no** comparte enlace con su título —una ficha de
 * restaurante, un escudo de club al lado del nombre del equipo— el `alt` descriptivo
 * se queda, porque ahí sí es el único nombre que hay.
 */
import { escenario } from "../helpers-a11y";

type Modulo = { default: (props: Record<string, unknown>) => unknown };

const EVENTO = {
  id: "e1",
  slug: "concierto-de-prueba",
  title: "Concierto de prueba",
  date: "2099-03-04",
  /* Un host **de la lista**, no `example.com`. Las tarjetas descartan la imagen si
     `imagenServible` dice que el host no está en `remotePatterns` —porque
     `next/image` lanza en render con uno que no lo esté, y eso tumba la página
     entera—, así que una URL de ejemplo haría que este test no encontrara ninguna
     imagen y pasara por un `alt` que ya no se está probando. El host es el del
     Ayuntamiento, que es el primero de `lib/image-hosts.ts`. */
  image: "https://www.vitoria-gasteiz.org/cartel.jpg",
  location: "Sala Gimeno",
  link: "https://example.com",
  category: "Conciertos",
  source: "jimmyjazz",
};

/** El prefijo `mock` es lo que deja cerrar sobre esto desde el factory de abajo. */
const mockPartidos = [
  {
    id: "p1",
    equipo: "baskonia",
    club: "Baskonia",
    competicion: "ACB",
    estadio: "Arena",
    fecha: "2099-03-04",
    hora: "20:00",
    link: "https://example.com",
    local: { nombre: "Baskonia", url: "https://example.com/l.png" },
    visitante: { nombre: "Rival", url: "https://example.com/v.png" },
  },
];

jest.mock("@/lib/partidos", () => ({
  getProximosPartidos: async () => mockPartidos,
}));

function montar(ruta: string, props: Record<string, unknown>, conProviders = true) {
  const esc = escenario<Modulo>(ruta);
  const nodo = esc.crear(esc.modulo.default, props);
  const vista = esc.montar(conProviders ? esc.conProviders(nodo) : nodo);
  return { ...esc, vista };
}

describe("alt dentro del enlace del título", () => {
  it.each([
    ["CulturePageClient", "@/app/components/CulturePageClient", true],
    ["ConciertosPageClient", "@/app/components/ConciertosPageClient", false],
    ["KidsPageClient", "@/app/components/KidsPageClient", false],
    ["SportPageClient", "@/app/components/SportPageClient", false],
  ])("%s pone alt vacío en la imagen de la tarjeta", (_nombre, ruta, conAhora) => {
    const props: Record<string, unknown> = { eventos: [EVENTO] };
    if (conAhora) props.ahora = Date.UTC(2099, 0, 1);
    const { vista } = montar(ruta, props);

    const imagenes = vista.consultarTodos("a img");
    expect(imagenes).toHaveLength(1);
    expect(imagenes[0].getAttribute("alt")).toBe("");

    vista.desmontar();
  });

  it("TopEventsSection pone alt vacío", () => {
    // `TopEventsSection` no se pinta con menos de cuatro eventos.
    const eventos = [1, 2, 3, 4].map((n) => ({ ...EVENTO, id: `e${n}`, ranking: n }));
    const { vista } = montar("@/app/components/TopEventsSection", { events: eventos });

    const imagenes = vista.consultarTodos("a img");
    expect(imagenes).toHaveLength(4);
    for (const imagen of imagenes) expect(imagen.getAttribute("alt")).toBe("");

    vista.desmontar();
  });

  it("NextDaysSection pone alt vacío en el destacado", () => {
    const { vista } = montar("@/app/components/NextDaysSection", {
      eventos: [EVENTO],
      ahora: Date.UTC(2099, 2, 4),
    });

    // El destacado y las tarjetas de `EventCard` comparten enlace con su título, así
    // que se comprueba el conjunto: ninguna imagen dentro de un `<a>` nombra el
    // evento que el texto de al lado ya nombra.
    const imagenes = vista.consultarTodos("a img");
    expect(imagenes.length).toBeGreaterThan(0);
    for (const imagen of imagenes) expect(imagen.getAttribute("alt")).toBe("");

    vista.desmontar();
  });

  it("MovieCard pone alt vacío", () => {
    const { vista } = montar(
      "@/app/components/MovieCard",
      {
        pelicula: {
          titulo: "La película",
          duracion: "120",
          genero: "Drama",
          imagen: "https://www.vitoria-gasteiz.org/cartel.jpg",
          link: "https://example.com",
          horarios: ["18:00"],
          cine: "Florida",
        },
      },
      false
    );

    const imagenes = vista.consultarTodos("a img");
    expect(imagenes).toHaveLength(1);
    expect(imagenes[0].getAttribute("alt")).toBe("");

    vista.desmontar();
  });

  it("ProMatchesBlock pone alt vacío en el escudo", async () => {
    // El escudo va al lado del nombre del equipo en la misma fila: con el `alt` con
    // el nombre, ese nombre se oía dos veces.
    const esc = escenario<{
      default: (props: Record<string, unknown>) => Promise<unknown>;
    }>("@/app/components/ProMatchesBlock");
    const nodo = await esc.modulo.default({ partidos: mockPartidos });
    const vista = esc.montar(esc.crear("div", { children: nodo }));

    const imagenes = vista.consultarTodos("img");
    expect(imagenes).toHaveLength(1);
    expect(imagenes[0].getAttribute("alt")).toBe("");

    vista.desmontar();
  });

  it("PartidosSection pone alt vacío en los dos escudos", async () => {
    const esc = escenario<{ default: () => Promise<unknown> }>(
      "@/app/components/PartidosSection"
    );
    const nodo = await esc.modulo.default();
    const vista = esc.montar(esc.crear("div", { children: nodo }));

    const imagenes = vista.consultarTodos("img");
    expect(imagenes).toHaveLength(2);
    for (const imagen of imagenes) expect(imagen.getAttribute("alt")).toBe("");

    vista.desmontar();
  });
});