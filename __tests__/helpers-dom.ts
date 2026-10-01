/**
 * @jest-environment jsdom
 */

/**
 * Monta un componente sin librería de testing.
 *
 * `react-dom/client` y `act` son lo que ya hay en `dependencies`; añadir
 * `@testing-library/react` para lo que hace falta aquí serían ~15 MB más en el
 * árbol de desarrollo por cuatro helpers que son diez líneas. Se cambia el día
 * que los tests de componente sean varios y necesiten consultas por rol o por
 * texto, que es justo para lo que existe esa librería.
 *
 * Por qué recibe React y `createRoot` como argumentos y no los importa. Un
 * test de componente tiene que recargar los módulos entre casos, para que el store
 * por defecto de `lib/useInstallPrompt.ts` no arrastre el evento que ya consumió
 * el caso anterior. Recargar módulos con `jest.isolateModules` mete al componente
 * en un registro nuevo, y si el `act` y el `createRoot` vienen del registro
 * antiguo se acaba con **dos copias de React** en el mismo árbol: React se queja
 * con "Invalid hook call" y el fallo no dice nada de la causa real. Por eso el
 * test pide las tres cosas dentro del mismo `isolateModules` y se las pasa aquí,
 * y por eso no se usa JSX en esos tests: el transform compila a
 * `react/jsx-runtime` del registro de fuera, que es justo la otra copia.
 */
export type ReactBits = {
  act: (fn: () => unknown) => void;
  createElement: (tipo: unknown, props?: unknown) => unknown;
  createRoot: (contenedor: Element) => { render: (nodo: unknown) => void; unmount: () => void };
};

export type Vista = {
  contenedor: HTMLElement;
  texto: () => string;
  consultar: (selector: string) => HTMLElement | null;
  consultarTodos: (selector: string) => HTMLElement[];
  botonPorNombre: (nombre: string) => HTMLElement | undefined;
  asincrono: () => Promise<void>;
  render: (nodo: unknown) => void;
  desmontar: () => void;
};

export function crearMontador({ act, createRoot }: ReactBits) {
  return function montar(nodo: unknown): Vista {
    const contenedor = document.createElement("div");
    document.body.appendChild(contenedor);
    const root = createRoot(contenedor);

    act(() => root.render(nodo));

    return {
      contenedor,
      texto: () => contenedor.textContent ?? "",
      consultar: (selector) =>
        contenedor.querySelector(selector) as HTMLElement | null,
      consultarTodos: (selector) =>
        Array.from(contenedor.querySelectorAll(selector)) as HTMLElement[],
      botonPorNombre: (nombre) =>
        (Array.from(contenedor.querySelectorAll("button")) as HTMLElement[]).find(
          (b) => (b.textContent ?? "").trim().includes(nombre)
        ),
      asincrono: async () => {
        await act(async () => {});
      },
      render: (siguiente) => act(() => root.render(siguiente)),
      desmontar: () => {
        act(() => root.unmount());
        contenedor.remove();
      },
    };
  };
}