import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";

import { SOURCE_DATA, SOURCE_LABELS, sourceGroup } from "@/lib/source-data";
import { SOURCE_REGISTRY } from "@/lib/source-registry";

const ROOT = resolve(__dirname, "..");

/** Resuelve un especificador de import a fichero, o `null` si es un paquete. */
function resolveSpecifier(fromFile: string, spec: string): string | null {
  let base: string;
  if (spec.startsWith("@/")) base = join(ROOT, spec.slice(2));
  else if (spec.startsWith(".")) base = resolve(dirname(fromFile), spec);
  else return null;
  for (const suffix of ["", ".ts", ".tsx", "/index.ts", "/index.tsx"]) {
    const candidate = base + suffix;
    if (existsSync(candidate) && statSync(candidate).isFile()) return candidate;
  }
  return null;
}

/**
 * Especificadores que un fichero importa de verdad. Los `import type` se
 * ignoran a propósito: TypeScript los borra al compilar, así que no pueden
 * arrastrar nada al bundle. Los `export ... from` cuentan, que también emiten
 * código.
 */
function importSpecifiers(file: string): string[] {
  const source = readFileSync(file, "utf8");
  const specs: string[] = [];
  const re = /(?:^|\n)\s*(?:import|export)\s+(type\s+)?[^;]*?from\s+["']([^"']+)["']/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(source)) !== null) {
    if (!match[1]) specs.push(match[2]);
  }
  const bare = /(?:^|\n)\s*import\s+["']([^"']+)["']/g;
  while ((match = bare.exec(source)) !== null) specs.push(match[1]);
  return specs;
}

/**
 * Módulos que no pueden quedar en el grafo de cliente, y por qué.
 *
 * La lista es explícita y corta a propósito: son los dos caminos por los que un
 * componente cliente puede arrastrar trabajo de servidor al navegador. Cada
 * entrada dice lo que cuesta, porque "es de servidor" no es un argumento que se
 * pueda comprobar leyendo el nombre del fichero.
 */
const SOLO_SERVIDOR: readonly { prefijo: string; razon: string }[] = [
  {
    prefijo: "lib/sources/",
    razon: "los scrapers, y con ellos el token de la API MEC de La Genterula",
  },
  {
    prefijo: "lib/og-image.ts",
    // No es un scraper, es un scraper en potencia: `cheerio` son 148,2 KB de chunk
    // de cliente que el navegador no ejecuta nunca, porque su único consumidor es
    // `lib/sources/gasteizhoy.ts`. Vivía en `lib/utils.ts` y por eso este barrido no
    // lo veía: llegar a un scraper y llegar a un módulo que importa `cheerio` no es
    // lo mismo para la regla.
    razon: "`fetchOgImage`, que importa `cheerio` y solo usa un scraper de servidor",
  },
];

/** Módulos de `SOLO_SERVIDOR` alcanzables desde `roots` por imports estáticos. */
function modulosDeServidorAlcanzables(roots: string[]): string[] {
  const seen = new Set<string>();
  const alcanzados = new Set<string>();
  const queue = [...roots];
  while (queue.length > 0) {
    const file = queue.pop() as string;
    if (seen.has(file)) continue;
    seen.add(file);
    for (const spec of importSpecifiers(file)) {
      const target = resolveSpecifier(file, spec);
      if (!target) continue;
      const rel = relative(ROOT, target).replace(/\\/g, "/");
      if (SOLO_SERVIDOR.some((m) => rel === m.prefijo || rel.startsWith(m.prefijo))) {
        alcanzados.add(rel);
      } else {
        queue.push(target);
      }
    }
  }
  return [...alcanzados].sort();
}

function walk(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if ([".next", ".git", "node_modules"].includes(entry.name)) continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) walk(full, acc);
    else if (/\.tsx?$/.test(entry.name)) acc.push(full);
  }
  return acc;
}

/** Todos los módulos marcados `"use client"`, que es la raíz del grafo cliente. */
function clientModules(): string[] {
  return [...walk(join(ROOT, "app")), ...walk(join(ROOT, "lib"))].filter(
    (file) => readFileSync(file, "utf8").startsWith('"use client"')
  );
}

describe("frontera entre el registro y el cliente", () => {
  it("el módulo de datos no importa ningún scraper", () => {
    expect(importSpecifiers(join(ROOT, "lib", "source-data.ts"))).toEqual([]);
  });

  it("lib/utils.ts y lib/tickets.ts no alcanzan ningún módulo de servidor", () => {
    // Estos dos los cargan los componentes cliente: `sourceLabel` desde
    // `lib/shared.tsx` e `isTicketSource` desde las tarjetas y el detalle.
    for (const mod of ["lib/utils.ts", "lib/tickets.ts"]) {
      expect({ mod, alcanzados: modulosDeServidorAlcanzables([join(ROOT, mod)]) }).toEqual({
        mod,
        alcanzados: [],
      });
    }
  });

  it("ningún componente cliente alcanza un módulo de servidor", () => {
    // El fallo que se está evitando: `lib/shared.tsx` es "use client" y fue a
    // través de `lib/utils.ts` al registro compuesto, llevándose los 18 scrapers
    // al bundle (chunk de la home de 146 KB a 403 KB). Este test es el que lo
    // vuelve a detectar si alguien vuelve a colgar el registro compuesto de un
    // módulo cliente, con el nombre del culpable en el mensaje.
    //
    // Y el segundo fallo, que este barrido no veía: `lib/utils.ts` importaba
    // `cheerio` arriba del todo para `fetchOgImage`, y con ella 148,2 KB de chunk
    // para una función que solo usa un scraper. `lib/og-image.ts` está en
    // `SOLO_SERVIDOR` por eso, y no por ser un scraper.
    const culpables: string[] = [];
    for (const file of clientModules()) {
      const alcanzados = modulosDeServidorAlcanzables([file]);
      if (alcanzados.length > 0) {
        culpables.push(`${relative(ROOT, file)} -> ${alcanzados.join(", ")}`);
      }
    }
    expect(culpables).toEqual([]);
  });

  it("la lista de módulos de servidor no crece por descuido", () => {
    // La lista es explícita para que añadir una entrada sea una decisión, pero una
    // lista explícita que se puede dejar atrás sin que nadie lo note es un
    // inventario, no una regla. Este test ata las dos entradas que hay con la
    // forma del repo: si `lib/og-image.ts` dejara de importar `cheerio`, dejaría de
    // tener motivo de estar aquí y el aviso de arriba estaría mintiendo.
    const prefijos = SOLO_SERVIDOR.map((m) => m.prefijo);
    expect(prefijos).toEqual(["lib/sources/", "lib/og-image.ts"]);
    expect(importSpecifiers(join(ROOT, "lib", "og-image.ts"))).toEqual(["cheerio"]);
    expect(importSpecifiers(join(ROOT, "lib", "utils.ts"))).toEqual(["./source-data"]);
  });
});

describe("composición del registro", () => {
  it("no hay ids repetidos en los datos", () => {
    // `SOURCE_LABELS` y `SOURCE_GROUPS` se construyen con `Object.fromEntries`, así
    // que un id repetido colapsa en silencio: la entrada desaparece de los mapas
    // mientras `SOURCE_REGISTRY` sigue teniendo las 27. El test de paridad de
    // abajo no lo pilla, porque compara el array consigo mismo.
    expect(new Set(SOURCE_DATA.map((e) => e.id)).size).toBe(SOURCE_DATA.length);
  });

  it("toda entrada de datos tiene su función de scraping", () => {
    // Si faltara alguna, `SOURCE_REGISTRY` habría reventado al construirse, así
    // que además de comparar esto comprobamos que el registro tiene tantas
    // entradas como datos, sin duplicados ni huecos.
    expect(SOURCE_REGISTRY.map((e) => e.id)).toEqual(SOURCE_DATA.map((e) => e.id));
    for (const entry of SOURCE_REGISTRY) {
      expect(typeof entry.run).toBe("function");
    }
  });

  it("los mapas del registro salen de los datos y no al revés", () => {
    expect(SOURCE_LABELS).toEqual(
      Object.fromEntries(SOURCE_REGISTRY.map((e) => [e.id, e.label]))
    );
    for (const entry of SOURCE_REGISTRY) {
      expect({ id: entry.id, group: sourceGroup(entry) }).toEqual({
        id: entry.id,
        group: entry.group ?? entry.id,
      });
    }
  });
});

/**
 * Lo que `sourceLabel` necesita para no enseñar un id en crudo.
 *
 * `lib/utils.ts` tuvo una tabla `LEGACY_SOURCE_IDS` que traducía los cuatro ids que
 * emitían `lib/eventos.ts`, `lib/deporte.ts` y `lib/kids.ts` antes de que fueran
 * vistas del agregado. Su comentario decía que se quedaría vacía cuando esos
 * módulos se retiraran. Ya no hay shim: lo sustituyen estas dos comprobaciones,
 * que no dependen de que nadie se acuerde de la próxima vez.
 *
 * El fallo que cubren es silencioso por naturaleza: un id que no está en
 * `SOURCE_LABELS` no da error, se enseña en mayúsculas tal cual en la pill de cada
 * tarjeta. Son dos y no una porque el literal escrito a mano y la lista escrita a
 * mano son las dos formas de colar un id nuevo, y el barrido incluye los
 * componentes, que es donde se pinta.
 *
 * Quedan `source:` escritos a mano en `app/api/**` y en `lib/sources/**`, y quedan
 * a propósito, por dos razones distintas que conviene no volver a confundir.
 *
 * En `lib/sources/**` es la forma que cada scraper da a su evento, que `RawLike`
 * descarta antes de construir el agregado.
 *
 * En `app/api/**` es otra cosa: el `source` del **envoltorio** de la respuesta,
 * que describe de dónde sale la lista y no de qué fuente es cada evento. Por eso
 * no tiene por qué ser un id del registro: `/api/actividades/tours` responde
 * `"agregado"` porque es una vista sobre las veintiocho fuentes, y
 * `/api/actividades/senderismo` responde `"cm-gazteiz"` porque el `group` de su
 * entrada se llama así. Los eventos de dentro sí llevan su id real.
 *
 * La razón por la que no se corrigen es que esas rutas las consume una app móvil
 * con `x-api-key`, y por tanto la forma de la respuesta es contrato con ella.
 * Cambiar el valor de un campo que el cliente usa para filtrar le deja sin
 * resultados, sin ningún error en el servidor. Por eso este test se queda en
 * `app/` y `lib/` y no baja a `app/api/`.
 */
describe("ninguna vista escribe el id de la fuente a mano", () => {
  /** `app/` y `lib/` sin las rutas de API, sin los scrapers y sin los tests. */
  function codigoDeVista(): { file: string; source: string }[] {
    return [...walk(join(ROOT, "app")), ...walk(join(ROOT, "lib"))]
      .filter((file) => {
        const rel = relative(ROOT, file).replace(/\\/g, "/");
        return !rel.startsWith("app/api/") && !rel.startsWith("lib/sources/");
      })
      .filter((file) => !/(__tests__|e2e)[\\/]/.test(file))
      .map((file) => ({
        file: relative(ROOT, file).replace(/\\/g, "/"),
        source: readFileSync(file, "utf8"),
      }));
  }

  it("ningún `source:` del sitio apunta a un id que no existe en el registro", () => {
    // El patrón se limita a minúsculas y guiones, que es la forma de un id del
    // registro —las 27 entradas son `municipal-agenda`, `buscametas-calendario`,
    // `rula`—, porque `source` es una palabra común y hay campos que no son un id
    // de fuente: el tema de `FiestasBlancaPageClient` es `source: "La Blanca
    // 2026"` y el marcador de Next en `app/error.tsx` es
    // `source: "app/error.tsx"`. El recorte no tapa el fallo que importa: los ids
    // viejos que motivaron el shim (`vitoria-gasteiz`, `cm-gazteiz`) son kebab-case
    // y se siguen viendo, y una lista de ids con espacios la pilla el test de abajo.
    const registrados = new Set(SOURCE_DATA.map((e) => e.id));
    const culpables: string[] = [];
    for (const { file, source } of codigoDeVista()) {
      for (const match of source.matchAll(
        /\bsource:\s*["']([a-z0-9]+(?:-[a-z0-9]+)*)["']/g
      )) {
        if (!registrados.has(match[1])) culpables.push(`${file}: ${match[1]}`);
      }
    }
    expect(culpables).toEqual([]);
  });

  it("ninguna lista de ids de fuente se sale del registro", () => {
    // `CONCIERTO_SOURCE_IDS` es la única lista escrita a mano que queda: la de
    // cultura se deduce con `filter` sobre `SOURCE_DATA` y no puede
    // desincronizarse. El patrón se lee del código y no de un import, para que el
    // barrido siga cubriendo la lista que se añada mañana sin tocar nada aquí.
    const registrados = new Set(SOURCE_DATA.map((e) => e.id));
    const DECL_LISTA = /export const (\w*SOURCE_IDS\w*)[^=]*=\s*\[([^\]]*)\]/g;
    const culpables: string[] = [];
    for (const { file, source } of codigoDeVista()) {
      for (const match of source.matchAll(DECL_LISTA)) {
        for (const id of [...match[2].matchAll(/["']([^"']+)["']/g)].map((m) => m[1])) {
          if (!registrados.has(id)) culpables.push(`${file}: ${match[1]} -> ${id}`);
        }
      }
    }
    expect(culpables).toEqual([]);
  });
});
