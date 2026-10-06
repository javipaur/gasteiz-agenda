import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative, resolve } from "node:path";

import { loadFixture, mockFetchWith } from "../helpers";
import { SOURCE_REGISTRY, SOURCE_GROUPS } from "@/lib/source-registry";

/**
 * Los tipos que el Ayuntamiento declara, contra los que el registro consulta, y
 * contra los que las rutas de `app/api/**` piden por su cuenta.
 *
 * El guard que ya hay en `source-registry.test.ts` prohíbe **cadenas** en `tipo`, que
 * es otra cosa distinta: este mira la otra mitad, que no quede ningún tipo declarado sin
 * consumir, y luego el agujero que aquel deja.
 *
 * Los dos que faltaban —el 14 «Feria» y el 11 «Presentación»— estuvieron meses trayendo
 * cero eventos sin que nada lo dijera, y el motivo de que nadie lo viera es que **este
 * test no existía**. Se miraba el tipo de cada entrada una por una, y en las que faltaba
 * no había nada que mirar.
 */

/** El 99 «Otros» lo cubre `municipal-general` sin filtro. Está escrito, no implícito. */
const CUBIERTO_SIN_PEDIR = "99";

const ROOT = resolve(__dirname, "..", "..");

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
});

/**
 * `tipo` como cadena en las rutas, que es donde el guard del registro no llega.
 *
 * El registro ya no puede tener una: `__tests__/source-registry.test.ts` lo prohíbe
 * mirando **las URLs que salen de cada `run`**, que es lo único que no se puede
 * documentar en falso. Ese guard es bueno y muerde, pero solo mira `SOURCE_REGISTRY`, y
 * las rutas de `app/api/**` montan su propia consulta y nunca pasan por el registro. De
 * las diez llamadas a `scrapeMunicipalCalendar` que hay bajo `app/`, `visitas` era la
 * única que ponía una cadena en `tipo`: las otras van por `calendariosID`, por `dest`,
 * sin filtro, o con un número.
 *
 * Por tanto, lo que este guard protege es **la ruta siguiente**, no la de hoy: la que
 * se escriba copiando el ejemplo equivocado de la que está al lado. Por eso son dos
 * tests y no uno —el que vigila `app/api/**` y el que demuestra que el detector pica—
 * porque un recorrido que no llegara a ningún fichero, o un patrón escrito mal, darían
 * un verde que no miraría nada.
 */

/**
 * `tipo` seguido de una cadena. Sin la `g` a propósito: `test` con bandera global lleva
 * `lastIndex` entre llamadas y el mismo patrón puede devolver `true` y `false` sobre el
 * mismo texto según el orden.
 */
const CADENA_EN_TIPO = /tipo:\s*\[\s*"/;

/**
 * El fichero sin sus comentarios.
 *
 * Sin esto el guard es **imposible de satisfacer**: el arreglo se explica en un comentario
 * al lado de la línea, y la explicación tiene que poder escribir `tipo: ["visitias
 * guiadas"]` para decir qué era lo que había. Un guard que se pone rojo con la
 * explicación del arreglo enseña la lección contraria —borrar la explicación para que el
 * test pase— y este repo lleva cuatro commits terakhir corrigiendo comentarios que
 * decían lo contrario del código. Que mire el código y no la prosa que lo rodea.
 *
 * El riesgo del recorte es al revés del que importa aquí: quitar texto no puede inventar
 * un `tipo: ["` que no estaba, solo podría tapar uno si un `//` de dentro de una cadena
 * comiera la línea, que es lo que el test testigo cubre con un caso normal.
 */
function sinComentarios(texto: string): string {
  return texto
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/\/\/.*$/gm, " ");
}

/** Los ficheros de TypeScript de un directorio, saltando `node_modules` y los dot. */
function ficheros(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith(".") || entry.name === "node_modules") continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) ficheros(full, acc);
    else if (/\.tsx?$/.test(entry.name)) acc.push(full);
  }
  return acc;
}

/** Las rutas que pasan `tipo` como cadena, en forma de ruta desde la raíz del repo. */
function conCadenaEnTipo(dir: string): string[] {
  return ficheros(dir)
    .filter((f) => CADENA_EN_TIPO.test(sinComentarios(readFileSync(f, "utf8"))))
    .map((f) => relative(ROOT, f));
}

describe("las rutas que preguntan al calendario por su cuenta", () => {
  it("ninguna de `app/api/**` pasa el `tipo` como cadena", () => {
    // El fallo sale con la ruta exacta, que es lo que hay que ir a arreglar. Este es
    // el mismo bug de `municipal-visitas` —`"visitias guiadas"` en vez de `[15]`, y
    // cuatro formas de cadena contra cuatro ceros medidos el 6 de octubre de 2026— y
    // aquí pesaba más: la ruta contestaba HTTP 200 con `[]` y sin un log, y
    // `/api/actividades/*` es contrato con una app móvil que no puede distinguir esa
    // lista vacía de "hoy no hay visitas guiadas".
    expect(conCadenaEnTipo(join(ROOT, "app", "api"))).toEqual([]);
  });

  it("el detector pica la línea que `visitas` tenía antes del arreglo", () => {
    // El testigo del guard de arriba. Se escribe en un temporal y se recorre con la
    // **misma** función, así que cubre las tres cosas que pueden fallar: que el
    // recorrido no llegue, que no lea, y que el patrón no case. Sin esto, un `[]` verde
    // no distinguiría "no hay ninguna ruta con la cadena" de "no miré nada".
    const dir = mkdtempSync(join(tmpdir(), "municipal-tipo-"));
    try {
      writeFileSync(
        join(dir, "route.ts"),
        'const eventos = await scrapeMunicipalCalendar({ tipo: ["visitias guiadas"] });\n',
        "utf8"
      );

      const halladas = conCadenaEnTipo(dir);
      expect(halladas).toHaveLength(1);
      // El separador del path sale como lo pone la plataforma, así que se mira solo
      // el final del nombre en vez de la ruta entera.
      expect(halladas[0].endsWith("route.ts")).toBe(true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
