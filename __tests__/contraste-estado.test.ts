import { readFileSync, globSync } from "node:fs";
import { join, resolve } from "node:path";

/**
 * El contraste de los colores de estado, medido contra el token de cada tema.
 *
 * Por qué un test y no una revisión: `text-red-500` sobre `--surface` claro da
 * 3,62:1 y el mínimo de AA es 4,5:1. Es un fallo que no se ve leyendo el JSX —
 * la clase es válida, el color existe y en tema oscuro sí pasa — y que sólo
 * aparece al medir. Y se puede volver a romper sin que nadie se entere: el
 * próximo que ponga un `text-red-500` en un `role="alert"` no tiene forma de
 * saber que falla.
 *
 * Por qué se calcula y no se hace un snapshot: un snapshot del `className`
 * seguiría dando verde si alguien cambia `--danger` a un rojo más claro, que es
 * justo la forma por la que esto vuelve a romperse. Lo que hay que vigilar es la
 * **cifra**, y la cifra sólo sale de token a token.
 *
 * Se miden los dos fondos porque los dos existen en el repo: el chip de
 * "Cancelado" va directamente sobre `--surface` (las tarjetas de llegada) y el
 * `role="alert"` va sobre `--bg` teñido con el propio color al 5 %. Contra
 * `--bg` se mide el peor caso, porque teñir un fondo con el color del texto
 * siempre lo aclara y aclarar el fondo **baja** el ratio.
 */

const ROOT = resolve(__dirname, "..");
const CSS = readFileSync(join(ROOT, "app", "globals.css"), "utf8");

/**
 * Saca el cuerpo de `selector { … }`.
 *
 * No hay CSS anidado dentro de estos selectores, así que el primer `}` que
 * cierra es el correcto. Se busca el selector exacto y no una coincidencia
 * parcial a propósito: `data-theme="light"` y `data-accent="invierno"` comparten
 * prefijo, y una búsqueda por `includes` cogía el bloque equivocado.
 */
function bloqueDeCss(selector: string, desde = 0): string {
  const clave = `${selector} {`;
  const i = CSS.indexOf(clave, desde);
  if (i < 0) return "";
  const fin = CSS.indexOf("}", i);
  return fin < 0 ? "" : CSS.slice(i + clave.length, fin);
}

function token(bloque: string, nombre: string): string | null {
  const m = bloque.match(new RegExp(`--${nombre}\\s*:\\s*([^;]+);`));
  return m ? m[1].trim() : null;
}

/**
 * Los tres sitios donde vive una paleta, que tienen que decir lo mismo.
 *
 * El tercero es el que se olvida: `data-theme="light"` cubre a quien elige tema
 * a mano y la media query cubre a quien no ha elegido nada. Si sólo se actualiza
 * uno, la mitad de los visitantes en claro recibe el color del tema oscuro.
 */
const PALETAS = {
  oscuro: bloqueDeCss(":root"),
  claroExplicito: bloqueDeCss(':root[data-theme="light"]'),
  claroMedia: bloqueDeCss(
    ':root:not([data-theme="dark"])',
    CSS.indexOf("@media (prefers-color-scheme: light)")
  ),
} as const;

const TODAS_LAS_PALETAS = ["oscuro", "claroExplicito", "claroMedia"] as const;

/** Tokens que se pintan como texto de estado y tienen que pasar AA. */
const TOKENS_DE_ESTADO = ["danger"] as const;

/** Los tres sitios donde un color de estado se pinta sobre una superficie. */
const FONDOS = ["surface", "bg"] as const;

function hexARgb(hex: string): [number, number, number] {
  const limpio = hex.trim();
  const m = limpio.match(/^#([0-9a-f]{6})$/i);
  if (!m) throw new Error(`No es un hex de 6 dígitos: "${limpio}"`);
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** Luminancia relativa WCAG 2.x: canales sRGB a lineal y la media ponderada. */
function luminancia(hex: string): number {
  const [r, g, b] = hexARgb(hex).map((c) => {
    const s = c / 255;
    return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Ratio de contraste WCAG: 1 para el mismo color, 21 para blanco sobre negro. */
function ratio(foreground: string, background: string): number {
  const a = luminancia(foreground);
  const b = luminancia(background);
  const [claro, oscuro] = a > b ? [a, b] : [b, a];
  return (claro + 0.05) / (oscuro + 0.05);
}

const AA_NORMAL = 4.5;

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * El mensaje del fallo lleva los dos colores y la cifra. Un `expected >= 4.5`
 * a secas no dice cuál de los dos hex es el culpable ni cuánto le falta, y para
 * corregir un token hay que saber eso.
 */
function medir(
  nombreToken: string,
  nombreFondo: string,
  paleta: (typeof TODAS_LAS_PALETAS)[number]
): { token: string; fondo: string; ratio: number } {
  const texto = token(PALETAS[paleta], nombreToken);
  const fondo = token(PALETAS[paleta], nombreFondo);
  if (!texto || !fondo || !/^#[0-9a-f]{6}$/i.test(texto) || !/^#[0-9a-f]{6}$/i.test(fondo)) {
    throw new Error(
      `Falta ${nombreToken} o ${nombreFondo} en la paleta "${paleta}": ` +
        `${nombreToken}=${texto} ${nombreFondo}=${fondo}`
    );
  }
  return { token: texto, fondo, ratio: round2(ratio(texto, fondo)) };
}

describe("contraste de los colores de estado", () => {
  it.each(TODAS_LAS_PALETAS)("--danger está declarado en la paleta %s", (paleta) => {
    // Un token declarado sólo en `:root` no llega a tema claro. Es el mismo
    // defecto por el otro lado: el color correcto que nunca se pinta.
    expect(token(PALETAS[paleta], "danger")).toMatch(/^#[0-9a-f]{6}$/i);
  });

  it.each(TOKENS_DE_ESTADO)("--%s pasa AA sobre --surface y --bg en los tres temas", (nombre) => {
    for (const paleta of TODAS_LAS_PALETAS) {
      for (const fondo of FONDOS) {
        const m = medir(nombre, fondo, paleta);
        if (m.ratio < AA_NORMAL) {
          throw new Error(
            `Contraste insuficiente: --${nombre} = ${m.token} sobre --${fondo} (${m.fondo}) ` +
              `en la paleta "${paleta}" da ${m.ratio}:1 y AA pide ${AA_NORMAL}:1`
          );
        }
      }
    }
  });

  it("el tema claro dice lo mismo por selector y por media query", () => {
    // Si divergen, quien elige tema a mano y quien no ve colores distintos. Es
    // una línea duplicada en el CSS y un bug entero en producción.
    expect(token(PALETAS.claroExplicito, "danger")).toBe(token(PALETAS.claroMedia, "danger"));
  });

  it("el color de estado no se toca con la estación", () => {
    // Los overrides de `[data-accent="…"]` tocan `--accent` para que el rojo de
    // marca siga siendo legible. `--danger` no se toca a propósito: "Cancelado"
    // es un estado, y un estado que se pone verde en verano deja de leerse como
    // estado.
    const bloquesEstacion = CSS.match(/:root\[data-accent="[^"]+"\][^{]*\{[^}]*\}/g) ?? [];
    expect(bloquesEstacion.length).toBeGreaterThan(0);
    expect(bloquesEstacion.filter((b) => /--danger\s*:/.test(b))).toEqual([]);
  });

  it("ningún componente pinta estado con la escala roja de Tailwind en crudo", () => {
    // `text-red-500` es `#EF4444`, que sobre `--surface` claro da 3,62:1. Es el
    // valor que originó el defecto, y el que volvería a colarse sin que el test
    // de ratios se enterase: el ratio se mide sobre el token, no sobre la clase.
    // Esta comprobación es la que cierra ese hueco.
    const ficheros = globSync(join(ROOT, "app", "components", "*.tsx"));
    expect(ficheros.length).toBeGreaterThan(0);
    const infractores = ficheros
      .map((f) => [f.slice(ROOT.length + 1).replace(/\\/g, "/"), readFileSync(f, "utf8")] as const)
      .filter(([, fuente]) => /(?:text|bg|border|ring|from|to|via)-red-\d/.test(fuente))
      .map(([fichero]) => fichero);
    expect(infractores).toEqual([]);
  });
});
