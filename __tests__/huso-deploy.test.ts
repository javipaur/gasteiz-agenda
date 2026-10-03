import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";

/**
 * `nixpacks.toml` no es un fichero de configuración cualquiera: es lo que decide
 * en qué huso horario —y con qué variables— arranca el proceso de Next en Dokploy.
 *
 * `PUSH_DIGEST_HOUR=9` se documenta como «la hora del digest diario» sin decir de
 * quién, y la imagen no fijaba ninguna zona. Un contenedor Node sin `TZ` corre en
 * UTC, así que en horario de verano el digest salía a las 11:00 sin decir nada. Y
 * como `lib/scheduler.ts` usaba `now.getHours()` —la hora local del proceso—, la
 * zona no era una variable del despliegue sino un accidento de la imagen.
 *
 * Los dos arreglos van juntos y por eso se comprueban en el mismo fichero: la
 * variable **y** que el código la lea por su cuenta. Poner `TZ` aquí sin leerla en
 * el código deja el digest en la zona del proceso, que es justo lo que pasó;
 * leerla en el código sin ponerla aquí funciona en local y no en Dokploy.
 */
const TOML = readFileSync(resolve(__dirname, "..", "nixpacks.toml"), "utf8");

/** El valor de una clave dentro de `[variables]`, sin parsear TOML entero. */
function variable(nombre: string): string | null {
  const bloque = TOML.match(/\[variables\]([\s\S]*?)(?=\n\[|$)/);
  if (!bloque) return null;
  const m = bloque[1].match(new RegExp(`^${nombre}\\s*=\\s*"?([^"\\n]+)"?\\s*$`, "m"));
  return m ? m[1].trim() : null;
}

describe("nixpacks.toml", () => {
  it("fija TZ en Europe/Madrid, que es la zona que el digest promete", () => {
    // El motivo de que sea aquí y no en el código: el despliegue es lo único que
    // sabe en qué zona se opera. El código solo pone el valor por defecto
    // (`__tests__/scheduler.test.ts`), así que la verdad de producción es esta
    // línea.
    expect(variable("TZ")).toBe("Europe/Madrid");
  });

  it("sigue poniendo las variables que ya estaban", () => {
    // El fichero no se toca a la ligera: `NODE_OPTIONS = "--experimental-sqlite"`
    // es lo que hace que `node:sqlite` exista en la imagen, y sin él el push se
    // cae al importar `lib/push`.
    expect(TOML).toMatch(/^NODE_OPTIONS\s*=\s*"--experimental-sqlite"/m);
    expect(variable("AXIOM_DATASET")).toBe("gasteiz-agenda");
  });
});

/**
 * `TZ` no es una variable cualquiera: si se cuela en otro sitio, la línea de aquí
 * deja de ser la que decide.
 */
/**
 * El código, sin los comentarios.
 *
 * Sin esto, la comprobación de abajo mediría también la prosa: el motivo por el que
 * no hay ningún `getHours()` está escrito en un comentario que menciona
 * `getHours()`, y un test estructural al que un comentario le puede dar un falso
 * rojo es un test que va a estorbar la primera vez que alguien explique bien su
 * arreglo.
 */
function soloCodigo(fuente: string): string {
  return fuente.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
}

describe("el huso, de los dos lados", () => {
  it("el código lee la zona de `TZ`, con Europe/Madrid por defecto", () => {
    // Se lee el fichero en vez de llamar a la función porque lo que importa es que
    // la zona venga del entorno y no del reloj del proceso. Un `getHours()` colado
    // en `lib/scheduler.ts` no lo caza ninguna prueba de huso del repo, porque el
    // runner está fijado en Europe/Madrid y ahí `getHours()` da la respuesta buena.
    const codigo = soloCodigo(
      readFileSync(join(resolve(__dirname, ".."), "lib", "scheduler.ts"), "utf8")
    );

    expect(codigo).toMatch(/TZ/);
    expect(codigo).toMatch(/Europe\/Madrid/);
    // Y que la zona llegue a `Intl` de verdad, no a un equivalente de `getHours()`.
    expect(codigo).toMatch(/timeZone/);
    expect(codigo).not.toMatch(/getHours/);
  });
});
