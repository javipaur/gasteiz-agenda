/**
 * @jest-environment jsdom
 */

import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";

import { crearMontador, type ReactBits, type Vista } from "../helpers-dom";
import {
  comportamientoDeDesplazamiento,
  duracionDeVuelo,
  prefiereMenosMovimiento,
} from "@/app/components/motion";

/**
 * `prefers-reduced-motion` en el movimiento que manda JavaScript.
 *
 * `app/globals.css` ya neutraliza transiciones y animaciones CSS con un
 * `@media (prefers-reduced-motion: reduce)` global. Eso **no** cubre
 * `scrollBy({ behavior: "smooth" })`, `window.scrollTo({ behavior: "smooth" })`
 * ni `map.flyTo(…, { duration: 0.8 })`: los tres son desplazamiento animado
 * pedido por script, y un usuario con `reduce` se los come enteros — hasta 0,8 s
 * de vuelo sobre un mapa. Es la razón por la que esa preferencia existe.
 *
 * El mock de `matchMedia` es el protagonista del test, no un detalle: sin él el
 * componente lee `undefined` y el caso "no reduce" no distinguiría nada del caso
 * "reduce".
 *
 * Cada caso tiene también su caso espejo con la preferencia **puesta**. Sin él,
 * un arreglo que dejara `behavior: "auto"` siempre daría verde aquí y habríamos
 * roto el carrusel suave sin enterarnos.
 */

function decideMatchMedia(reduce: boolean) {
  return (consulta: string): MediaQueryList =>
    ({
      matches: reduce && consulta.includes("prefers-reduced-motion"),
      media: consulta,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    }) as unknown as MediaQueryList;
}

/**
 * Arranca un componente con una copia fresca de React, del componente y del
 * `createRoot`. Ver la nota de `__tests__/helpers-dom.ts`: si el `act` y el
 * `createRoot` vienen del registro viejo, el componente se renderiza con otra
 * copia de React y React dice "Invalid hook call" sin más. Por eso estos tests
 * tampoco usan JSX.
 *
 * Los providers también se piden dentro del mismo `isolateModules`, y por el
 * mismo motivo: un `FavoritesProvider` del registro viejo leería un contexto
 * distinto del que consume el `FavoriteButton` del registro nuevo.
 */
function conComponente(modulo: string, props: Record<string, unknown>) {
  let bits!: ReactBits;
  let montar!: (nodo: unknown) => Vista;
  let nodo!: unknown;

  jest.isolateModules(() => {
    // `require()` y no `import`, a propósito: `jest.isolateModules` aísla un
    // registro sincrónico, así que un `import` estático se resolvería antes de
    // que empezara el aislamiento.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const React = require("react") as typeof import("react");
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const ReactDOM = require("react-dom/client") as typeof import("react-dom/client");
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const FavoritesProvider = require("@/app/context/FavoritesContext").FavoritesProvider;
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const ToastProvider = require("@/app/context/ToastContext").ToastProvider;
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Componente = require(modulo).default as (p: Record<string, unknown>) => React.ReactNode;

    bits = {
      act: React.act,
      createElement: React.createElement,
      createRoot: ReactDOM.createRoot,
    } as ReactBits;
    montar = crearMontador(bits);
    nodo = React.createElement(
      FavoritesProvider,
      null,
      React.createElement(ToastProvider, null, React.createElement(Componente, props))
    );
  });

  return { bits, montar, nodo };
}

function conPreferencia(reduce: boolean) {
  const anterior = window.matchMedia;
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    writable: true,
    value: decideMatchMedia(reduce),
  });
  return () => {
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      writable: true,
      value: anterior,
    });
  };
}

function definir(objeto: object, clave: PropertyKey, valor: unknown) {
  Object.defineProperty(objeto, clave, { configurable: true, writable: true, value: valor });
}

/**
 * jsdom no implementa `IntersectionObserver`, y `InViewWrapper` (de
 * `lib/shared.tsx`) lo usa para animar la entrada de cada tarjeta. Se sustituye
 * por un testigo que no dispara nada: aquí no se prueba la animación de entrada,
 * y un `observe` que hiciese `unobserve` al montar metería `EventCard` fuera del
 * árbol y el riel se quedaría sin flechas.
 */
class ObservadorMudo {
  // Los parámetros se declaran y se vacían a propósito: `lib/shared.tsx` construye
  // el observador con `new IntersectionObserver(cb, opts)` y quitar los parámetros
  // rompería esa llamada. No se guardan porque este testigo no dispara callbacks.
  constructor(_callback: IntersectionObserverCallback, _opciones?: IntersectionObserverInit) {
    void _callback;
    void _opciones;
  }
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
  takeRecords(): IntersectionObserverEntry[] {
    return [];
  }
}

describe("movimiento dirigido por JS y prefers-reduced-motion", () => {
  describe("ScrollToTop", () => {
    function montar(reduce: boolean) {
      const restaurar = conPreferencia(reduce);

      // jsdom no implementa `scrollTo`: avisa por consola en vez de registrar la
      // llamada, que es justo lo que hay que comprobar.
      const scrollTo = jest.fn();
      definir(window, "scrollTo", scrollTo);
      // El botón sólo existe con `window.scrollY > 600`, y en jsdom `scrollY` es
      // 0. Va **antes** de montar: el `useEffect` lee el valor al suscribirse.
      definir(window, "scrollY", 1200);

      const { bits, montar: montarVista, nodo } = conComponente("@/app/components/ScrollToTop", {});
      const vista = montarVista(nodo);
      // `ScrollToTop` arranca con `visible = false` y sólo lo cambia en el
      // listener de `scroll`, así que hace falta el evento: con `scrollY` alto
      // pero sin evento, el botón no se ha pintado todavía.
      bits.act(() => window.dispatchEvent(new Event("scroll")));

      return { vista, scrollTo, restaurar, act: bits.act };
    }

    afterEach(() => {
      Reflect.deleteProperty(window, "scrollTo");
      Reflect.deleteProperty(window, "scrollY");
    });

    it("desplaza sin animación cuando el usuario pide menos movimiento", () => {
      const { vista, scrollTo, restaurar, act } = montar(true);
      try {
        const boton = vista.consultar('button[aria-label="Volver arriba"]');
        expect(boton).toBeDefined();
        act(() => boton?.click());

        expect(scrollTo).toHaveBeenCalledTimes(1);
        const opciones = scrollTo.mock.calls[0][0] as { top: number; behavior: string };
        expect({ top: opciones.top, behavior: opciones.behavior }).toEqual({ top: 0, behavior: "auto" });
      } finally {
        vista.desmontar();
        restaurar();
      }
    });

    it("mantiene la animación suave cuando no hay preferencia", () => {
      const { vista, scrollTo, restaurar, act } = montar(false);
      try {
        const boton = vista.consultar('button[aria-label="Volver arriba"]');
        act(() => boton?.click());

        expect(scrollTo).toHaveBeenCalledTimes(1);
        const opciones = scrollTo.mock.calls[0][0] as { top: number; behavior: string };
        expect({ top: opciones.top, behavior: opciones.behavior }).toEqual({ top: 0, behavior: "smooth" });
      } finally {
        vista.desmontar();
        restaurar();
      }
    });
  });

  describe("CategoryCarousel", () => {
    const EVENTOS = [
      {
        id: "ev-1",
        slug: "ev-1",
        title: "Concierto de prueba",
        date: "2030-01-01T20:00:00.000Z",
        link: "https://ejemplo.test/ev-1",
      },
      {
        id: "ev-2",
        slug: "ev-2",
        title: "Otro concierto",
        date: "2030-01-02T20:00:00.000Z",
        link: "https://ejemplo.test/ev-2",
      },
      /**
       * El tercero no es decorativo.
       *
       * `CategoryCarousel` no se pinta por debajo de `MINIMO_EN_UN_CARRUSEL`, que
       * son tres, y con dos no llegaba a existir ninguna flecha que pulsar. Este
       * caso mide el **comportamiento del scroll** con la preferencia de movimiento
       * reducida puesta, así que lo que necesita es un carrusel de verdad; con dos
       * tarjetas ni siquiera habría flechas en el caso real.
       */
      {
        id: "ev-3",
        slug: "ev-3",
        title: "Un tercer concierto",
        date: "2030-01-03T20:00:00.000Z",
        link: "https://ejemplo.test/ev-3",
      },
    ];

    function montar(reduce: boolean) {
      const restaurar = conPreferencia(reduce);
      definir(window, "IntersectionObserver", ObservadorMudo);
      definir(globalThis, "IntersectionObserver", ObservadorMudo);

      // jsdom no implementa `Element.scrollBy`. Se define en el prototipo para
      // que la llamada del componente quede registrada con sus argumentos.
      const scrollBy = jest.fn();
      definir(Element.prototype, "scrollBy", scrollBy);

      const { bits, montar: montarVista, nodo } = conComponente("@/app/components/CategoryCarousel", {
        title: "Conciertos",
        events: EVENTOS,
      });
      const vista = montarVista(nodo);

      return { vista, scrollBy, restaurar, act: bits.act };
    }

    afterEach(() => {
      Reflect.deleteProperty(Element.prototype, "scrollBy");
    });

    it("pasa el scroll del riel sin animación con la preferencia puesta", () => {
      const { vista, scrollBy, restaurar, act } = montar(true);
      try {
        const siguiente = vista.consultar('button[aria-label="Siguiente"]');
        expect(siguiente).toBeDefined();
        act(() => siguiente?.click());

        expect(scrollBy).toHaveBeenCalledTimes(1);
        const opciones = scrollBy.mock.calls[0][0] as { behavior: string };
        expect({ behavior: opciones.behavior }).toEqual({ behavior: "auto" });
      } finally {
        vista.desmontar();
        restaurar();
      }
    });

    it("mantiene el scroll suave del riel sin preferencia", () => {
      const { vista, scrollBy, restaurar, act } = montar(false);
      try {
        const siguiente = vista.consultar('button[aria-label="Siguiente"]');
        act(() => siguiente?.click());

        expect(scrollBy).toHaveBeenCalledTimes(1);
        const opciones = scrollBy.mock.calls[0][0] as { behavior: string };
        expect({ behavior: opciones.behavior }).toEqual({ behavior: "smooth" });
      } finally {
        vista.desmontar();
        restaurar();
      }
    });
  });
});

describe("el helper de movimiento", () => {
  it.each([
    { reduce: true, esperado: true },
    { reduce: false, esperado: false },
  ])("con reduce=$reduce devuelve $esperado", ({ reduce, esperado }) => {
    const restaurar = conPreferencia(reduce);
    try {
      expect(prefiereMenosMovimiento()).toBe(esperado);
    } finally {
      restaurar();
    }
  });

  it("devuelve false si el navegador no tiene matchMedia", () => {
    // Un cliente viejo, o un entorno de pruebas sin la API. "No lo sé" tiene que
    // llevar al mismo camino que "no me lo han pedido": si devolviera `true`, el
    // componente de servidor y el del cliente se discreparían y Next avisaría de
    // un desajuste de hidratación que no tiene nada que ver con la preferencia.
    const anterior = window.matchMedia;
    Reflect.deleteProperty(window, "matchMedia");
    try {
      expect(prefiereMenosMovimiento()).toBe(false);
      expect(comportamientoDeDesplazamiento()).toBe("smooth");
    } finally {
      definir(window, "matchMedia", anterior);
    }
  });

  it("no falla si matchMedia lanza", () => {
    // Safari viejo y algunos WebView lanzan en consultas no soportadas. Un throw
    // aquí se comería el clic entero del "volver arriba".
    const restaurar = conPreferencia(false);
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      writable: true,
      value: () => {
        throw new Error("consulta no soportada");
      },
    });
    try {
      expect(prefiereMenosMovimiento()).toBe(false);
      expect(duracionDeVuelo(0.8)).toBe(0.8);
    } finally {
      restaurar();
    }
  });

  it("el vuelo del mapa es 0 con la preferencia y el de siempre sin ella", () => {
    // `0` y no `undefined`: en Leaflet, `undefined` deja la curva por defecto,
    // que es justo lo que se quiere quitar.
    const con = conPreferencia(true);
    expect(duracionDeVuelo(0.8)).toBe(0);
    con();

    const sin = conPreferencia(false);
    try {
      expect(duracionDeVuelo(0.8)).toBe(0.8);
    } finally {
      sin();
    }
  });

  it.each(["FarmaciasMap", "TopEventsSection"])(
    "%s delega el movimiento en el helper",
    (componente) => {
      // Estos dos no se montan aquí: Leaflet necesita canvas y `TopEventsSection`
      // arrastra `next/image`, y para lo que se quiere comprobar — que el `behavior`
      // y el `duration` no están escritos a mano — basta mirar la llamada. Montar
      // un mapa en jsdom para comprobar una constante sería desproporcionado.
      const fuente = readFileSync(
        join(resolve(__dirname, "..", ".."), "app", "components", `${componente}.tsx`),
        "utf8"
      );
      expect({
        usaHelper: /comportamientoDeDesplazamiento\(\)|duracionDeVuelo\(/.test(fuente),
        escribeSmoothOManos: /behavior:\s*["']smooth["']|duration:\s*0\.8/.test(fuente),
      }).toEqual({ usaHelper: true, escribeSmoothOManos: false });
    }
  );
});
