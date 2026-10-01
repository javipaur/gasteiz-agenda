import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";

import EXENCIONES from "@/lib/lint-baseline.json";

/**
 * El baseline de `no-explicit-any` es una lista de ficheros exentos en
 * `lib/lint-baseline.ts`. Esto es lo que lo convierte en una regla y no en un
 * inventario.
 *
 * Sin estas comprobaciones la lista es una constante que nadie vuelve a mirar:
 * añadir un `any` a un scraper que ya estaba exento no produce ninguna señal, y
 * arreglar uno de un scraper que sigue en la lista tampoco. El rojo se mudaría de
 * sitio sin aparecer nunca.
 *
 * La comprobación que de verdad trabaja es la última: **corre ESLint**. Las otras
 * vigilan que la lista sea coherente, que es lo que hace falta para que la última
 * signifique algo.
 */

const ROOT = resolve(__dirname, "..");
const EXENCIONADAS = new Set(EXENCIONES.map((e) => e.fichero));

function informeDeEslint(): { filePath: string; messages: { ruleId: string | null }[] }[] {
  // El binario de ESLint con el propio node, y no `npx`: `npx` no es un
  // ejecutable resoluble desde `execFileSync` en Windows —sale un ENOENT— y en
  // Linux añadiría una descarga de red a un test que tiene que ser hermético.
  //
  // La ruta se construye a mano y no con `require.resolve` porque ESLint 9
  // declara un `exports` que no incluye `./bin/eslint.js`, así que resolverlo
  // como un módulo normal falla aunque el fichero esté ahí.
  const eslint = join(ROOT, "node_modules", "eslint", "bin", "eslint.js");
  const salida = execFileSync(
    process.execPath,
    [eslint, "--format", "json", "app", "lib", "scripts"],
    { cwd: ROOT, encoding: "utf8", maxBuffer: 32 * 1024 * 1024 }
  );
  // `--format json` devuelve un **array** de resultados, no un objeto con
  // `results`, que es lo que hace parecer que el formateador se equivoca.
  return JSON.parse(salida);
}

/** Ficheros que emiten `no-explicit-any` ahora mismo, incluidos los exentos. */
function ficherosConAny(): Set<string> {
  const conAny = new Set<string>();
  for (const resultado of informeDeEslint()) {
    const rel = relative(ROOT, resultado.filePath).replace(/\\/g, "/");
    for (const mensaje of resultado.messages) {
      if (mensaje.ruleId === "@typescript-eslint/no-explicit-any") conAny.add(rel);
    }
  }
  return conAny;
}

describe("el baseline de no-explicit-any", () => {
  it("no queda ningún any fuera de la lista", () => {
    // Este es el que hace trabajo. Corre ESLint de verdad y comprueba que no hay
    // un solo `any` en un fichero que no esté exento: añadir uno nuevo da un
    // rojo aunque el total de problemas no cambie, que es justo lo que un
    // baseline por recuento no puede hacer.
    const fuera = [...ficherosConAny()].filter((f) => !EXENCIONADAS.has(f)).sort();

    expect(fuera).toEqual([]);
  });

  it("cada fichero exento existe y sigue teniendo el any que lo motivó", () => {
    // Una entrada que apunta a un fichero borrado no falla: ESLint simplemente
    // nunca la aplica, y la deuda reaparece sin que nadie lo note hasta que
    // alguien escribe un `any` en un fichero nuevo con ese nombre. Y una
    // entrada que ya no tiene `any` es deuda declarada que nadie está pagando:
    // el arreglo es trabajo de scraper y está fuera de alcance, pero tiene que
    // verse en el `git diff` que añade este mensaje.
    //
    // Se comprueba leyendo el fichero en vez de contra el informe porque el
    // informe ya no ve los exentos: para ellos la regla está apagada.
    const sinAny = EXENCIONES.filter(
      (e) =>
        !existsSync(join(ROOT, e.fichero)) ||
        !/\bany\b/.test(readFileSync(join(ROOT, e.fichero), "utf8"))
    ).map((e) => e.fichero);

    expect(sinAny).toEqual([]);
  });

  it("cada exención dice por qué está", () => {
    // Una razón vacía es la señal de que alguien quiere silenciar el rojo sin
    // haber pensado en el coste. Con la razón escrita, quien lo lea después sabe
    // si sigue siendo verdad.
    const sinRazon = EXENCIONES.filter((e) => e.razon.trim().length < 20).map(
      (e) => e.fichero
    );

    expect(sinRazon).toEqual([]);
  });

  it("ningún componente ni página está exento", () => {
    // El alcance del baseline es lo que lo hace aceptable: `lib/sources/` es
    // deuda acotada, porque el dato entra sin forma y sale tipado por
    // `normalizeRaw`; una ruta de API está exenta porque reproduce a propósito la
    // forma cruda que consume un cliente externo. En un componente el `any` llega
    // hasta la UI, y ahí no es una lista que revisar, es un error.
    const fueraDeAlcance = EXENCIONES.filter(
      (e) =>
        !e.fichero.startsWith("lib/sources/") &&
        !e.fichero.startsWith("scripts/") &&
        !e.fichero.startsWith("app/api/")
    ).map((e) => e.fichero);

    expect(fueraDeAlcance).toEqual([]);
  });

  it("no hay ids repetidos en la lista", () => {
    // `files` en ESLint acepta patronos y rutas, y una duplicada no da error: la
    // segunda entrada es la que manda y la primera desaparece en silencio.
    const ids = EXENCIONES.map((e) => e.fichero);
    expect(new Set(ids).size).toBe(ids.length);
  });
});