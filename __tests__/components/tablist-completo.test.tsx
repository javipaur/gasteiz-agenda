/**
 * @jest-environment jsdom
 */

/**
 * `/turismo` y `/gastronomía` declaraban `role="tablist"` y `role="tab"` pero no
 * montaban la otra mitad del patrón: los contenidos se renderizaban como bloques
 * sueltos, sin `role="tabpanel"` ni `aria-controls`, y sin flechas. Un `tablist`
 * sin `tabpanel` promete una relación que no existe, y sin teclado de flechas hay
 * que tabular tres veces para cambiar de sección.
 *
 * `NextDaysSection` lo hace completo y bien, con `aria-controls`, `role="tabpanel"`
 * y `ArrowLeft`/`ArrowRight` moviendo el foco. Esto replica ese patrón.
 */
import { escenario } from "../helpers-a11y";

type Modulo = { default: (props: Record<string, unknown>) => unknown };

const SITIO = {
  slug: "bar-casual",
  nombre: "Bar Casual",
  barrio: "Centro",
  tipoCocina: "Casual",
  descripcion: "Comida de barrio.",
  direccion: "Calle Mayor 1",
  imagen: "https://www.vitoria-gasteiz.org/cartel.jpg",
  rangoPrecio: "€€",
  recomendado: true,
  linkMaps: "https://maps.example.com",
};

const RUTA_PINTXO = {
  slug: "ruta-1",
  zona: "Casco Viejo",
  nombre: "Ruta de pintxos",
  duracion: "2 h",
  paradas: [{ nombre: "Bar 1", pintxo: "Tortilla", precio: "€€", direccion: "Calle 1" }],
  consejo: "Ir con hambre.",
};

const PAGINAS: { nombre: string; ruta: string; props: Record<string, unknown> }[] = [
  {
    nombre: "TurismoPageClient",
    ruta: "@/app/components/TurismoPageClient",
    props: { queVer: [], rutas: [], visitas: [], info: { intro: "x", bloques: [] } },
  },
  {
    nombre: "GastronomiaPageClient",
    ruta: "@/app/components/GastronomiaPageClient",
    props: { sitios: [SITIO], rutas: [RUTA_PINTXO], eventos: [] },
  },
];

function montar(ruta: string, props: Record<string, unknown>) {
  const esc = escenario<Modulo>(ruta);
  const vista = esc.montar(esc.conProviders(esc.crear(esc.modulo.default, props)));
  return { ...esc, vista };
}

async function tecla(
  act: (fn: () => unknown) => void,
  vista: ReturnType<typeof montar>["vista"],
  key: string
) {
  act(() => {
    vista
      .consultar('[role="tablist"]')!
      .dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true }));
  });
  // El foco se mueve en `requestAnimationFrame`, que en el navegador es después del
  // repintado. Sin esperar el frame, `document.activeElement` sigue siendo la pestaña
  // de antes y el test mediría el orden de los nodos, no el del foco.
  await act(async () => {
    await new Promise((r) => requestAnimationFrame(() => r(null)));
  });
}

describe.each(PAGINAS)("$nombre", (pagina) => {
  it("cada pestaña controla un panel y solo la activa está en el tab order", () => {
    const { vista } = montar(pagina.ruta, pagina.props);

    const tabs = vista.consultarTodos('[role="tab"]');
    expect(tabs.length).toBeGreaterThan(1);

    const paneles = vista.consultarTodos('[role="tabpanel"]');
    expect(paneles).toHaveLength(1); // solo se pinta el contenido de la activa

    // La pestaña activa es la que apunta al panel que existe. Las demás también
    // declaran `aria-controls`, pero su panel no está en el DOM hasta que se elige:
    // por eso la comparación es con la activa y no con todas.
    const activa = tabs.filter((t) => t.getAttribute("aria-selected") === "true");
    expect(activa).toHaveLength(1);
    expect(activa[0].getAttribute("aria-controls")).toBe(paneles[0].id);
    for (const tab of tabs) expect(tab.getAttribute("aria-controls")).toBeTruthy();

    // `tabindex` rotatorio: una sola parada de Tab dentro del grupo, que es lo que
    // distingue un tablist de cuatro botones sueltos.
    expect(tabs.filter((t) => t.getAttribute("tabindex") === "0")).toHaveLength(1);
    expect(tabs.filter((t) => t.getAttribute("tabindex") === "-1")).toHaveLength(
      tabs.length - 1
    );

    vista.desmontar();
  });

  it("ArrowRight y ArrowLeft cambian de pestaña y mueven el foco", async () => {
    const { act, vista } = montar(pagina.ruta, pagina.props);

    vista.consultarTodos('[role="tab"]')[0].focus();

    await tecla(act, vista, "ArrowRight");
    const despues = vista.consultarTodos('[role="tab"]');
    expect(despues[1].getAttribute("aria-selected")).toBe("true");
    expect(despues[0].getAttribute("aria-selected")).toBe("false");
    expect(document.activeElement).toBe(despues[1]);

    await tecla(act, vista, "ArrowLeft");
    const volvemos = vista.consultarTodos('[role="tab"]');
    expect(volvemos[0].getAttribute("aria-selected")).toBe("true");
    expect(document.activeElement).toBe(volvemos[0]);

    vista.desmontar();
  });

  it("Home y End van al primer y al último panel", async () => {
    const { act, vista } = montar(pagina.ruta, pagina.props);

    await tecla(act, vista, "End");
    const ultimo = vista.consultarTodos('[role="tab"]');
    expect(ultimo[ultimo.length - 1].getAttribute("aria-selected")).toBe("true");
    expect(document.activeElement).toBe(ultimo[ultimo.length - 1]);

    await tecla(act, vista, "Home");
    const primero = vista.consultarTodos('[role="tab"]');
    expect(primero[0].getAttribute("aria-selected")).toBe("true");
    expect(document.activeElement).toBe(primero[0]);

    vista.desmontar();
  });
});