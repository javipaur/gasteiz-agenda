/**
 * @jest-environment jsdom
 */

import React from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";

import { crearMontador, type Vista } from "../helpers-dom";

/**
 * El panel de `/metricas`.
 *
 * El caso que este fichero vigila no es que el panel se pinte bien: es que **la
 * página se sirve vacía**. Un panel con los números dentro del HTML está detrás
 * de un `noindex`, y `noindex` no es control de acceso — quien sepa la dirección
 * los ve. Aquí se comprueba que antes de teclear la clave no sale ningún número,
 * y que la clave viaja como cabecera y no en la URL.
 *
 * El componente se importa **dentro** de `jest.isolateModules`, y el `act` y el
 * `createRoot` salen del mismo registro, por el motivo que está escrito en
 * `helpers-dom.ts`: dos copias de React en el mismo árbol dan "Invalid hook call"
 * y el fallo no señala la causa.
 */

const API_KEY = "clave-de-prueba";

type Bits = {
  Panel: typeof import("@/app/metricas/Panel").default;
  React: typeof React;
  act: typeof act;
  createRoot: typeof createRoot;
  montar: (nodo: unknown) => Vista;
};

/**
 * Monta el panel con un `fetch` falso y devuelve las utilidades para usarlo.
 *
 * Devuelve el `root` del jsdom porque los avisos de `act` de React 19 se lanzan
 * por `console.error`, y los tests de este repo los convierten en rojo cuando
 * importa: un `setState` fuera de `act` es un fallo real, no ruido.
 */
async function montarPanel(): Promise<{
  /** Texto **actual** del árbol. Es una función y no un string capturado. */
  textos: () => string;
  root: HTMLElement;
  fetchMock: jest.Mock;
  setClave: (valor: string) => Promise<void>;
  pulsar: () => Promise<void>;
  esperar: () => Promise<void>;
  restaurar: () => void;
}> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const Panel = require("@/app/metricas/Panel").default as Bits["Panel"];

  let bits!: Bits;
  jest.isolateModules(() => {
    bits = {
      Panel,
      React,
      act: act as never,
      createRoot: createRoot as never,
      montar: crearMontador({ act, createRoot } as never),
    };
  });

  const fetchMock = jest.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => CUERPO,
  });
  const original = global.fetch;
  global.fetch = fetchMock as never;

  const vista = bits.montar(bits.React.createElement(bits.Panel));

  return {
    root: vista.contenedor,
    textos: vista.texto,
    fetchMock,
    async setClave(valor: string) {
      const campo = vista.consultar("input") as HTMLInputElement;
      await bits.act(async () => {
        // El valor del input tiene que cambiar por el setter nativo: React
        // intercepta el `value` y escribir en la propiedad a pelo no dispara el
        // `onChange`. Es el mismo truco que usa `InstallBanner` en sus tests.
        const setter = Object.getOwnPropertyDescriptor(
          window.HTMLInputElement.prototype,
          "value"
        )?.set;
        setter?.call(campo, valor);
        campo.dispatchEvent(new Event("input", { bubbles: true }));
      });
    },
    async pulsar() {
      await bits.act(async () => {
        // `requestSubmit()` y no un `dispatchEvent` suelto: React 19 delega el
        // `submit` en la raíz del contenedor y comprueba que el evento sea
        // creíble, así que un `Event` deSynthetic no llega a `onSubmit`.
        const form = vista.consultar("form") as HTMLFormElement;
        form.requestSubmit();
        await Promise.resolve();
      });
    },
    async esperar() {
      // Un macrotask, no solo microtasks: `consultar` es `async` y su `setDatos`
      // cae en un turno posterior al del `submit`. Vaciar solo la cola de
      // microtasks deja el componente en el estado "Leyendo…" y el fallo dice que
      // el panel no pinta los datos, que no es lo que pasa.
      await bits.act(async () => {
        await new Promise((resolver) => setTimeout(resolver, 0));
      });
    },
    restaurar() {
      global.fetch = original;
      vista.desmontar();
    },
  };
}

/** Lo que devuelve `/api/metric` con la clave buena. */
const CUERPO = {
  porEvento: {
    visita: 120,
    instalada: 9,
    instalacion_aceptada: 14,
    instalacion_descartada: 5,
    instalacion_no_disponible: 3,
  },
  total: 151,
  primera: 1_700_000_000_000,
  ultima: 1_700_600_000_000,
  porRuta: {
    visitasPorRuta: { "/": 100, "/instalar": 20 },
    instalacionPorRuta: { "/instalar": 9 },
    sinRuta: 0,
  },
};

beforeEach(() => {
  process.env.API_KEY = API_KEY;
});

afterEach(() => {
  delete process.env.API_KEY;
});

describe("el panel antes de teclear la clave", () => {
  it("no enseña ningún número", async () => {
    const p = await montarPanel();
    expect(p.textos()).toContain("No se guarda");
    // Ni cifras sueltas de un contador, ni la tabla, ni el embudo.
    expect(p.root.querySelectorAll("table")).toHaveLength(0);
    expect(p.textos()).not.toContain("120");
    expect(p.textos()).not.toContain("Pestañas");
    p.restaurar();
  });

  it("el campo de la clave es de tipo password y no se autocompleta", async () => {
    const p = await montarPanel();
    const campo = p.root.querySelector("input") as HTMLInputElement;
    expect(campo).toBeTruthy();
    // Un `type="text"` pondría la clave en pantalla, y el `autocomplete` la
    // guardaría en el gestor de contraseñas, que es lo que se quiere evitar: la
    // clave existe para una consulta puntual, no para tenerla almacenada.
    expect(campo.type).toBe("password");
    expect(campo.autocomplete).toBe("off");
    p.restaurar();
  });
});

describe("el panel con la clave", () => {
  it("pinta los cinco contadores y el desglose por ruta", async () => {
    const p = await montarPanel();
    await p.setClave(API_KEY);
    await p.pulsar();
    await p.esperar();

    expect(p.root.querySelectorAll("table")).toHaveLength(1);
    expect(p.textos()).toContain("120");
    // La tasa se calcula sobre las visitas, no sobre el total de eventos: si se
    // usara el total, la instalación parecería mucho más infrequentada de lo que
    // es, porque `total` mezcla visitas con los tres resultados del diálogo.
    expect(p.textos()).toContain("7.5");
    expect(p.textos()).toContain("/instalar");
    p.restaurar();
  });

  it("manda la clave como cabecera y no en la URL", async () => {
    const p = await montarPanel();
    await p.setClave(API_KEY);
    await p.pulsar();
    await p.esperar();

    const [url, opciones] = p.fetchMock.mock.calls[0];
    // En la URL la clave se queda en el historial y en el `Referer` de la
    // siguiente página.
    expect(url).toBe("/api/metric");
    expect(String(url)).not.toContain("api_key");
    expect(String(url)).not.toContain(API_KEY);
    expect((opciones as RequestInit).headers).toEqual({ "x-api-key": API_KEY });
    p.restaurar();
  });

  it("distingue una clave mala de un servidor sin API_KEY", async () => {
    // Los dos se pintan distintos porque son opuestos: uno es "prueba otra vez" y
    // el otro es "el despliegue está roto". Con un solo mensaje, un 503 —que solo
    // ocurre si falta la variable— se lee como una contraseña mal tecleada.
    const p = await montarPanel();
    p.fetchMock.mockResolvedValue({ ok: false, status: 401, json: async () => ({}) });
    await p.setClave("mala");
    await p.pulsar();
    await p.esperar();
    expect(p.textos()).toContain("no es correcta");

    p.fetchMock.mockResolvedValue({ ok: false, status: 503, json: async () => ({}) });
    await p.setClave(API_KEY);
    await p.pulsar();
    await p.esperar();
    expect(p.textos()).toContain("API_KEY");
    p.restaurar();
  });

  it("no confunde un fallo de red con una clave mala", async () => {
    const p = await montarPanel();
    p.fetchMock.mockRejectedValue(new Error("offline"));
    await p.setClave(API_KEY);
    await p.pulsar();
    await p.esperar();
    expect(p.textos()).toContain("No se pudo contactar");
    p.restaurar();
  });
});