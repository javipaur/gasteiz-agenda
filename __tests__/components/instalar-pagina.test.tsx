/**
 * @jest-environment jsdom
 */

import { crearMontador, type ReactBits, type Vista } from "../helpers-dom";

type Outcome = "accepted" | "dismissed";

const IPHONE =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";
const ANDROID_CHROME =
  "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36";
const FIREFOX_ESCRITORIO =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0";

/**
 * El navegador que este island lee, falseado por caso.
 *
 * jsdom implementa `matchMedia` pero devuelve siempre `matches: false`, así que
 * "ya instalada" no se puede provocar sin sustituirlo. Y no hay forma de
 * cambiar la user agent de jsdom salvo redefiniéndola en la instancia.
 *
 * Que este fichero **no** falsa `beforeinstallprompt` ni `display-mode` y
 * tenga que montar sus propios dobles es el argumento de por qué el árbol que
 * decide la rama está en `lib/install.ts`: aquí se prueba el dibujo, y el árbol
 * se prueba entero en `__tests__/install-platform.test.ts`, en node y sin DOM.
 */
let userAgentActual = ANDROID_CHROME;
let maxTouchPointsActual = 5;
let displayModeStandalone = false;

function matchMediaFalso(consulta: string) {
  return {
    matches: consulta === "(display-mode: standalone)" && displayModeStandalone,
    media: consulta,
    addEventListener: () => {},
    removeEventListener: () => {},
  };
}

/**
 * `lib/useInstallPrompt.ts` construye sus dos stores por defecto al importarse
 * —uno engancha el listener a `window` y otro consulta `matchMedia`—, así que un
 * solo store por fichero haría que cada caso heredara el estado del anterior.
 * De ahí que cada uno recargue los módulos.
 *
 * De ahí también que este test no use JSX: el transform compila a
 * `react/jsx-runtime` del registro de fuera del `isolateModules`, que es otra
 * copia de React de la que usa el componente. Ver la nota de `helpers-dom.ts`.
 */
async function guia({
  userAgent = ANDROID_CHROME,
  maxTouchPoints = 5,
  instalado = false,
}: {
  userAgent?: string;
  maxTouchPoints?: number;
  instalado?: boolean;
} = {}) {
  userAgentActual = userAgent;
  maxTouchPointsActual = maxTouchPoints;
  displayModeStandalone = instalado;

  let bits!: ReactBits;
  let InstallGuide!: (props: Record<string, never>) => unknown;
  let montar!: (nodo: unknown) => Vista;

  jest.isolateModules(() => {
    // `require()` y no `import`, y a propósito. Ver el comentario de arriba y el
    // de `install-banner.test.tsx`, que es el otro sitio del repo que lo hace.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const React = require("react") as typeof import("react");
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const ReactDOM = require("react-dom/client") as typeof import("react-dom/client");
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const componente = require("@/app/instalar/InstallGuide") as {
      default: (props: Record<string, never>) => unknown;
    };
    bits = {
      act: React.act,
      createElement: React.createElement,
      createRoot: ReactDOM.createRoot,
    } as ReactBits;
    InstallGuide = componente.default;
    montar = crearMontador(bits);
  });

  const prompted: number[] = [];

  const disparar = (outcome: Outcome) => {
    const evento = new Event("beforeinstallprompt") as Event & {
      prompt: () => Promise<void>;
      userChoice: Promise<{ outcome: Outcome }>;
    };
    evento.prompt = () => {
      prompted.push(1);
      return Promise.resolve();
    };
    evento.userChoice = Promise.resolve({ outcome });
    bits.act(() => window.dispatchEvent(evento));
  };

  const vista = montar(bits.createElement(InstallGuide, {}));
  return {
    vista,
    disparar,
    prompted,
    act: bits.act,
    play: () => vista.consultar('a[href*="play.google.com"]'),
  };
}

beforeAll(() => {
  Object.defineProperty(window, "matchMedia", {
    value: matchMediaFalso,
    writable: true,
    configurable: true,
  });
  // Getter y no valor fijo: `useSyncExternalStore` puede releer entre casos, y
  // un `value` congelado haría que un cambio posterior no se notase.
  Object.defineProperty(window.navigator, "userAgent", {
    get: () => userAgentActual,
    configurable: true,
  });
  // jsdom no implementa `maxTouchPoints` en absoluto: sin esto el componente
  // leería `undefined` y el iPad en Modo Escritorio no se podría provocar.
  Object.defineProperty(window.navigator, "maxTouchPoints", {
    get: () => maxTouchPointsActual,
    configurable: true,
  });
});

describe("InstallGuide", () => {
  it("en iPhone enseña los pasos en vez de un botón que no puede pulsar", async () => {
    // El motivo de existir de esta página. En Safari no hay
    // `beforeinstallprompt`, así que una web que solo escuche el evento no
    // pinta nada en el móvil que más usa el público de esta agenda.
    const { vista } = await guia({ userAgent: IPHONE });
    expect(vista.texto()).toContain("Añádela a tu pantalla de inicio");
    expect(vista.texto()).toContain("Compartir");
    expect(vista.texto()).toContain("Añadir a pantalla de inicio");
    vista.desmontar();
  });

  it("en iOS no ofrece ni el botón ni la app de Google Play", async () => {
    const { vista, play } = await guia({ userAgent: IPHONE });
    expect(vista.botonPorNombre("Instalar")).toBeUndefined();
    // Play Store en un iPhone es un sitio que no instala nada.
    expect(play()).toBeNull();
    vista.desmontar();
  });

  it("en Chrome con evento da un botón que pide el prompt", async () => {
    const { vista, disparar, prompted, act } = await guia();

    // Antes de que llegue el evento no hay botón, y es lo correcto: el método
    // depende de que el navegador haya dicho que se puede instalar.
    expect(vista.botonPorNombre("Instalar")).toBeUndefined();

    disparar("accepted");
    await vista.asincrono();
    expect(vista.botonPorNombre("Instalar")).toBeDefined();

    act(() => vista.botonPorNombre("Instalar")?.click());
    await vista.asincrono();

    expect(prompted).toHaveLength(1);
    vista.desmontar();
  });

  it("en Android ofrece las dos vías y la PWA manda", async () => {
    const { vista, disparar, play } = await guia();
    disparar("accepted");
    await vista.asincrono();

    expect(vista.botonPorNombre("Instalar")).toBeDefined();
    expect(play()).not.toBeNull();
    vista.desmontar();
  });

  it("a quien ya la tiene instalada no le ofrece nada", async () => {
    const { vista, play } = await guia({ instalado: true });
    expect(vista.texto()).toContain("Ya la tienes");
    expect(vista.botonPorNombre("Instalar")).toBeUndefined();
    expect(play()).toBeNull();
    vista.desmontar();
  });

  it("en Firefox explica lo del menú en vez de prometer un botón", async () => {
    const { vista, play } = await guia({
      userAgent: FIREFOX_ESCRITORIO,
      maxTouchPoints: 0,
    });
    expect(vista.texto()).toContain("acceso directo");
    expect(vista.botonPorNombre("Instalar")).toBeUndefined();
    expect(play()).not.toBeNull();
    vista.desmontar();
  });

  it("aceptar deja la tarjeta en 'ya la tienes', no en la rama degradada", async () => {
    // Este es el fallo que la tarjeta tiene que evitar. `prompt()` consume el
    // evento al pulsarlo: sin sostener el estado del intento, el momento
    // siguiente la tarjeta pasa a "este navegador no instala esto" con el
    // diálogo del navegador todavía abierto delante.
    const { vista, disparar, act } = await guia();
    disparar("accepted");
    await vista.asincrono();

    act(() => vista.botonPorNombre("Instalar")?.click());
    await vista.asincrono();

    expect(vista.texto()).toContain("Ya la tienes");
    expect(vista.texto()).not.toContain("acceso directo");
    vista.desmontar();
  });

  it("descartar el diálogo lo dice, y no inventa un fallo del navegador", async () => {
    const { vista, disparar, prompted, act } = await guia();
    disparar("dismissed");
    await vista.asincrono();

    act(() => vista.botonPorNombre("Instalar")?.click());
    await vista.asincrono();

    expect(prompted).toHaveLength(1);
    expect(vista.texto()).toContain("Has cancelado");
    expect(vista.texto()).not.toContain("Este navegador no instala");
    vista.desmontar();
  });
});