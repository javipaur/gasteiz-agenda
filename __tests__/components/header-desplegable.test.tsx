/**
 * @jest-environment jsdom
 */

/**
 * `Header`: el desplegable de Categorías deja de fingir que es un menú, Escape
 * devuelve el foco, y el cartel del atajo dice la tecla que existe en la plataforma.
 */
import { escenario } from "../helpers-a11y";

type HeaderModulo = { default: (props: Record<string, never>) => unknown };

function plataforma(valor: string): void {
  Object.defineProperty(window.navigator, "platform", {
    value: valor,
    configurable: true,
  });
}

function montarHeader() {
  const esc = escenario<HeaderModulo>("@/app/components/Header");
  const vista = esc.montar(esc.conProviders(esc.crear(esc.modulo.default, {})));
  return { ...esc, vista };
}

describe("Header", () => {
  it("Categorías no declara role=menu ni role=menuitem", () => {
    // El patrón ARIA de menú **exige** teclado de menú: ArrowUp/Down, Home/End y
    // gestión de `tabIndex`. Aquí no hay nada de eso, así que al activarlo el lector
    // entra en modo navegación de menú donde Tab no recorre y las flechas no hacen
    // nada: peor que no declarar el rol. Es una lista de enlaces de navegación, y
    // como lista se declara.
    const { act, vista } = montarHeader();
    const boton = vista.botonPorNombre("Categorías")!;
    act(() => boton.click());

    expect(vista.consultar('[role="menu"]')).toBeNull();
    expect(vista.consultarTodos('[role="menuitem"]')).toHaveLength(0);

    vista.desmontar();
  });

  it("el panel son listas de enlaces con aria-expanded y aria-controls", () => {
    const { act, vista } = montarHeader();
    const boton = vista.botonPorNombre("Categorías")!;
    act(() => boton.click());

    expect(boton.getAttribute("aria-expanded")).toBe("true");
    const panelId = boton.getAttribute("aria-controls");
    expect(panelId).toBeTruthy();
    const panel = vista.consultar(`#${panelId}`);
    expect(panel).not.toBeNull();

    const enlaces = panel!.querySelectorAll("a");
    expect(enlaces).toHaveLength(16);
    for (const enlace of Array.from(enlaces)) {
      expect(enlace.closest("ul")).not.toBeNull();
      expect(enlace.getAttribute("role")).toBeNull();
    }

    vista.desmontar();
  });

  it("Escape cierra el desplegable y devuelve el foco al botón", () => {
    // Antes el foco se perdía: `setCategoriesOpen(false)` desmontaba el panel con el
    // foco dentro, `document.activeElement` caía a `body` y el siguiente Tab
    // reiniciaba desde el principio del documento.
    const { act, vista } = montarHeader();
    const boton = vista.botonPorNombre("Categorías")!;
    act(() => boton.click());

    const panelId = boton.getAttribute("aria-controls")!;
    const primerEnlace = vista.consultar(`#${panelId} a`)!;
    primerEnlace.focus();
    expect(document.activeElement).toBe(primerEnlace);

    act(() => {
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    });

    expect(vista.consultar(`#${panelId}`)).toBeNull();
    expect(document.activeElement).toBe(boton);

    vista.desmontar();
  });

  it("el cartel del atajo dice Ctrl en Windows y ⌘ en Mac", () => {
    // Los dos sitios manejan `metaKey || ctrlKey`, así que en Windows el atajo es
    // `Ctrl K`. Poner `⌘K` fijo hace que el cartel describa una tecla que no
    // existe en esa máquina.
    const { act, crear, conProviders, montar, modulo } = escenario<HeaderModulo>(
      "@/app/components/Header"
    );

    plataforma("Win32");
    const enWindows = montar(conProviders(crear(modulo.default, {})));
    act(() => enWindows.consultar('button[aria-label="Buscar"]')!.click());
    expect(enWindows.consultar("kbd")!.textContent).toBe("Ctrl K");
    enWindows.desmontar();

    plataforma("MacIntel");
    const enMac = montar(conProviders(crear(modulo.default, {})));
    act(() => enMac.consultar('button[aria-label="Buscar"]')!.click());
    expect(enMac.consultar("kbd")!.textContent).toBe("⌘K");
    enMac.desmontar();
  });
});