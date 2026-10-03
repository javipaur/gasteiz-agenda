/**
 * Ayudas para los tests de accesibilidad de componentes.
 *
 * No se amplía `helpers-dom.ts` a propósito: ese fichero documenta el patrón de
 * `jest.isolateModules` + `require` y sus comentarios hablan de `InstallBanner`.
 * Los tests de accesibilidad necesitan además cosas propias —envolver en los
 * providers de favoritos y de avisos, y una lista corta de selectores sobre el
 * árbol renderizado—, y mezclarlas ahí dejaría un fichero que documenta dos
 * familias de tests a la vez.
 *
 * El patrón de una sola copia de React sigue siendo el de `helpers-dom.ts`: React,
 * `createRoot` y el componente se piden **dentro** del mismo `isolateModules`, y
 * los tests no usan JSX porque el transform resolvería `react/jsx-runtime` del
 * registro de fuera, que es justo la otra copia.
 */
import { crearMontador, type ReactBits, type Vista } from "./helpers-dom";

/**
 * Los tres módulos de Next que se necesitan para renderizar un componente cliente
 * en jsdom, y por qué se sustituyen en vez de usar los de verdad.
 *
 * - `next/link` y `next/image` no rompen en jsdom, pero `next/image` calcula sus
 *   `srcset` con un `<picture>` y un `onLoadingComplete` que en el test solo
 *   añade ruido. Se reducen a `<a>` y `<img>`: lo que se asserta es el árbol de
 *   accesibilidad, y un `Link` real no aporta nada a eso.
 * - `next/navigation` sí rompe: `useSearchParams` lee de un contexto de router que
 *   en App Router no existe fuera del servidor, y `useRouter` lanza sin
 *   `AppRouterContext`.
 *
 * Los factories usan `require("react")` y no un import: se ejecutan **dentro** del
 * `isolateModules` que carga el componente, así que esa es la copia de React que el
 * componente va a usar. Un `import` de arriba capturaría la de fuera.
 */
jest.mock("next/link", () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const ReactMod = require("react") as typeof import("react");
  const Link = (props: Record<string, unknown>) =>
    ReactMod.createElement("a", { ...props, "data-next-link": "true" });
  Link.displayName = "Link";
  return { __esModule: true, default: Link };
});

jest.mock("next/image", () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const ReactMod = require("react") as typeof import("react");
  const Image = (props: Record<string, unknown>) => {
    // Estas tres props son de `next/image` y no existen en `<img>`: si se
      // quedaron en el DOM el `alt` que se asserta no sería el del `<img>` real.
    const { fill, priority, sizes, ...resto } = props;
    void fill;
    void priority;
    void sizes;
    return ReactMod.createElement("img", resto);
  };
  Image.displayName = "Image";
  return { __esModule: true, default: Image };
});

jest.mock("next/navigation", () => {
  const params = new URLSearchParams();
  const router = {
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
    refresh: jest.fn(),
    forward: jest.fn(),
    prefetch: jest.fn(),
  };
  return {
    __esModule: true,
    useRouter: () => router,
    usePathname: () => "/",
    useSearchParams: () => params,
    useParams: () => ({}),
    notFound: () => {
      throw new Error("NEXT_NOT_FOUND");
    },
    redirect: () => {
      throw new Error("NEXT_REDIRECT");
    },
  };
});

/**
 * `IntersectionObserver` no está en jsdom, y media docena de componentes lo usan
 * para el `InViewWrapper` y para la carga diferida de `/farmacias`.
 *
 * El stub **dispara el callback de inmediato** con `isIntersecting: true`, y no
 * porque el árbol que se asserta necesite que el contenido esté visible —los
 * elementos se pintan igual con `opacity: 0`— sino por `/farmacias`: su contenido
 * solo se pide cuando el contenedor entra en pantalla, así que un observer mudo
 * dejaría siempre la lista de farmacias vacía y el test no miraría nada.
 */
if (typeof window !== "undefined" && !("IntersectionObserver" in window)) {
  type StubCallback = (
    entradas: Array<{ isIntersecting: boolean; target: unknown }>,
    observer: unknown
  ) => void;

  class IntersectionObserverStub {
    constructor(private callback: StubCallback) {}
    observe(target: unknown): void {
      this.callback([{ isIntersecting: true, target }], this);
    }
    unobserve(): void {}
    disconnect(): void {}
    takeRecords(): [] {
      return [];
    }
  }
  (
    window as unknown as { IntersectionObserver: unknown }
  ).IntersectionObserver = IntersectionObserverStub;
  (
    globalThis as unknown as { IntersectionObserver: unknown }
  ).IntersectionObserver = IntersectionObserverStub;
}

/** `Header` lee `matchMedia` en un `useSyncExternalStore` para el modo standalone. */
if (typeof window !== "undefined" && !window.matchMedia) {
  window.matchMedia = ((consulta: string) => ({
    matches: false,
    media: consulta,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
}

export type Escenario<T> = {
  act: ReactBits["act"];
  crear: ReactBits["createElement"];
  montar: (nodo: unknown) => Vista;
  /** Nodo envuelto en `FavoritesProvider` + `ToastProvider`, como en el layout. */
  conProviders: (hijo: unknown) => unknown;
  modulo: T;
};

/**
 * Carga un módulo y deja las tres cosas de React en el mismo registro.
 *
 * Los providers se piden aquí dentro y no en el test porque también tienen que
 * ser la misma copia: `FavoriteButton` llama a `useFavorites()`, que lanza si no
 * hay provider, así que cualquier componente con la tarjeta necesita los dos.
 */
export function escenario<T>(ruta: string): Escenario<T> {
  let bits!: ReactBits;
  let modulo!: T;
  let montar!: (nodo: unknown) => Vista;
  let conProviders!: (hijo: unknown) => unknown;

  jest.isolateModules(() => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const React = require("react") as typeof import("react");
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const ReactDOM = require("react-dom/client") as typeof import("react-dom/client");
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    modulo = require(ruta) as T;
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const favoritos = require("@/app/context/FavoritesContext") as typeof import("@/app/context/FavoritesContext");
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const avisos = require("@/app/context/ToastContext") as typeof import("@/app/context/ToastContext");

    bits = {
      act: React.act,
      createElement: React.createElement,
      // El `createRoot` de verdad devuelve un `Root` cuyo `render` toma un
      // `ReactNode`, y `helpers-dom` declara que toma `unknown`. El cast es
      // seguro porque lo único que se le pasa son nodos ya creados por React.
      createRoot: ReactDOM.createRoot as unknown as ReactBits["createRoot"],
    };
    montar = crearMontador(bits);
    // `helpers-dom` declara `createElement(tipo, props)`, sin hijo suelto, así que
    // los hijos van dentro de `props`. Es lo mismo que hace React por debajo.
    conProviders = (hijo) =>
      bits.createElement(favoritos.FavoritesProvider, {
        children: bits.createElement(avisos.ToastProvider, { children: hijo }),
      });
  });

  return { act: bits.act, crear: bits.createElement, montar, conProviders, modulo };
}

/**
 * Nombres de los elementos interactivos que hay **dentro** de otro interactivo.
 *
 * Es la forma de askuntar el defecto sin depender del marcado concreto: no importa
 * si el botón de favorito se movió a un `<div>` hermano o a un overlay, lo que se
 * mide es que dentro de un `<a>` o de un `<button>` no queda ningún `<a>` ni ningún
 * `<button>`. El contenido de `a`/`button` no puede ser interactivo, así que un
 * control dentro de otro no es un detalle de estilo: es HTML inválido.
 */
export function interactivoDentroDeInteractivo(vista: Vista): string[] {
  const fallos: string[] = [];
  for (const contenedor of vista.consultarTodos("a, button")) {
    if (!contenedor.querySelector("a, button")) continue;
    const nombre =
      contenedor.getAttribute("aria-label") ??
      (contenedor.textContent ?? "").replace(/\s+/g, " ").trim().slice(0, 40);
    fallos.push(`<${contenedor.tagName.toLowerCase()}> «${nombre}»`);
  }
  return fallos;
}

/** `true` si `selector` existe dentro de `padre`. */
export function contiene(padre: Element, selector: string): boolean {
  return padre.querySelector(selector) !== null;
}