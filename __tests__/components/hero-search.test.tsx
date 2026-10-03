/**
 * @jest-environment jsdom
 */

/**
 * `HeroSearch` es la mitad de un widget: el atajo, el panel y el comportamiento de
 * resultados ya estaban en `Header`, y aquí faltaban dos cosas.
 *
 * - **Escape.** El input no lo tenía, así que el panel de resultados solo se
 *   cerraba con clic fuera o enviando el formulario. `Header.tsx` sí lo hace.
 * - **Anuncio.** El panel no tenía `aria-expanded`/`aria-controls` en el input ni
 *   `role="listbox"` y `aria-live` en el panel: los resultados llegan por `fetch` y
 *   sin una región viva no se entera nadie hasta que navega dentro.
 */
import { escenario } from "../helpers-a11y";

type Modulo = { default: () => unknown };

const RESULTADO = {
  slug: "concierto-de-prueba",
  title: "Concierto de prueba",
  date: "2099-03-04",
  location: "Sala Gimeno",
};

/** Escribir en un input controlado por React necesita el setter nativo. */
function escribir(act: (fn: () => unknown) => void, input: HTMLInputElement, texto: string) {
  const setter = Object.getOwnPropertyDescriptor(
    window.HTMLInputElement.prototype,
    "value"
  )!.set!;
  act(() => {
    setter.call(input, texto);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

async function buscar(esc: ReturnType<typeof escenario<Modulo>>, texto: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (globalThis as any).fetch = jest.fn(async () => ({
    ok: true,
    json: async () => ({ results: [RESULTADO] }),
  }));

  const vista = esc.montar(esc.conProviders(esc.crear(esc.modulo.default, {})));
  const input = vista.consultar("input[type='search']") as HTMLInputElement;
  escribir(esc.act, input, texto);
  // El effect tiene un `setTimeout` de 180 ms antes de pedir los resultados.
  await esc.act(async () => {
    await new Promise((r) => setTimeout(r, 260));
  });
  return { vista, input };
}

describe("HeroSearch", () => {
  it("Escape cierra el panel de resultados", async () => {
    const esc = escenario<Modulo>("@/app/components/HeroSearch");
    const { vista, input } = await buscar(esc, "concierto");

    expect(vista.consultar('[role="listbox"]')).not.toBeNull();

    esc.act(() => {
      input.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    });

    expect(vista.consultar('[role="listbox"]')).toBeNull();
    expect(input.getAttribute("aria-expanded")).toBe("false");

    vista.desmontar();
  });

  it("el input declara qué controla y el panel se anuncia", async () => {
    const esc = escenario<Modulo>("@/app/components/HeroSearch");
    const { vista, input } = await buscar(esc, "concierto");

    // El input dice qué lista gobierna y si está abierta...
    const listboxId = input.getAttribute("aria-controls");
    expect(input.getAttribute("role")).toBe("combobox");
    expect(input.getAttribute("aria-expanded")).toBe("true");
    expect(listboxId).toBeTruthy();

    // ...y la lista existe con ese nombre y con sus opciones.
    const listbox = vista.consultar(`#${listboxId}`)!;
    expect(listbox.getAttribute("role")).toBe("listbox");
    expect(listbox.getAttribute("aria-label")).toBeTruthy();
    expect(listbox.closest("[aria-live]")).not.toBeNull();
    expect(vista.consultarTodos(`#${listboxId} [role="option"]`)).toHaveLength(1);

    vista.desmontar();
  });
});