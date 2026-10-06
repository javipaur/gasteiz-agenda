import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join, relative, resolve } from "node:path";

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
 * Una clave `tipo` —con o sin comillas— seguida de un array que empieza por una cadena.
 *
 * Sin la `g` a propósito: `test` con bandera global lleva `lastIndex` entre llamadas y
 * el mismo patrón puede devolver `true` y `false` sobre el mismo texto según el orden.
 *
 * Las tres formas del array son las que hay: `"` doble, `'` simple y el `JSON.stringify`
 * de `lib/sources/municipal.ts` escapa las dos. La comilla de la clave también, porque
 * `"tipo":` es la forma que produce el propio `JSON.stringify` y la que lleva escrita
 * cualquiera que monte el filtro a mano en una ruta. `\b` delante para que `miTipo: ["x"]`
 * no case: lo que se busca es la clave `tipo`, no cualquier cosa que acabe en "tipo".
 *
 * Y sin `g` ni `y`, el patrón no tiene estado entre ficheros: se usa el mismo para los
 * cuatro de `app/api/**` que tienen el mismo `tipo` en un comentario y en el código.
 */
const CADENA_EN_TIPO = /\b["']?tipo["']?\s*:\s*\[\s*["']/;

/**
 * El fichero sin sus comentarios de bloque y de línea entera.
 *
 * Sin esto el guard es **imposible de satisfacer**: el arreglo se explica en un comentario
 * al lado de la línea, y la explicación tiene que poder escribir `tipo: ["visitias
 * guiadas"]` para decir qué era lo que había. Un guard que se pone rojo con la
 * explicación del arreglo enseña la lección contraria —borrar la explicación para que el
 * test pase— y este repo lleva cuatro commits seguidos corrigiendo comentarios que
 * decían lo contrario del código. Que mire el código y no la prosa que lo rodea.
 *
 * **El `//` solo se quita cuando es la línea entera.** Es la decisión que hace falta y
 * no es la única posible, así que va con su motivo. La alternativa era `\/\/.*$`, que
 * quita el `//` de donde sea, y esa **era** la primera versión de este guard: cortaba la
 * línea desde el primer `//` de cualquier sitio, y el `//` más común de este repo es el
 * de `https://`. Con ella, un `tipo` con cadena detrás de una URL quedaba invisible, y
 * esa no es una forma rareza de escribir el bug —es exactamente la que emite
 * `lib/sources/municipal.ts`, que concatena el `&f={"tipo":[...]}` a la URL, y la que
 * traía esta ruta desde su primer commit—. Tres líneas plantadas en una ruta real
 * pasaron en verde con el recorte viejo. Anclando el `//` al principio de la línea, e
 * ignorando los espacios de delante, se quitan igual los comentarios de `route.ts`, que
 * son líneas `//` enteras, y el código con URL se queda intacto.
 *
 * Lo que queda es el coste, y es el que se acepta: **un comentario de cola ya no se
 * quita**, así que `const x = 1; // tipo: ["ejemplo"]` daría un falso positivo. Se
 * acepta porque el falso positivo se ve y se arregla borrando el ejemplo del comentario,
 * mientras que el bug que se cuela no se ve nunca: es HTTP 200 con `[]` y sin log.
 */
function sinComentarios(texto: string): string {
  return texto
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/^\s*\/\/.*$/gm, " ");
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

  it("el detector pica las tres formas en las que una ruta se cuela", () => {
    // El testigo del guard de arriba, y son tres líneas y no una porque **cada una
    // tapa un agujero distinto**. La de la URL es la que hay que mirar: no es una
    // forma rareza de escribir el bug, es **exactamente** la que emitía
    // `lib/sources/municipal.ts` cuando concatenaba el `f` a la URL, y la que traía
    // esta ruta desde su primer commit. Un `tipo` con cadena detrás de un `https://`
    // no se puede ver si el recorte de comentarios se come el `//` de cualquier sitio.
    //
    // Las otras dos son el otro hueco, el del patrón: `"tipo":` con la clave
    // entrecomillada, que es como la escribe JSON.stringify, y la comilla simple, que
    // es como la escribe un fichero escrito a mano. Con las tres en el mismo test, un
    // recorte que se pase de listo o un patrón demasiado corto se ven en el diff
    // nombrando el fichero que falta, y los otros dos siguen en verde.
    const FORMAS = {
      "url.ts":
        'const url = `https://www.vitoria-gasteiz.org/wb021/was/CalendarioServlet?accion=buscar&f={"tipo":["visitias guiadas"]}`;\n',
      "comillas.ts": 'const f = { "tipo": ["visitias guiadas"] };\n',
      "comilla-simple.ts": "const f = { tipo: ['visitias guiadas'] };\n",
    };

    const dir = mkdtempSync(join(tmpdir(), "municipal-tipo-"));
    try {
      for (const [nombre, linea] of Object.entries(FORMAS)) {
        writeFileSync(join(dir, nombre), linea, "utf8");
      }

      // Solo el nombre del fichero: en el temporal la ruta sale con `..` de por medio
      // y no dice nada. Lo que importa aquí es *qué* formas se ven, no dónde están.
      const halladas = conCadenaEnTipo(dir).map((f) => basename(f)).sort();
      expect(halladas).toEqual(Object.keys(FORMAS).sort());
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
