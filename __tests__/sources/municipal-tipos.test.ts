import { loadFixture, mockFetchWith } from "../helpers";
import { SOURCE_REGISTRY, SOURCE_GROUPS } from "@/lib/source-registry";

/**
 * Los tipos que el Ayuntamiento declara, contra los que el registro consulta.
 *
 * El guard que ya hay en `source-registry.test.ts` prohíbe **cadenas** en `tipo`,
 * que es otra cosa distinta. Este mira la otra mitad: que no quede ningún tipo
 * declarado sin consumir.
 *
 * Los dos que faltaban —el 14 «Feria» y el 11 «Presentación»— estuvieron meses
 * trayendo cero eventos sin que nada lo dijera, y el motivo de que nadie lo viera
 * es que **este test no existía**. Se miraba el tipo de cada entrada una por una,
 * y en las que faltaba no había nada que mirar.
 */

/** El 99 «Otros» lo cubre `municipal-general` sin filtro. Está escrito, no implícito. */
const CUBIERTO_SIN_PEDIR = "99";

const tiposDeclarados = (): Array<{ id: string; texto: string }> => {
  const datos = JSON.parse(loadFixture("municipal-filtros.json")) as {
    filtros: Array<{ id: string; array: Array<{ id: string; texto: string }> }>;
  };
  const declarados = datos.filtros.find((f) => f.id === "tipo");
  if (!declarados) throw new Error("la fixture no trae el filtro de tipo");
  return declarados.array;
};

describe("los tipos que el Ayuntamiento declara", () => {
  it("cada uno está consultado por alguna entrada del registro", async () => {
    mockFetchWith([
      { match: /vitoria-gasteiz\.org/, content: loadFixture("municipal-response.json") },
    ]);

    const municipales = SOURCE_REGISTRY.filter((e) => SOURCE_GROUPS[e.id] === "municipal");
    for (const e of municipales) await e.run();

    // `Promise.allSettled` no corre aquí: se llaman en serie y en el mismo orden, así
    // que la llamada n-ésima de `fetch` es la de la variante n-ésima.
    const pedidos = new Set<string>();
    (global.fetch as jest.Mock).mock.calls.forEach((c) => {
      const f = new URL(String(c[0])).searchParams.get("f");
      if (!f) return;
      // El `f` viaja crudo en la query, así que se busca dentro de la cadena en vez
      // de parsear dos veces.
      const m = /"tipo"\s*:\s*\[\s*(\d+)/.exec(decodeURIComponent(f));
      if (m) pedidos.add(m[1]);
    });

    const sinConsultar = tiposDeclarados()
      .map((t) => t.id)
      .filter((id) => !pedidos.has(id))
      .sort();

    expect(sinConsultar).toEqual([CUBIERTO_SIN_PEDIR]);
  });

  it("los tipos que se piden son números, que es lo único que acepta el servlet", () => {
    // Red de seguridad para la otra mitad del problema: una cadena en `tipo` devuelve
    // cero eventos sin dar error, y fue lo que hacía `municipal-visitas` llevar meses
    // filtrando por "visitias guiadas".
    const declarados = new Set(tiposDeclarados().map((t) => t.id));

    for (const id of declarados) {
      expect(Number.isNaN(Number(id))).toBe(false);
    }
  });
});
