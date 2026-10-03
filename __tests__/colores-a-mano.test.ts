import { readFileSync, globSync } from "node:fs";
import { join, resolve } from "node:path";

/**
 * Los colores que había escritos a mano al lado del token equivalente.
 *
 * La forma del fallo era siempre la misma: el token existía, funcionaba, y cuatro
 * ficheros más usaban el hex directamente. Ninguno se rompe al Deploy —el color
 * es el mismo— así que es deuda que no da ningún aviso y por eso necesita un
 * guardian: sin él, el siguiente hex escrito a mano entra igual de limpio.
 *
 * La lista de valores prohibidos sale de leer `--bg`, `--fg-subtle` y `--on-tint`
 * de `app/globals.css`, no de fijarlos aquí. Si mañana se cambia un token, la
 * lista cambia con él y el test sigue vigilado lo que manda.
 *
 * Lo que **no** entra aquí, y es deliberado, son las sombras y los velos: el pie
 * de página es una banda oscura en los dos temas, el menú móvil es un scrim sobre
 * el contenido y los brillos blancos de las tarjetas van sobre photographs. Son
 * constantes de imagen, no colores de tema, y tokenizarlas las haría depender de
 * un tema para el que no fueron pensadas. Los hex de los generadores de OpenGraph
 * tampoco: Satori no resuelve `var()`.
 */

const ROOT = resolve(__dirname, "..");
const CSS = readFileSync(join(ROOT, "app", "globals.css"), "utf8");

/** Valor de un token de `globals.css`, para no repetir el hex en la lista. */
function token(nombre: string): string {
  const m = CSS.match(new RegExp(`--${nombre}\\s*:\\s*(#[0-9a-f]{6})`, "i"));
  if (!m) throw new Error(`El token --${nombre} no está en globals.css o no es un hex`);
  return m[1];
}

/**
 * `--on-tint` es tinta sobre un relleno de color, no texto sobre superficie. Por
 * eso tiene el mismo valor que `--bg` en oscuro pero **no** es `--bg`: en tema
 * claro `--bg` es casi blanco y dejaría el texto de las pills invisible. Se
 * comprueba como token propio para que nadie lo sustituya por `--bg` creyendo que
 * es lo mismo.
 */
const PROHIBIDOS = [token("bg"), token("fg-subtle")];

const COMPONENTES = globSync(join(ROOT, "app", "components", "*.tsx")).map((f) =>
  f.slice(ROOT.length + 1).replace(/\\/g, "/")
);

describe("colores a mano en los componentes", () => {
  it("el guardian lee los tokens del CSS y no una lista fija", () => {
    // Si este test dejara de comprobar tokens, la lista de abajo se congelaría
    // con los valores de hoy y dejaría de proteger nada.
    expect(PROHIBIDOS.length).toBeGreaterThan(0);
    expect(PROHIBIDOS).toContain(token("on-tint"));
  });

  it.each(COMPONENTES)("%s no repite en crudo un color que ya tiene token", (fichero) => {
    const fuente = readFileSync(join(ROOT, fichero), "utf8");
    const encontrados = PROHIBIDOS.filter((hex) =>
      fuente.includes(hex)
    ).map((hex) => {
      const lineas = fuente
        .split("\n")
        .map((linea, i) => ({ linea, n: i + 1 }))
        .filter(({ linea }) => linea.includes(hex))
        .map(({ n }) => n);
      return `${hex} en ${lineas.join(", ")}`;
    });
    // El mensaje nombra el hex y la línea: "usa el token" sin saber cuál es lo que
    // hay que tocar no sirve de nada.
    expect({ fichero, encontrados }).toEqual({ fichero, encontrados: [] });
  });

  it("SectionsHub usa `var(--…-wash)` en los ocho lavados de sus tarjetas", () => {
    // Los ocho siblings comparten la misma forma de `wash`; seis usaban un token y
    // dos llevaban un `rgba()` escrito a mano que no correspondía a ningún token y
    // por eso no se adaptaba a la luz. El alcance es este fichero y no todos: en
    // el resto del directorio hay degradados con velo blanco sobre paneles oscuros
    // —`NewsLetter`, `SubscribeForm`— que son constantes de imagen, no colores de
    // tema, y tokenizarlos los haría depender de un tema para el que no existen.
    const fuente = readFileSync(join(ROOT, "app/components/SectionsHub.tsx"), "utf8");
    const lavados = [...fuente.matchAll(/wash:\s*"([^"]+)"/g)].map((m) => m[1]);
    expect(lavados.length).toBe(8);
    expect(lavados.filter((l) => !/var\(--[a-z-]+-wash\)/.test(l))).toEqual([]);
  });

  it("los generadores de OpenGraph se dejan fuera a propósito", () => {
    // Satori pinta a un canvas: no resuelve `var()`, así que ahí el hex literal
    // no es deuda, es la única opción. Se deja constancia de la excepción para
    // que nadie la "arregle" y rompa la previsualización.
    const og = readFileSync(join(ROOT, "app", "opengraph-image.tsx"), "utf8");
    expect(og).toMatch(/#[0-9a-f]{6}/i);
  });
});
