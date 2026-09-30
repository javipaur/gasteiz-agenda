import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";

import { SOURCE_DATA } from "@/lib/source-data";
import { CATEGORY_COLORS } from "@/lib/categories";

/**
 * El contrato público de `/api/v1/events` contra lo que la ruta devuelve de
 * verdad.
 *
 * El `enum` de `public/openapi.yaml` se escribe a mano, que es exactamente por lo
 * que se quedó viejo: la tabla tenía `vitoria-gasteiz`, un id que dejó de
 * emitirse en la T4, y el `category` del esquema de Fever tenía `Conciertos` y
 * `Cultura`, dos categorías que `normalizeCategory` ya no produce. Ninguno de los
 * dos se quejó: un consumidor que siguiera el documento obtenía cero resultados
 * sin ningún error.
 *
 * Estos tests no derivan el enum —eso no se puede, el yaml es un fichero
 * estático—, sino que lo **contrastan** con las dos fuentes de verdad del
 * repositorio, que son `SOURCE_DATA` y `CATEGORY_COLORS`. Cuando se añada una
 * fuente o una categoría, el fallo dice qué línea hay que actualizar en vez de
 * dejar el documento mintiendo en silencio.
 *
 * No hace falta un parser de YAML: los tres enums que importan están en flow
 * style (`enum: [a, b, c]`), así que basta con localisation por sangría.
 */

const RAIZ = resolve(__dirname, "..");
const LINEAS = readFileSync(join(RAIZ, "public", "openapi.yaml"), "utf8").split(/\r?\n/);

function sangriaDe(linea: string): number {
  return linea.length - linea.trimStart().length;
}

/**
 * Las líneas que siguen a `indice` hasta la siguiente clave del mismo nivel o de
 * uno superior. Las líneas en blanco no cortan el bloque.
 */
function bloqueDesde(indice: number, sangria: number): string[] {
  const out: string[] = [];
  for (let i = indice + 1; i < LINEAS.length; i++) {
    const linea = LINEAS[i];
    if (linea.trim() === "") continue;
    if (sangriaDe(linea) < sangria) break;
    out.push(linea);
  }
  return out;
}

/** El valor de un `enum: [a, b, c]` en flow style, o `null` si la línea no lo es. */
function enumEnFlow(lineas: string[]): string[] | null {
  for (const linea of lineas) {
    const m = linea.match(/enum:\s*\[([^\]]*)\]/);
    if (m) {
      return m[1]
        .split(",")
        .map((v) => v.trim().replace(/^["']|["']$/g, ""))
        .filter(Boolean);
    }
  }
  return null;
}

/** Las líneas de un esquema de `components.schemas`, por nombre. */
function esquema(nombre: string): string[] {
  const sangria = 4;
  const indice = LINEAS.findIndex((l) => l.trimStart().startsWith(`${nombre}:`) && sangriaDe(l) === sangria);
  if (indice < 0) throw new Error(`El esquema ${nombre} no está en public/openapi.yaml`);
  return bloqueDesde(indice, sangria + 2);
}

/** Las líneas de un parámetro `- name: X` dentro de un bloque de path. */
function parametro(lineas: string[], nombre: string): string[] {
  const sangria = sangriaDe(lineas.find((l) => l.trim().startsWith("- name: category")) ?? "          ");
  const indice = lineas.findIndex((l) => l.trim() === `- name: ${nombre}`);
  if (indice < 0) throw new Error(`El parámetro ${nombre} no está en el bloque`);
  const out: string[] = [];
  for (let i = indice + 1; i < lineas.length; i++) {
    const linea = lineas[i];
    if (linea.trim() === "") continue;
    if (sangriaDe(linea) < sangria) break;
    out.push(linea);
  }
  return out;
}

const PATH_EVENTS = bloqueDesde(
  LINEAS.findIndex((l) => l.trimStart().startsWith("/api/v1/events:") && sangriaDe(l) === 2),
  4
);

const IDS_DEL_REGISTRO = SOURCE_DATA.map((e) => e.id);
const CATEGORIAS = Object.keys(CATEGORY_COLORS);

describe("el enum de source de /api/v1/events", () => {
  it("documenta los ids del registro, y solo esos", () => {
    // En los dos sentidos: un valor que no exista da cero resultados, y un id que
    // falte hace que un consumidor que lo use por documentación no encuentre nada.
    // Los ids del registro, no los de cultura: esta ruta devuelve el agregado
    // entero, así que documentar solo `CULTURE_SOURCE_IDS` dejaría fuera a las
    // otras dieciocho fuentes por el mismo motivo que se quejaba antes.
    const documentado = enumEnFlow(parametro(PATH_EVENTS, "source"));
    expect(documentado).not.toBeNull();
    expect([...(documentado as string[])].sort()).toEqual([...IDS_DEL_REGISTRO].sort());
  });

  it("ningún valor documentado es un id retirado", () => {
    // Los tres que el documento daba por buenos y ya no emite nadie. Cada uno es un
    // `source=...` que devuelve cero resultados sin error.
    const documentado = enumEnFlow(parametro(PATH_EVENTS, "source")) ?? [];
    for (const muerto of ["vitoria-gasteiz", "vitoria-gasteiz-rss", "buscametas", "cm-gazteiz"]) {
      expect(documentado).not.toContain(muerto);
    }
  });
});

describe("el enum de category", () => {
  it("el parámetro de la ruta documenta las quince categorías", () => {
    const documentado = enumEnFlow(parametro(PATH_EVENTS, "category"));
    expect(documentado).not.toBeNull();
    expect([...(documentado as string[])].sort()).toEqual([...CATEGORIAS].sort());
  });

  it("el esquema de una sola fuente documenta las mismas quince", () => {
    // `FeverEvent` es el que traía el enum de diez valores con `Conciertos` y
    // `Cultura`, que ya no produce nadie. Si un esquema documenta un subconjunto
    // del conjunto de la ruta, es porque se quedó atrás.
    const documentado = enumEnFlow(esquema("FeverEvent"));
    expect(documentado).not.toBeNull();
    expect([...(documentado as string[])].sort()).toEqual([...CATEGORIAS].sort());
  });

  it("ningún valor documentado es una categoría retirada", () => {
    // `normalizeCategory("conciertos")` es `Música` y `normalizeCategory("cultura")`
    // es `Otros`, así que los dos devolvían cero eventos.
    const muerto = ["Conciertos", "Cultura", "La Blanca"];
    for (const lineas of [parametro(PATH_EVENTS, "category"), esquema("FeverEvent")]) {
      const documentado = enumEnFlow(lineas) ?? [];
      for (const clave of muerto) {
        expect(documentado).not.toContain(clave);
      }
    }
  });
});

describe("el yaml es sintácticamente legible", () => {
  it("ningún escalar sin comillas lleva dos puntos o una lista dentro", () => {
    // Esto no es cosmético: **el fichero no parseaba**. Cuatro `description:` de
    // este yaml tenían un `: ` dentro de un escalar sin comillas
    // (`description: Fecha legible (ej: "Viernes 18 Julio 2026")`), que YAML
    // rechaza, así que cualquier validador o generador de cliente que abriera
    // `public/openapi.yaml` se comía un error de sintaxis en la línea 59 y tirando.
    // Los enums que se refresharon quedaban, literalmente, en un documento
    // ilegible para una máquina.
    //
    // El test mira el patrón y no el parseo porque el proyecto no declara ninguna
    // dependencia de YAML: `js-yaml` está en `node_modules` por analógico, pero un
    // test que dependa de un paquete transitivo se rompe en cuanto otro lo mueve.
    // Comprobado sobre las 1.120 líneas del fichero: 0 falsos positivos, y 5
    // coincidencias en la versión de antes del arreglo.
    const FLOJO = /^\s*[A-Za-z_]+: [^'"|>].*: /;
    const LISTA = /^\s*[A-Za-z_]+: [^'"|>[{].*[[{]/;

    const sospechosos = LINEAS.map((linea, i) => ({ linea, numero: i + 1 }))
      .filter(({ linea }) => !linea.trimStart().startsWith("#") && (FLOJO.test(linea) || LISTA.test(linea)))
      .map(({ numero, linea }) => `${numero}: ${linea.trim()}`);

    expect(sospechosos).toEqual([]);
  });
});

describe("el ejemplo de la respuesta", () => {
  it("no enseña una categoría ni una fuente que la ruta no puede devolver", () => {
    // El ejemplo de la línea 125 decía `category: "Conciertos"`. Un ejemplo que no
    // se puede reproducir es peor que no ponerlo: es lo primero que lee quien
    // integra contra la API.
    const indice = PATH_EVENTS.findIndex((l) => l.trim() === "example:");
    expect(indice).toBeGreaterThanOrEqual(0);
    const ejemplo = PATH_EVENTS.slice(indice + 1);

    const categoria = ejemplo.find((l) => l.trim().startsWith("category:"));
    const fuente = ejemplo.find((l) => l.trim().startsWith("source:"));
    expect(categoria).toBeDefined();
    expect(fuente).toBeDefined();

    const valorDe = (linea: string | undefined): string | undefined =>
      (linea as string).match(/"([^"]+)"/)?.[1];

    expect(CATEGORIAS).toContain(valorDe(categoria));
    expect(IDS_DEL_REGISTRO).toContain(valorDe(fuente));
  });
});
