/**
 * @jest-environment jsdom
 */

import { crearMontador, type ReactBits, type Vista } from "../helpers-dom";

type Outcome = "accepted" | "dismissed";

/**
 * `lib/useInstallPrompt.ts` construye su store por defecto al importarse y ahí
 * engancha el listener a `window`. Un solo store por fichero significaría que el
 * caso siguiente hereda el evento que el anterior consumió, así que cada uno
 * recarga los módulos.
 *
 * De ahí que este test no use JSX: el transform compila a `react/jsx-runtime` del
 * registro de fuera del `isolateModules`, que es otra copia de React de la que
 * usa el componente. Ver la nota de `__tests__/helpers-dom.ts`.
 */
async function bannerLimpio() {
  let bits!: ReactBits;
  let InstallBanner!: (props: Record<string, never>) => unknown;
  let montar!: (nodo: unknown) => Vista;

  jest.isolateModules(() => {
    // `require()` y no `import`, y a propósito. `isolateModules` aísla un
    // registro de módulos sincrónico: con `import` estático el componente se
    // resolvería antes de que el isolate empezara, y con `await import()` dentro
    // del callback se pierde el aislamiento. Es el único caso del repo donde esto
    // se hace, y por eso lleva la excepción escrita en vez de desactivar la regla
    // para `__tests__` entero, que es donde la volvería a necesitar menos.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const React = require("react") as typeof import("react");
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const ReactDOM = require("react-dom/client") as typeof import("react-dom/client");
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const componente = require("@/app/components/InstallBanner") as {
      default: (props: Record<string, never>) => unknown;
    };
    bits = {
      act: React.act,
      createElement: React.createElement,
      createRoot: ReactDOM.createRoot,
    } as ReactBits;
    InstallBanner = componente.default;
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
    // El evento lo dispara el navegador, no React: sin esta pasada de `act` el
    // `useSyncExternalStore` no repinta y el aviso se pierde en el log.
    bits.act(() => window.dispatchEvent(evento));
  };

  const vista = montar(bits.createElement(InstallBanner, {}));
  return { vista, disparar, prompted, bits, act: bits.act, montar };
}

describe("InstallBanner", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("no pinta nada hasta que el navegador dice que se puede instalar", async () => {
    const { vista } = await bannerLimpio();
    expect(vista.texto()).toBe("");
    vista.desmontar();
  });

  it("aparece cuando llega el evento de instalación", async () => {
    const { vista, disparar } = await bannerLimpio();

    disparar("accepted");
    await vista.asincrono();

    expect(vista.texto()).toContain("Instala Gasteiz Click");
    expect(vista.botonPorNombre("Instalar")).toBeDefined();
    vista.desmontar();
  });

  it("cerrarlo lo esconde y deja constancia para no volver a salir", async () => {
    const { vista, disparar, act } = await bannerLimpio();
    disparar("accepted");
    await vista.asincrono();

    const cerrar = vista.consultar('button[aria-label="Cerrar"]');
    expect(cerrar).toBeDefined();
    act(() => cerrar?.click());
    await vista.asincrono();

    expect(vista.texto()).toBe("");
    // Sin esto el banner volvería en cada carga de la home.
    expect(Number(localStorage.getItem("gasteiz-install-dismissed"))).toBeGreaterThan(0);
    vista.desmontar();
  });

  it("no aparece si se descartó hace menos de 72 horas", async () => {
    // Lo que no se puede probar contra el store solo: es `localStorage`, leído en
    // el inicializador de `useState`, lo que lo impide pintar.
    localStorage.setItem(
      "gasteiz-install-dismissed",
      String(Date.now() - 60 * 60 * 1000)
    );
    const { vista, disparar } = await bannerLimpio();

    disparar("accepted");
    await vista.asincrono();

    expect(vista.texto()).toBe("");
    vista.desmontar();
  });

  it("vuelve a aparecer si el descarte fue de hace más de 72 horas", async () => {
    localStorage.setItem(
      "gasteiz-install-dismissed",
      String(Date.now() - 73 * 60 * 60 * 1000)
    );
    const { vista, disparar } = await bannerLimpio();

    disparar("accepted");
    await vista.asincrono();

    expect(vista.texto()).toContain("Instala Gasteiz Click");
    vista.desmontar();
  });

  it("instalar pide el prompt y hace desaparecer el banner", async () => {
    const { vista, disparar, prompted, act } = await bannerLimpio();
    disparar("accepted");
    await vista.asincrono();

    const instalar = vista.botonPorNombre("Instalar");
    act(() => instalar?.click());
    await vista.asincrono();

    expect(prompted).toHaveLength(1);
    expect(vista.texto()).toBe("");
    vista.desmontar();
  });

  it("descartar el diálogo del navegador también cierra el banner", async () => {
    // El store antes solo anulaba el evento si el usuario aceptaba. Con un
    // descarte se quedaba guardado y el banner seguía ahí pidiendo instalar
    // sobre un evento ya consumido, que el navegador rechaza. Aquí se ve: el
    // banner tiene que irse igual, y el prompt solo puede haberse pedido una vez.
    const { vista, disparar, prompted, act } = await bannerLimpio();
    disparar("dismissed");
    await vista.asincrono();

    const instalar = vista.botonPorNombre("Instalar");
    act(() => instalar?.click());
    await vista.asincrono();

    expect(prompted).toHaveLength(1);
    expect(vista.texto()).toBe("");
    vista.desmontar();
  });
});