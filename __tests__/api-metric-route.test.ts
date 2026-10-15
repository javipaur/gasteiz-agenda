import { dbDePrueba, limpiarDbsDePrueba } from "./helpers-metricas";

/**
 * La ruta de `/api/metric`.
 *
 * Es la primera ruta del repo cuyo `POST` es **público por necesidad** —la llama
 * un componente cliente que no tiene `API_KEY`— y a la vez escribe en disco. Las
 * dos mitades de eso se prueban aquí: que un nombre fuera de la lista no escriba,
 * y que el `GET` siga exigiendo la clave que el middleware ya no puede exigir.
 */

type Route = typeof import("@/app/api/metric/route");

let route: Route;
let store: typeof import("@/lib/metricas-store");
const API_KEY = "clave-de-prueba";

function post(cuerpo: unknown, cabeceras: Record<string, string> = {}) {
  return route.POST(
    new Request("http://localhost/api/metric", {
      method: "POST",
      headers: { "content-type": "application/json", ...cabeceras },
      body: typeof cuerpo === "string" ? cuerpo : JSON.stringify(cuerpo),
    })
  );
}

function get(cabeceras: Record<string, string> = {}) {
  return route.GET(
    new Request("http://localhost/api/metric", { headers: cabeceras })
  );
}

beforeEach(async () => {
  dbDePrueba();
  jest.resetModules();
  process.env.API_KEY = API_KEY;
  route = await import("@/app/api/metric/route");
  store = await import("@/lib/metricas-store");
});

afterAll(() => {
  limpiarDbsDePrueba();
  delete process.env.API_KEY;
});

describe("POST", () => {
  it("anota un evento válido y responde ok", async () => {
    const res = await post({ evento: "visita", ts: Date.now() });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(store.resumen().porEvento.visita).toBe(1);
  });

  it("acepta los cinco eventos", async () => {
    for (const evento of [
      "visita",
      "instalada",
      "instalacion_aceptada",
      "instalacion_descartada",
      "instalacion_no_disponible",
    ] as const) {
      const res = await post({ evento, ts: Date.now() });
      expect(res.status).toBe(200);
    }
    expect(store.resumen().total).toBe(5);
  });

  it("rechaza un nombre fuera de la lista y no escribe nada", async () => {
    /**
     * El caso que justifica la lista cerrada. Con un `string` libre, cualquiera que
     * descubriera esta ruta —y es pública— podría meter el nombre que quisiera
     * tantas veces como quisiera, y el contador dejaría de significar nada. Aquí el
     * 400 va **antes** de `anotar`, y el caso lo comprueba mirando la tabla.
     */
    const res = await post({ evento: "visita_falsa", ts: Date.now() });
    expect(res.status).toBe(400);
    expect(store.resumen().total).toBe(0);
  });

  it("rechaza un cuerpo que no es JSON", async () => {
    const res = await post("esto no es json");
    expect(res.status).toBe(400);
    expect(store.resumen().total).toBe(0);
  });

  it("rechaza un cuerpo sin evento", async () => {
    const res = await post({ ts: Date.now() });
    expect(res.status).toBe(400);
    expect(store.resumen().total).toBe(0);
  });

  it("rechaza un cuerpo mayor que el techo", async () => {
    const grande = { evento: "visita", relleno: "x".repeat(2_000) };
    const res = await post(grande);
    expect(res.status).toBe(413);
    expect(store.resumen().total).toBe(0);
  });

  it("el `ts` del cliente se usa si es razonable", async () => {
    const antes = Date.now() - 60_000;
    await post({ evento: "visita", ts: antes });
    expect(store.resumen().primera).toBe(antes);
  });

  it("un `ts` absurdo cae al reloj del servidor en vez de aceptarse", async () => {
    /**
     * El `POST` es público, así que un `ts` de `0` pondría la fila tan atrás que
     * la primera poda del día se la comería, y uno de `1e18` la dejaría fuera del
     * alcance de cualquier poda. Los dos son cosas que puede mandar cualquiera,
     * y las dos vacían o congelan el contador.
     */
    await post({ evento: "visita", ts: 0 });
    const antes = Date.now();
    await post({ evento: "visita", ts: 1e18 });

    const r = store.resumen();
    expect(r.porEvento.visita).toBe(2);
    expect(r.primera).not.toBe(0);
    expect(r.primera).toBeGreaterThan(antes - 60_000);
    expect(r.ultima).toBeLessThan(antes + 60_000);
  });

  it("sin `ts` usa el reloj del servidor", async () => {
    const antes = Date.now();
    await post({ evento: "visita" });
    const r = store.resumen();
    expect(r.primera).toBeGreaterThanOrEqual(antes);
    expect(r.primera).toBeLessThanOrEqual(Date.now());
  });
});

describe("GET", () => {
  it("devuelve 401 sin `x-api-key`", async () => {
    const res = await get();
    expect(res.status).toBe(401);
  });

  it("devuelve 401 con una clave que no es la buena", async () => {
    const res = await get({ "x-api-key": "otra" });
    expect(res.status).toBe(401);
  });

  it("devuelve los recuentos con la clave buena", async () => {
    // El `ts` va dentro de la ventana que acepta `ahoraDelCliente`: uno de 2023
    // está fuera y la ruta lo sustituye por el reloj del servidor, que es
    // exactamente lo que comprueba el caso de abajo.
    const marca = Date.now() - 1_000;
    await post({ evento: "visita", ts: marca });
    await post({ evento: "instalada", ts: marca + 500 });

    const res = await get({ "x-api-key": API_KEY });
    expect(res.status).toBe(200);
    const cuerpo = await res.json();
    expect(cuerpo.porEvento.visita).toBe(1);
    expect(cuerpo.porEvento.instalada).toBe(1);
    expect(cuerpo.total).toBe(2);
    expect(cuerpo.primera).toBe(marca);
  });

  it("devuelve 503 si `API_KEY` no está en el servidor", async () => {
    /**
     * El mismo criterio que el middleware: un despliegue sin la variable no está
     * degradado, está roto, y tiene que decirlo con un 503 que menciona la
     * variable. Devolver el resumen sin comprobar nada sería abrir el panel a
     * internet entero.
     */
    delete process.env.API_KEY;
    const res = await get({ "x-api-key": "lo-que-sea" });
    expect(res.status).toBe(503);
    expect((await res.json()).error).toContain("API_KEY");
  });
});