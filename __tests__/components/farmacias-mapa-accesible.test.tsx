/**
 * @jest-environment jsdom
 */

/**
 * Los marcadores del mapa de Leaflet son `<path>` de SVG con un
 * `eventHandlers.click`: no son enfocables y no tienen nombre. El `aria-label` que
 * llevaba el contenedor caía sobre un `<div>` sin rol, donde la especificación dice
 * que se ignora — así que el mapa no leía nada y la lista de botones de al lado era
 * lo único accesible.
 *
 * `react-leaflet` y la hoja de estilos de Leaflet se sustituyen aquí: el primero
 * necesita un contenedor de mapa real y un ciclo de render de Leaflet que no existen
 * en jsdom, y la segunda no es JavaScript. Lo que se asserta es el HTML que produce
 * el componente, no el DOM que dibuja Leaflet.
 */
import { escenario } from "../helpers-a11y";

jest.mock("leaflet/dist/leaflet.css", () => ({}));

jest.mock("react-leaflet", () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const ReactMod = require("react") as typeof import("react");
  // Solo se pasa `children`: las props de Leaflet (`center`, `pathOptions`,
  // `eventHandlers`…) no son atributos del DOM y React se quejaría de cada una.
  const envoltorio = (nombre: string) => {
    const Componente = (props: Record<string, unknown>) =>
      ReactMod.createElement("div", {
        "data-leaflet": nombre,
        children: props.children as import("react").ReactNode,
      });
    Componente.displayName = nombre;
    return Componente;
  };
  return {
    __esModule: true,
    MapContainer: envoltorio("MapContainer"),
    TileLayer: envoltorio("TileLayer"),
    CircleMarker: envoltorio("CircleMarker"),
    Popup: envoltorio("Popup"),
    useMap: () => ({ flyTo: () => {}, getZoom: () => 14 }),
  };
});

type Modulo = {
  default: (props: Record<string, unknown>) => unknown;
};

const FARMACIAS = [
  { id: "f1", name: "Farmacia Centro", shortAddress: "Calle Mayor 1", horarios: "L-V 9:00", phone: "945 111 111", lat: 42.85, lng: -2.67 },
  { id: "f2", name: "Farmacia Estación", shortAddress: "Estación 2", horarios: "-", phone: "", lat: 42.86, lng: -2.68 },
];

describe("FarmaciasMap", () => {
  it("da nombre y foco a cada farmacia del mapa", () => {
    const { crear, montar, modulo } = escenario<Modulo>("@/app/components/FarmaciasMap");
    const vista = montar(
      crear(modulo.default, { farmacias: FARMACIAS, selectedId: null, onSelect: () => {} })
    );

    // Un botón de verdad por farmacia, con el nombre en el texto.
    const botones = vista.consultarTodos("ul.sr-only button");
    expect(botones).toHaveLength(2);
    expect(botones[0].textContent).toContain("Farmacia Centro");
    expect(botones[1].textContent).toContain("Farmacia Estación");

    // Y enfocables: eso es lo que un `<path>` de SVG no puede ser.
    botones[0].focus();
    expect(document.activeElement).toBe(botones[0]);

    // El `aria-label` del contenedor iba sobre un `<div>` sin rol, así que se ignora.
    expect(
      Array.from(vista.contenedor.querySelectorAll('[aria-label="Mapa de farmacias de guardia"]'))
    ).toHaveLength(0);

    vista.desmontar();
  });

  it("el botón del listado oculto selecciona la farmacia", () => {
    const { act, crear, montar, modulo } = escenario<Modulo>(
      "@/app/components/FarmaciasMap"
    );
    const elegido: string[] = [];
    const vista = montar(
      crear(modulo.default, {
        farmacias: FARMACIAS,
        selectedId: null,
        onSelect: (id: string) => elegido.push(id),
      })
    );

    act(() => vista.consultarTodos("ul.sr-only button")[1].click());

    expect(elegido).toEqual(["f2"]);

    vista.desmontar();
  });
});