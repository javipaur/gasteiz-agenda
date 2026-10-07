import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";

import { SOURCE_DATA } from "@/lib/source-data";
import { CATEGORY_COLORS } from "@/lib/categories";
import { PUBLIC_API_ROUTES, isPublicApiRoute } from "@/lib/api-public-routes";
// El scraper del directorio de farmacias, para contrastar el esquema `Farmacia`
// contra las claves que emite de verdad. Es el único import de un `lib/sources/`
// del fichero, y entra por el motivo contrario al que lo prohíbe
// `__tests__/source-data.test.ts`: aquí el grafo se recorre al revés, del documento
// hacia el código, y lo que se quiere es que los dos digan lo mismo.
import { parseFarmaciasGeojson } from "@/lib/sources/farmacias";

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

const ROOT = resolve(__dirname, "..");
const RAIZ = ROOT;
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

  it("ninguna clave se cuela un nivel más hondo que su hermana", () => {
    // **El fichero no parseaba.** El `enum` del parámetro `source` estaba
    // indentado dos espacios donde su hermana `type` estaba a doce, así que
    // cualquier validador o generador de cliente que abriera
    // `public/openapi.yaml` se comía un `bad indentation of a mapping entry` y
    // tirando. Estaba en el repo desde que se refrescó el enum de fuentes, y
    // ningún test lo veía: el de arriba mira dos patrones de escalar flojo y
    // este es un problema de sangría, no de sintaxis de escalar.
    //
    // No se parsea el fichero porque el proyecto no declara `js-yaml` (está en
    // `node_modules` por analógico, y un test que dependa de un paquete
    // transitivo se rompe en cuanto otro lo mueve). Lo que se comprueba es la
    // regla que el parser rompe: una clave no puede ir más hondo que la línea
    // anterior si esa línea ya tenía su valor.
    //
    // Dos excepciones, y las dos son legales:
    // - la línea anterior abría un bloque (`schema:`) y la actual es su contenido;
    // - la línea anterior era un elemento de secuencia (`- name: category`) y la
    //   actual es la siguiente clave de ese mismo objeto.
    // El contenido de `description: |` y `description: >-` se salta entero: es
    // texto literal y se indenta como le da la gana, y muchas de sus líneas
    // parecen claves.
    //
    // Medido sobre las 1.249 líneas del fichero: 0 falsos positivos, 1
    // coincidencia en la versión de antes del arreglo (la línea 77).
    const Escalera = /:\s*[|>][-+]?\s*$/;
    const sospechosas: string[] = [];

    for (let i = 1; i < LINEAS.length; i++) {
      const linea = LINEAS[i];
      if (linea.trim() === "" || linea.trimStart().startsWith("#")) continue;

      const anterior = LINEAS[i - 1];
      if (anterior.trim() === "") continue;
      // Contenido de un escalar de bloque: no es estructura, no se juzga.
      if (Escalera.test(anterior)) continue;

      if (sangriaDe(linea) <= sangriaDe(anterior)) continue;

      const abreBloque = anterior.trimEnd().endsWith(":");
      const esElementoDeSecuencia = anterior.trimStart().startsWith("- ");
      if (abreBloque || esElementoDeSecuencia) continue;

      sospechosas.push(`${i + 1}: ${linea.trim()}`);
    }

    expect(sospechosas).toEqual([]);
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

/**
 * El contrato de autenticación contra lo que el middleware hace de verdad.
 *
 * El documento declaraba `security: - apiKey: []` en la raíz y solo levantaba la
 * exención en las tres rutas del newsletter. El código hacía otra cosa: abría
 * con `startsWith` sobre una lista que incluía `"/api/actividades"`, así que en
 * la práctica eran públicas unas veinte rutas. Ni el doc mentía por exceso ni
 * por defecto: mentía de las dos formas a la vez, que es peor.
 *
 * Estas comprobaciones no escriben el documento —el yaml es un fichero estático
 * y no se deriva— sino que lo **contrastan** con `PUBLIC_API_ROUTES`, la misma
 * constante que lee el middleware. Si alguien abre una ruta en el código y no
 * en el documento, el fallo dice exactamente cuál.
 */
const PATHS = bloqueDesde(
  LINEAS.findIndex((l) => l.trimStart().startsWith("paths:") && sangriaDe(l) === 0),
  2
);

/**
 * Igual que `bloqueDesde`, pero sobre `PATHS` y no sobre `LINEAS`.
 *
 * Hace falta la segunda copia porque los índices son distintos: `PATHS` es
 * `LINEAS` sin las líneas en blanco y sin lo que había antes de `paths:`, así
 * que un índice de `PATHS` no sirve para recortar `LINEAS`. La versión que
 * mezcla los dos arrays no falla de forma ruidosa —devuelve bloques vacíos y los
 * tests pasan por no haber encontrado nada que comprobar—, que es peor.
 */
function bloqueDePaths(indice: number, sangria: number): string[] {
  const out: string[] = [];
  for (let i = indice + 1; i < PATHS.length; i++) {
    const linea = PATHS[i];
    if (linea.trim() === "") continue;
    if (sangriaDe(linea) < sangria) break;
    out.push(linea);
  }
  return out;
}

/** Las rutas de la clave `paths`, en el orden del fichero. */
function rutasDocumentadas(): string[] {
  return PATHS.filter((l) => sangriaDe(l) === 2 && l.trimEnd().endsWith(":")).map((l) =>
    l.trim().replace(/:$/, "")
  );
}

/** Las operaciones (`get`, `post`, ...) de una ruta documentada. */
function operacionesDe(ruta: string): string[] {
  const i = indiceDeRuta(ruta);
  if (i < 0) return [];
  return bloqueDePaths(i, 4)
    .filter((l) => sangriaDe(l) === 4 && /^(get|post|put|patch|delete):$/.test(l.trim()))
    .map((l) => l.trim().replace(/:$/, ""));
}

function indiceDeRuta(ruta: string): number {
  return PATHS.findIndex((l) => sangriaDe(l) === 2 && l.trim() === `${ruta}:`);
}

/** Las líneas de una operación concreta. */
function bloqueDeOperacion(ruta: string, operacion: string): string[] {
  const i = indiceDeRuta(ruta);
  if (i < 0) return [];
  const j = bloqueDePaths(i, 4).findIndex(
    (l) => sangriaDe(l) === 4 && l.trim() === `${operacion}:`
  );
  if (j < 0) return [];
  return bloqueDePaths(i + 1 + j, 6);
}

const PUBLICAS = PUBLIC_API_ROUTES.map((r) => r.path);
const PUBLICAS_DOCUMENTADAS = rutasDocumentadas().filter((r) => PUBLICAS.includes(r));

describe("la autenticación que promete el documento", () => {
  it("la raíz sigue declarando apiKey, que es lo que hace la mayoría de rutas", () => {
    const i = LINEAS.findIndex((l) => l.trimStart().startsWith("security:") && sangriaDe(l) === 0);
    expect(i).toBeGreaterThanOrEqual(0);
    const bloque = bloqueDesde(i, 2);
    expect(bloque.some((l) => l.trim() === "- apiKey: []")).toBe(true);
  });

  it("toda ruta pública que el documento menciona va con `security: []`", () => {
    // Este es el que muerde. `/api/cines`, `/api/cines/boulevard`,
    // `/api/cines/florida` y `/api/farmacias` son públicas desde antes de esta
    // fase, y el documento les pedía una clave que el servidor nunca pedía.
    const sinExencion: string[] = [];
    for (const ruta of PUBLICAS_DOCUMENTADAS) {
      for (const operacion of operacionesDe(ruta)) {
        if (!bloqueDeOperacion(ruta, operacion).some((l) => l.trim() === "security: []")) {
          sinExencion.push(`${ruta} ${operacion}`);
        }
      }
    }
    expect(sinExencion).toEqual([]);
  });

  it("ninguna ruta protegida del documento se autolibera con `security: []`", () => {
    // En sentido contrario: `security: []` es lo que hace pública una ruta, así
    // que una línea de más en el documento abre de verdad para quien lo lea.
    const autoliberadas: string[] = [];
    for (const ruta of rutasDocumentadas().filter((r) => !PUBLICAS.includes(r))) {
      for (const operacion of operacionesDe(ruta)) {
        if (bloqueDeOperacion(ruta, operacion).some((l) => l.trim() === "security: []")) {
          autoliberadas.push(`${ruta} ${operacion}`);
        }
      }
    }
    expect(autoliberadas).toEqual([]);
  });

  it("una ruta que no pide clave no puede prometer un 401", () => {
    // `security: []` y `"401": Unauthorized` en la misma operación se contradicen
    // en treinta líneas. El middleware devuelve 503 sin `API_KEY` y 401 solo con
    // la clave puesta, y una ruta pública no llega ni a mirar la clave.
    const contradictorias: string[] = [];
    for (const ruta of PUBLICAS_DOCUMENTADAS) {
      for (const operacion of operacionesDe(ruta)) {
        const bloque = bloqueDeOperacion(ruta, operacion);
        const autoliberada = bloque.some((l) => l.trim() === "security: []");
        if (autoliberada && bloque.some((l) => l.includes("responses/Unauthorized"))) {
          contradictorias.push(`${ruta} ${operacion}`);
        }
      }
    }
    expect(contradictorias).toEqual([]);
  });

  it("documenta al menos las cuatro de cines, que son las públicas de consumo externo", () => {
    // Las que el OpenAPI publica para clientes móviles. Si mañana desaparecen
    // del documento, quien integre contra él se queda sin saber que existen, y
    // esta es la única señal de que la exención es deliberada.
    for (const ruta of ["/api/cines", "/api/cines/boulevard", "/api/cines/florida"]) {
      expect({ ruta, documentada: rutasDocumentadas().includes(ruta) }).toEqual({
        ruta,
        documentada: true,
      });
    }
  });

  it("el documento cubre ocho de las doce públicas del código, y se sabe cuáles cuatro no", () => {
    // Las que faltan —`/api/search`, `/api/vgbus`, `/api/push/subscribe` y
    // `/api/fiestas-blanca`— no se documentan hoy. Este test no las exige:
    // documentarlas significa inventar sus esquemas, que es otra decisión. Lo que
    // fija es que la lista siga siendo esa, para que si alguien añade una quinta
    // ruta pública sin documentarla, la deuda se vea en el nombre en vez de pasar
    // desapercibida.
    expect(PUBLICAS_DOCUMENTADAS.sort()).toEqual([
      "/api/cines",
      "/api/cines/boulevard",
      "/api/cines/florida",
      "/api/farmacias",
      "/api/newsletter/confirm",
      "/api/newsletter/subscribe",
      "/api/newsletter/unsubscribe",
      "/api/v1/salud",
    ]);
  });
});

/**
 * Lo que el middleware responde de verdad, contrastado con lo que el documento
 * promete.
 *
 * El fail-closed de la fase 2 añadió un **503** que el middleware devuelve a las
 * treinta rutas protegidas cuando `API_KEY` no está en el entorno. El documento
 * no lo mencionaba: `components.responses` solo tenía `Unauthorized` y
 * `RateLimited`, así que un despliegue mal configurado —el caso para el que
 * existe el 503— salía en el contrato como un 401 más, y quien integrara contra
 * él no tenía forma de distinguir «tu clave está mal» de «este servidor está
 * roto». Son dosQUEUE错的 que se resuelven distinto.
 *
 * Y en el otro extremo, `/api/newsletter/confirm` documentaba un `200` y un
 * `400` que el código no puede producir: `NextResponse.redirect` devuelve 307
 * siempre, con token válido o sin él. El `400` no existe en esa ruta —sí en
 * `unsubscribe`, que responde 400 cuando no viene token— y el `200` era la
 * respuesta que el endpoint daba antes de que se validara el token, o sea, la
 * que el endpoint daba *siempre*, para cualquier cadena.
 */
const RUTAS_EN_DISCO = (() => {
  const base = join(ROOT, "app", "api");
  const out: string[] = [];
  const walk = (dir: string) => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const p = join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.name === "route.ts" || e.name === "route.tsx") {
        out.push(("/api/" + relative(base, dirname(p))).split(sep).join("/"));
      }
    }
  };
  if (existsSync(base)) walk(base);
  return out.sort();
})();

const PROTEGIDAS_EN_DISCO = RUTAS_EN_DISCO.filter((r) => !isPublicApiRoute(r));

/** Los códigos de respuesta declarados en una operación, en el orden del fichero. */
function codigosDeRespuesta(ruta: string, operacion: string): string[] {
  const salida: string[] = [];
  for (const linea of bloqueDeOperacion(ruta, operacion)) {
    const m = linea.trim().match(/^"(\d{3})":$/);
    if (m) salida.push(m[1]);
  }
  return salida;
}

/** Los pares `operación -> códigos` de todas las rutas documentadas y protegidas. */
function operacionesProtegidas(): { ruta: string; operacion: string }[] {
  const salida: { ruta: string; operacion: string }[] = [];
  for (const ruta of rutasDocumentadas().filter((r) => !isPublicApiRoute(r))) {
    for (const operacion of operacionesDe(ruta)) salida.push({ ruta, operacion });
  }
  return salida;
}

describe("las respuestas que el middleware produce de verdad", () => {
  it("toda operación protegida documentada declara 401 y 503", () => {
    // Veintiocho operaciones, todas contra el mismo `security` de la raíz. Que
    // falte el 503 en una sola es un despliegue entero mal configurado que el
    // contrato no cubre.
    const incompletas: string[] = [];
    for (const { ruta, operacion } of operacionesProtegidas()) {
      const codigos = codigosDeRespuesta(ruta, operacion);
      if (!codigos.includes("401") || !codigos.includes("503")) {
        incompletas.push(`${ruta} ${operacion} -> ${codigos.join(",") || "(ninguna)"}`);
      }
    }
    expect(incompletas).toEqual([]);
  });

  it("el 503 está en `components.responses` y no reescrito en cada operación", () => {
    const i = LINEAS.findIndex(
      (l) => l.trimStart().startsWith("responses:") && sangriaDe(l) === 2
    );
    expect(i).toBeGreaterThanOrEqual(0);
    const nombres = bloqueDesde(i, 4)
      .filter((l) => sangriaDe(l) === 4)
      .map((l) => l.trim().replace(/:$/, ""));
    expect(nombres).toContain("ServiceMisconfigured");

    // Y que las veintiocho lo referencien, no que lo repitan. Veintiocho copias
    // de la misma respuesta es Veintiocho sitios donde puede quedar una vieja.
    for (const { ruta, operacion } of operacionesProtegidas()) {
      expect({
        ref: `${ruta} ${operacion}`,
        usaElComponente: bloqueDeOperacion(ruta, operacion).some((l) =>
          l.includes("responses/ServiceMisconfigured")
        ),
      }).toEqual({ ref: `${ruta} ${operacion}`, usaElComponente: true });
    }
  });

  it("ninguna operación pública declara 401, ni el 503 de configuración perdida", () => {
    // El `401` está prohibido siempre y sin excepción: una ruta que no pide clave no
    // puede recibirlo, porque el middleware devuelve antes de mirar nada.
    //
    // El `503` solo se prohíbe cuando es **el del middleware** —el que sale cuando
    // `API_KEY` no está en el entorno—, y se reconoce por la referencia a
    // `responses/ServiceMisconfigured`. Un `503` del propio handler es otra cosa: es
    // lo que responde `/api/search` cuando la capa de caché no se puede leer, y es un
    // código que el cliente sabe reintentar. Prohibirlo aquí mezclaba los dos, y la
    // mezcla no se había visto porque ninguna ruta pública documentada declaraba un
    // `503` todavía: `/api/search` lo tiene en el código pero no en el documento.
    //
    // Lo que no vale es declaran ambos en la misma operación: un `503` que Puede ser
    // de configuración perdida y no lo dice es el contrato que este test busca.
    const conEstadoDeAuth: string[] = [];
    for (const ruta of rutasDocumentadas().filter(isPublicApiRoute)) {
      for (const operacion of operacionesDe(ruta)) {
        const bloque = bloqueDeOperacion(ruta, operacion);
        const codigos = codigosDeRespuesta(ruta, operacion);
        if (codigos.includes("401")) {
          conEstadoDeAuth.push(`${ruta} ${operacion} -> ${codigos.join(",")}`);
          continue;
        }
        if (codigos.includes("503") && bloque.some((l) => l.includes("responses/ServiceMisconfigured"))) {
          conEstadoDeAuth.push(`${ruta} ${operacion} -> 503 de configuracion perdida`);
        }
      }
    }
    expect(conEstadoDeAuth).toEqual([]);
  });

  it("las dos rutas del newsletter que redireccionan documentan 307, no 200", () => {
    // `NextResponse.redirect` devuelve 307 siempre. El `200` que tenían
    // documentado era la respuesta anterior a validar el token, o sea, la que
    // salía para cualquier cadena.
    for (const ruta of ["/api/newsletter/confirm", "/api/newsletter/unsubscribe"]) {
      const codigos = codigosDeRespuesta(ruta, "get");
      expect({ ruta, codigos }).toEqual({ ruta, codigos: expect.arrayContaining(["307"]) });
      expect({ ruta, tiene200: codigos.includes("200") }).toEqual({ ruta, tiene200: false });
    }
  });

  it("confirmar no documenta un 400 que el código no puede devolver", () => {
    // La ruta devuelve 307 con token válido, 307 con token inválido y 307 sin
    // token. No hay ningún camino a un 400.
    const codigos = codigosDeRespuesta("/api/newsletter/confirm", "get");
    expect(codigos).not.toContain("400");
  });

  it("darse de baja sí documenta el 400, que en esa ruta sí existe", () => {
    // El hermano de arriba devuelve 400 cuando no viene token, así que aquí el
    // `400` es cierto. La asimetría es real y por eso cada ruta se comprueba por
    // separado en vez de con una regla común.
    const codigos = codigosDeRespuesta("/api/newsletter/unsubscribe", "get");
    expect(codigos).toContain("400");
  });

  it("las dos redirecciones del newsletter declaran a dónde llevan", () => {
    // `?newsletter=invalid-token` no estaba en ningún sitio del documento y es
    // el desenlace que ve la persona cuando el enlace no vale. Como ahora
    // ninguna página lee el parámetro, al menos queda escrito aquí.
    for (const ruta of ["/api/newsletter/confirm", "/api/newsletter/unsubscribe"]) {
      expect({
        ruta,
        mencionaLosDesenlaces: bloqueDeOperacion(ruta, "get").join("\n").includes("newsletter="),
      }).toEqual({ ruta, mencionaLosDesenlaces: true });
    }
  });
});

/**
 * Cuántas rutas protegidas cubre el documento.
 *
 * **Por qué una constante y no el número escrito en el `toEqual`.** El número estaba
 * escrito en el test y en el nombre del caso, que son dos sitios que hay que cambiar
 * juntos y que no avisan de nada cuando se cambia solo uno: el nombre del caso es
 * texto, y un texto que dice treinta cuando son treinta y una sigue leyéndose bien. Con
 * la constante, los dos casos que dependen del número se inventan solos y el nombre se
 * pone desde ella.
 *
 * Y el número sigue escrita en el `toEqual`, que es lo que ata la constante a la
 * realidad: si las rutas cambian sin tocar esto, el `toEqual` se pone rojo.
 */
const ProtectedCount = 29;

describe("la cobertura del documento", () => {
  it("cubre las ProtectedCount rutas protegidas salvo las dos que se listan aquí", () => {
    // La lista es explícita a propósito. Las dos de abajo existen en `app/api/**`
    // y no están en el YAML; si alguien añade una tercera sin documentarla, este
    // test lo dice por el nombre en vez de dejar que la deuda crezca en silencio.
    // Y si las documenta, tiene que quitar la de aquí.
    //
    // `/api/log` salió de esta lista cuando pasó a ser pública: la consume el
    // logger del navegador, que no tiene `API_KEY`.
    const sinDocumentar = PROTEGIDAS_EN_DISCO.filter((r) => !rutasDocumentadas().includes(r));
    expect(sinDocumentar.sort()).toEqual(["/api/fiestas-blanca", "/api/push/send"]);
  });

  it("no documenta ninguna ruta que no exista", () => {
    // Al revés: un path en el documento que ya no tiene route handler es un 404
    // que el contrato promete como si funcionara.
    const fantasma = rutasDocumentadas().filter((r) => !RUTAS_EN_DISCO.includes(r));
    expect(fantasma).toEqual([]);
  });

  it("la política entera son 45 rutas: 16 públicas y 29 protegidas", () => {
    // El número que resume la fase 2. Si sube o baja, alguien ha añadido o
    // quitado una ruta y tiene que decidir dónde encaja.
    //
    // La duodécima pública es `/api/v1/salud`, que se añadió para que un cliente
    // externo pueda comprobar si el agregado está completo antes de usarlo. Va
    // documentada más abajo, en "el estado del agregado".
    //
    // Las tres del paquete de redes son las trece, catorce y quince, y son públicas
    // **por necesidad y no por descuido**: Meta descarga las imágenes sin credencial,
    // así que protegerlas respondería 401 a la URL que el propio paquete devuelve. No
    // están en el `openapi.yaml` porque su consumidor es un post, no un integrador: el
    // caso de "cubre las treinta rutas protegidas" solo exige documentar las
    // protegidas, y las tres no lo son. Lo de que `/api/promo` es un espacio de
    // nombres y no una ruta exacta está en `lib/api-public-routes.ts` y lo comprueba
    // `__tests__/promo-publico.test.ts`.
    //
    // La decimosexta es `/api/img`, el proxy de los hosts cuyo WAF rechaza las cabeceras
    // del optimizador de Next. También es pública por necesidad —la llama el navegador al
    // pintar las tarjetas, que no tiene la clave— y por el mismo motivo que las tres del
    // paquete: protegerla devolvería 401 a las fotos y saldría el mismo degradado gris del
    // que se queja este arreglo. No está en el YAML porque su consumidor es una etiqueta
    // `<img>` del propio sitio, no un integrador.
    expect({
      total: RUTAS_EN_DISCO.length,
      publicas: RUTAS_EN_DISCO.filter(isPublicApiRoute).length,
      protegidas: PROTEGIDAS_EN_DISCO.length,
    }).toEqual({ total: 45, publicas: 16, protegidas: ProtectedCount });
  });
});

/**
 * Los códigos que las rutas **nuevos** producen y el documento no declaraba, y el
 * `Farmacia` que no describía la respuesta real.
 *
 * Una revisión anterior arregló seis fallos de estas rutas **en el código** y dejó
 * el OpenAPI como estaba. Ese es el peor sitio posible para arreglar un contrato:
 * el documento es lo único que lee quien integra, así que el arreglo le llega como
 * una sorpresa, y no como una mejora. Concretamente:
 *
 * - Un `catch` que devuelve `502`/`503`/`500` donde antes devolvía `200` con la
 *   lista vacía. El `200` vacío era una mentira: "no lo sé" y "no hay nada" salían
 *   byte a byte iguales, y la app móvil cachea lo que recibe, así que medio minuto
 *   de origen caído se convertía en un vacío permanente sin error en ninguna parte.
 * - Un `catch` que degradaba a `200 {results: []}` en `/api/search`, que es
 *   exactamente la respuesta de una búsqueda que no encuentra nada.
 *
 * `/api/search` queda fuera de esta lista a propósito, y no por olvido: no está
 * documentada, y documentarla con su `503` la volvería pública para efectos del
 * contrato mientras el test de autenticación exige que una ruta pública no declare
 * `503` —el middleware devuelve antes de mirar el entorno—. Queda anotado en el
 * nombre del test de abajo, que es donde se ve.
 */
describe("los códigos que el código produce y el documento no declaraba", () => {
  it.each([
    // La ruta, el código que le faltaba y por qué lo devuelve.
    ["/api/farmacias", "502", "opendata no contesta y la caché está fría"],
    ["/api/actividades", "500", "el calendario municipal no se pudo leer"],
    ["/api/actividades/navidad", "500", "el calendario municipal no se pudo leer"],
    ["/api/rula", "500", "falta MEC_TOKEN o La Genterula no responde"],
    ["/api/v1/events", "500", "el agregador no devolvió eventos"],
  ])("%s declara %d (%s)", (ruta, codigo, porque) => {
    expect({
      ruta,
      codigo,
      porque,
      declarado: codigosDeRespuesta(ruta, "get").includes(codigo),
    }).toEqual({ ruta, codigo, porque, declarado: true });
  });

  it("alta al newsletter declara el 502 del correo de confirmación y los que ya devolvía", () => {
    // El `502` es el que faltaba: la fila se escribe **antes** de enviar el correo,
    // así que cuando SMTP falla la suscripción está registrada pero el enlace nunca
    // llega, y la ruta respondía `200 {ok: true}` con «revisa tu correo». Quien
    // integrates contra el documento no tenía forma de distinguir «suscrito» de
    // «nunca te va a llegar nada».
    //
    // El `429` y el `500` también faltaban y ya los devolvía la ruta antes de esta
    // revisión: se añaden al revisar la operación entera, no por el 502, porque
    // dejar declared un `200` al lado de unos códigos que el servidor sí devuelve
    // es la misma mentira que se vino a arreglar.
    expect(codigosDeRespuesta("/api/newsletter/subscribe", "post")).toEqual(
      expect.arrayContaining(["200", "400", "429", "500", "502"])
    );
  });

  it("/api/search sigue sin documentarse, y el test lo nombra", () => {
    // El 503 de `/api/search` no se puede documentar sin romper el otro test: una
    // ruta pública no puede prometer un 503, porque el middleware devuelve antes de
    // mirar el entorno. Documentarla exigiría primero decidir si es pública o
    // protegida, que es otra decisión. Se anota aquí para que la deuda tenga
    // nombre en vez de ser una ausencia.
    expect(rutasDocumentadas()).not.toContain("/api/search");
  });

  it("el 502 y el 500 son respuestas de `components.responses`, no copias por ruta", () => {
    // Por el mismo motivo que el 503: veinte copias de la misma respuesta son veinte
    // sitios donde puede quedar una vieja, y el 502 va a aparecer en más rutas
    // (`/api/cines` lo usa ya) conforme se arreglen.
    const i = LINEAS.findIndex(
      (l) => l.trimStart().startsWith("responses:") && sangriaDe(l) === 2
    );
    const nombres = bloqueDesde(i, 4)
      .filter((l) => sangriaDe(l) === 4)
      .map((l) => l.trim().replace(/:$/, ""));

    for (const nombre of ["UpstreamUnavailable", "ScraperFailed"]) {
      expect(nombres).toContain(nombre);
    }
  });
});

/**
 * El esquema `Farmacia` describía una respuesta que no existe, y en la ruta que el
 * documento publica para clientes móviles.
 *
 * `/api/farmacias` es `security: []`, o sea pública, y el documento la daba como un
 * **array** de objetos con `nombre`, `direccion`, `ciudad`, `telefono` y `horario`.
 * La ruta real devuelve un **objeto** —un envelope con `source`, `date`, `count`,
 * `fetchedAt` y `data`— y cada item es `{id, name, shortAddress, address, phone,
 * date, horarios, neighborhood, city, zone, lat, lng}`. Ni el contenedor coincide ni
 * **uno** de los cinco nombres de campo: un cliente generado desde el documento
 * recibe `undefined` en todos y, como además lo indexa como si fuera una lista,
* revienta al recorrerlo. Un documento que se lee perfecto y no describe nada es
 * peor que uno que no existe, porque el integrador ya llegó a la conclusión de que
 * el contrato estaba escrito.
 *
 * El caso contrasta contra `parseFarmaciasGeojson` de verdad y no contra una lista
 * escrita aquí: esa lista se contrastaría con el documento, no con el código, que es
 * justo lo que se quiere evitar. Y el `200` se contrasta por sus propiedades
 * directas, que es lo que distingue «un array de cosas» de «un envelope».
 */
describe("el esquema de /api/farmacias es el que devuelve la ruta", () => {
  /**
   * Las líneas del bloque `schema:` de una respuesta concreta.
   *
   * La sangría del `schema:` se deduce de la del código de respuesta: `"200":` está a
   * 8, `content:` a 10, `application/json:` a 12 y `schema:` a 14. Buscar
   * `"schema:"` a pelo daría el primero que encuentre —que puede ser el de un
   * `requestBody`— y devolvería el bloque equivocado en silencio.
   */
  function bloqueDeEsquema(ruta: string, operacion: string, codigo: string): string[] {
    const bloque = bloqueDeOperacion(ruta, operacion);
    const i = bloque.findIndex((l) => l.trim() === `"${codigo}":`);
    if (i < 0) return [];
    const sangriaSchema = sangriaDe(bloque[i]) + 6;
    const j = bloque.findIndex(
      (l, k) => k > i && l.trim() === "schema:" && sangriaDe(l) === sangriaSchema
    );
    if (j < 0) return [];
    return bloque.slice(j + 1).filter((l) => sangriaDe(l) > sangriaSchema);
  }

  /** Los nombres de las propiedades directas del `schema:` de una respuesta. */
  function propiedadesDeRespuesta(
    ruta: string,
    operacion: string,
    codigo: string
  ): string[] {
    const bloque = bloqueDeOperacion(ruta, operacion);
    const i = bloque.findIndex((l) => l.trim() === `"${codigo}":`);
    if (i < 0) return [];
    const sangriaSchema = sangriaDe(bloque[i]) + 6;
    const j = bloque.findIndex(
      (l, k) => k > i && l.trim() === "properties:" && sangriaDe(l) === sangriaSchema + 2
    );
    if (j < 0) return [];
    return bloque
      .slice(j + 1)
      .filter((l) => l.trim() !== "" && sangriaDe(l) === sangriaSchema + 4)
      .map((l) => l.trim().match(/^([A-Za-z0-9_]+):/)?.[1] ?? "");
  }

  /**
   * Los nombres de las propiedades de un esquema de `components.schemas`.
   *
   * No se puede usar `esquema()` y quedarse con las líneas de sangria 8: el bloque
   * lleva un `description: >-` y **su contenido también va a sangria 8**, así que
   * un filtro por sangría se come las líneas de la descripción y las cuenta como
   * propiedades. Por eso se busca el `properties:` y se corta ahí, que es lo que
   * separa la estructura del texto literal.
   */
  function propiedadesDeEsquema(nombre: string): string[] {
    const bloque = esquema(nombre);
    const sangriaProperties = sangriaDe(bloque.find((l) => l.trim() === "properties:") ?? "");
    const i = bloque.findIndex((l) => l.trim() === "properties:");
    if (i < 0) return [];
    return bloque
      .slice(i + 1)
      .filter((l) => l.trim() !== "" && sangriaDe(l) === sangriaProperties + 2)
      .map((l) => l.trim().match(/^([A-Za-z0-9_]+):/)?.[1] ?? "");
  }

  it("el 200 es el envelope, no una lista", () => {
    // Falla con el YAML viejo: `propiedadesDeRespuesta` devolvía `[]` porque bajo el
    // `schema:` no había un `properties:` sino un `type: array`, así que la
    // aserción caía en la comprobación y no en un fallo de compilación.
    expect(propiedadesDeRespuesta("/api/farmacias", "get", "200").sort()).toEqual([
      "count",
      "data",
      "date",
      "fetchedAt",
      "source",
    ]);
  });

  it("`data` es un array que apunta al esquema Farmacia", () => {
    const esquema = bloqueDeEsquema("/api/farmacias", "get", "200");
    expect(esquema.some((l) => l.trim() === "data:")).toBe(true);
    expect(esquema.some((l) => l.trim() === "type: array")).toBe(true);
    expect(esquema.some((l) => l.includes('$ref: "#/components/schemas/Farmacia"'))).toBe(
      true
    );
  });

  it("Farmacia declara exactamente las claves que emite el scraper", () => {
    // El contraste es contra el parser de verdad, no contra una lista escrita aquí:
    // una lista escrita en el test se contrastaría con el documento, que es
    // justamente el bucle cerrado que hizo que esto se quedara roto.
    const geojson = JSON.stringify({
      features: [
        {
          geometry: { coordinates: [-2.673, 42.843] },
          properties: {
            titular1: "Farmacia de prueba",
            idif: "010001",
            direccion: "Calle Mayor 1",
            municipio: "VITORIA-GASTEIZ",
            cp: "01001",
            telefono: "945 000 000",
          },
        },
      ],
    });
    const emitidos = Object.keys(parseFarmaciasGeojson(geojson)[0]).sort();

    expect(propiedadesDeEsquema("Farmacia").sort()).toEqual(emitidos);
  });

  it("ninguna clave documentada es una que el scraper no emita", () => {
    // En sentido contrario, y con los nombres en castellano que tenía antes, que es
    // donde el fallo se hacía más caro: `nombre` y `direccion` se leen parecido a
    // `name` y `address`, así que un integrador que los viera no sospecharía.
    const declaradas = propiedadesDeEsquema("Farmacia");
    for (const fantasma of ["nombre", "direccion", "ciudad", "telefono", "horario"]) {
      expect(declaradas).not.toContain(fantasma);
    }
  });
});
