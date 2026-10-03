// El tipo de verdad, no una copia local: declarar aquí un `type Evento` convertiría
// el fichero en script global y sus identificadores chocarían con los de otro test
// que también los declara.
import type { Evento } from "@/lib/eventos";

const mockEventos = jest.fn();

jest.mock("@/lib/eventos", () => ({ getProximosEventos: mockEventos }));

/**
 * `limit` y `offset` de `/api/v1/events` leían `parseInt(...)` y recortaban con
 * `Math.min`/`Math.max`, lo que no recorta nada cuando el número no es un número:
 * `NaN` se propaga en lugar de quedarse fuera del rango.
 *
 * Con `?limit=all` —que es como el cliente móvil pide "dámelo todo"— la respuesta
 * era exactamente esta, con status 200 y sin un error en ninguna parte:
 *
 *     {data: [], meta: {total: 120, limit: null, offset: 0, hasMore: false}}
 *
 * Tres fallos encadenados en una línea: `slice(0, NaN)` es `slice(0, 0)`, así que
 * ni un evento; `JSON.stringify` convierte `NaN` en `null`, así que el móvil
 * recibía `limit: null` en lugar de un número; y `hasMore: false` le decía que no
 * quedaba nada más, con lo que **dejaba de paginar en la primera página sin haber
 * visto un evento nunca**. Un `data: []` con `hasMore: false` es indistinguible de
 * "no hay eventos", y el agregado sí los tiene.
 *
 * Los límites que se comprueban aquí son los que declara `public/openapi.yaml`:
 * `minimum: 1`, `maximum: 200`, `default: 50`.
 */

type Envelope = {
  data: Evento[];
  meta: { total: number; limit: number; offset: number; hasMore: boolean };
};

const TOTAL = 120;

/**
 * `TOTAL` eventos repartidos a futuro, porque la ruta no filtra por fecha pero un
 * agregado vacío haría que cualquier prueba de paginación pasara por casualidad.
 */
function eventos(total = TOTAL): Evento[] {
  const base = Date.now();
  return Array.from({ length: total }, (_, i) => {
    const d = new Date(base);
    d.setDate(d.getDate() + i);
    return {
      id: `evento-${i}`,
      slug: `evento-${i}`,
      title: `Evento ${i}`,
      date: d.toISOString(),
      location: "Vitoria-Gasteiz",
      link: `https://example.com/${i}`,
      category: "Música",
      source: "fever",
    };
  });
}

async function get(query = ""): Promise<Response> {
  jest.resetModules();
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { GET } = require("@/app/api/v1/events/route") as {
    GET: (r: Request) => Promise<Response>;
  };
  return GET(new Request(`https://gasteizclick.test/api/v1/events${query}`));
}

beforeEach(() => {
  mockEventos.mockResolvedValue(eventos());
});

describe("GET /api/v1/events: limit", () => {
  it("un limit que no es un número cae al default documentado", async () => {
    // El caso que rompía el móvil. Antes salía `limit: null`, `data: []` y
    // `hasMore: false`, y con eso la paginación se paraba sin ver un evento.
    const res = await get("?limit=all");
    const body = (await res.json()) as Envelope;

    expect(res.status).toBe(200);
    expect(body.meta.limit).toBe(50);
    expect(body.data).toHaveLength(50);
    expect(body.meta.total).toBe(TOTAL);
    // Y lo importante: `hasMore` en `true` es lo que hace que el cliente pida la
    // segunda página. Sin esto da igual cuántas cosas salen en `data`.
    expect(body.meta.hasMore).toBe(true);
  });

  it("meta.limit y meta.offset son siempre números, nunca null", async () => {
    // `JSON.stringify` convierte `NaN` en `null`, que es como un `NaN` acababa
    // en el cliente. El tipo del campo es parte del contrato.
    for (const query of ["?limit=abc", "?limit=all", "?limit=", "?limit=NaN", "?offset=abc"]) {
      const body = (await (await get(query)).json()) as Envelope;

      expect({ query, tipo: typeof body.meta.limit }).toEqual({ query, tipo: "number" });
      expect({ query, tipo: typeof body.meta.offset }).toEqual({ query, tipo: "number" });
      expect(Number.isNaN(body.meta.limit)).toBe(false);
      expect(Number.isNaN(body.meta.offset)).toBe(false);
    }
  });

  it("sin limit devuelve 50, que es el default del OpenAPI", async () => {
    const cuerpo = (await (await get()).json()) as Envelope;

    expect(cuerpo.meta.limit).toBe(50);
    expect(cuerpo.meta.offset).toBe(0);
    expect(cuerpo.data).toHaveLength(50);
  });

  it("un limit vacío es el default y no el mínimo", async () => {
    // `Number("")` es `0`, y `0` recortado al rango 1..200 daría 1. Un `?limit=` no
    // es "quiero uno", es "no he dicho nada".
    const cuerpo = (await (await get("?limit=")).json()) as Envelope;

    expect(cuerpo.meta.limit).toBe(50);
    expect(cuerpo.data).toHaveLength(50);
  });

  it("un número con basura detrás no pasa por un límite válido", async () => {
    // `parseInt("100abc")` daba 100, así que una petición corrupta se colaba como
    // válida. `Number` es `NaN` y cae al default, que es lo que corresponde.
    const cuerpo = (await (await get("?limit=100abc")).json()) as Envelope;

    expect(cuerpo.meta.limit).toBe(50);
  });

  it("un limit numérico fuera de rango se recorta, no vuelve al default", async () => {
    // La diferencia con el caso anterior es deliberada. `limit=1000` sí es una
    // petición, solo que exagerada: 200 recortados le sirven y 50 le obligarían a
    // paginar veinte veces por lo mismo.
    const alta = (await (await get("?limit=9999")).json()) as Envelope;
    expect(alta.meta.limit).toBe(200);
    expect(alta.data).toHaveLength(120);

    const baja = (await (await get("?limit=0")).json()) as Envelope;
    expect(baja.meta.limit).toBe(1);
    expect(baja.data).toHaveLength(1);

    const negativa = (await (await get("?limit=-5")).json()) as Envelope;
    expect(negativa.meta.limit).toBe(1);
  });

  it("acepta enteros de 1 a 200 sin tocarlos, que es lo que manda el móvil", async () => {
    // El cliente real pide `limit=100&offset=N`. Si el recorte se pasara de
    // rosca por un lado, la paginación dejaría de avanzar en algún punto.
    for (const limit of [1, 25, 50, 100, 199, 200]) {
      const cuerpo = (await (await get(`?limit=${limit}`)).json()) as Envelope;
      expect({ limit, meta: cuerpo.meta.limit }).toEqual({ limit, meta: limit });
      expect(cuerpo.data.length).toBe(Math.min(limit, TOTAL));
    }
  });

  it("parte la parte decimal sin cambiarla de signo", async () => {
    // `slice` no acepta decimales: `?limit=2.7` son dos eventos, no dos coma siete
    // ni un `-2`.
    const cuerpo = (await (await get("?limit=2.7")).json()) as Envelope;

    expect(cuerpo.meta.limit).toBe(2);
    expect(cuerpo.data).toHaveLength(2);
  });
});

describe("GET /api/v1/events: offset", () => {
  it("pagina de verdad: 100 y luego 20", async () => {
    // La secuencia que hace el móvil, tal cual. Con el `NaN` de antes, la segunda
    // página llegaba vacía y el total no cuadraba con lo que ya había recibido.
    const primera = (await (await get("?limit=100&offset=0")).json()) as Envelope;
    const segunda = (await (await get("?limit=100&offset=100")).json()) as Envelope;

    expect(primera.meta).toEqual({ total: TOTAL, limit: 100, offset: 0, hasMore: true });
    expect(segunda.meta).toEqual({ total: TOTAL, limit: 100, offset: 100, hasMore: false });
    expect(segunda.data).toHaveLength(20);

    // Y sin solapes: la página dos empieza donde acabó la una.
    const ids = [...primera.data, ...segunda.data].map((e) => e.id);
    expect(new Set(ids).size).toBe(TOTAL);
  });

  it("un offset que no es un número vale cero, no pagina al vacío", async () => {
    // Antes `Math.max(NaN, 0)` daba `NaN`, y `slice(NaN, NaN)` devolvía `[]`: la
    // respuesta total era "no hay eventos" con 200.
    const cuerpo = (await (await get("?offset=abc")).json()) as Envelope;

    expect(cuerpo.meta.offset).toBe(0);
    expect(cuerpo.meta.limit).toBe(50);
    expect(cuerpo.data).toHaveLength(50);
  });

  it("un offset negativo se recorta a cero", async () => {
    const cuerpo = (await (await get("?offset=-10")).json()) as Envelope;

    expect(cuerpo.meta.offset).toBe(0);
    expect(cuerpo.data).toHaveLength(50);
  });

  it("un offset pasado del final devuelve vacío pero no dice que no hay más", async () => {
    // Es el final honesto del listado: no hay más eventos a partir de ahí. La
    // respuesta vacía es correcta, y por eso el status sigue siendo 200.
    const cuerpo = (await (await get("?offset=1000")).json()) as Envelope;

    expect(cuerpo.data).toHaveLength(0);
    expect(cuerpo.meta.total).toBe(TOTAL);
    expect(cuerpo.meta.hasMore).toBe(false);
  });
});