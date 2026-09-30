import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";

import { SOURCE_DATA } from "@/lib/source-data";
import { CATEGORY_COLORS } from "@/lib/categories";
import { PUBLIC_API_ROUTES, isPublicApiRoute } from "@/lib/api-public-routes";

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

  it("el documento cubre siete de las diez públicas del código, y se sabe cuáles tres no", () => {
    // Las que faltan —`/api/search`, `/api/vgbus` y `/api/push/subscribe`— no se
    // documentan hoy. Este test no las exige: documentarlas significa inventar
    // tres esquemas, que es otra decisión. Lo que fija es que la lista siga
    // siendo esa, para que si alguien añade una cuarta ruta pública sin
    // documentarla, la deuda se vea en el nombre en vez de pasar desapercibida.
    expect(PUBLICAS_DOCUMENTADAS.sort()).toEqual([
      "/api/cines",
      "/api/cines/boulevard",
      "/api/cines/florida",
      "/api/farmacias",
      "/api/newsletter/confirm",
      "/api/newsletter/subscribe",
      "/api/newsletter/unsubscribe",
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

  it("ninguna operación pública declara 401 ni 503", () => {
    // Al revés: una ruta que no pide clave no puede recibir un 401, y el 503
    // tampoco, porque el middleware devuelve antes de mirar el entorno. Se
    // comprueba en las diez, no en tres.
    const conEstadoDeAuth: string[] = [];
    for (const ruta of rutasDocumentadas().filter(isPublicApiRoute)) {
      for (const operacion of operacionesDe(ruta)) {
        const codigos = codigosDeRespuesta(ruta, operacion);
        if (codigos.includes("401") || codigos.includes("503")) {
          conEstadoDeAuth.push(`${ruta} ${operacion} -> ${codigos.join(",")}`);
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

describe("la cobertura del documento", () => {
  it("cubre las treinta rutas protegidas salvo las tres que se listan aquí", () => {
    // La lista es explícita a propósito. Las tres de abajo existen en
    // `app/api/**` y no están en el YAML; si alguien añade una cuarta sin
    // documentarla, este test lo dice por el nombre en vez de dejar que la deuda
    // crezca en silencio. Y si las documenta, tiene que quitar la de aquí.
    const sinDocumentar = PROTEGIDAS_EN_DISCO.filter((r) => !rutasDocumentadas().includes(r));
    expect(sinDocumentar.sort()).toEqual([
      "/api/fiestas-blanca",
      "/api/log",
      "/api/push/send",
    ]);
  });

  it("no documenta ninguna ruta que no exista", () => {
    // Al revés: un path en el documento que ya no tiene route handler es un 404
    // que el contrato promete como si funcionara.
    const fantasma = rutasDocumentadas().filter((r) => !RUTAS_EN_DISCO.includes(r));
    expect(fantasma).toEqual([]);
  });

  it("la política entera son 40 rutas: 10 públicas y 30 protegidas", () => {
    // El número que resume la fase 2. Si sube o baja, alguien ha añadido o
    // quitado una ruta y tiene que decidir dónde encaja.
    expect({
      total: RUTAS_EN_DISCO.length,
      publicas: RUTAS_EN_DISCO.filter(isPublicApiRoute).length,
      protegidas: PROTEGIDAS_EN_DISCO.length,
    }).toEqual({ total: 40, publicas: 10, protegidas: 30 });
  });
});
