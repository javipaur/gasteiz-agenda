/**
 * El script de tema del `<head>`, y los tres estados que puede tener.
 *
 * Este script decide la paleta antes de que hidrate, y por eso va en el
 * `<head>` y no en un componente: si se moviera, la página daría un flash del
 * tema contrario en cada carga.
 *
 * Lo que fija son **tres** estados, y confundirlos es lo que rompió el botón
 * "Tema del sistema":
 *
 * - `"dark"` / `"light"`: lo que eligió la persona. Se aplica tal cual.
 * - `"auto"`: lo que marque el sistema. **Sin atributo**, que es lo que deja
 *   que la media query de `globals.css` decida.
 * - Nada guardado: el valor por defecto del sitio, que es claro.
 *
 * El defecto ("nada guardado") y el "auto" del sistema son cosas distintas y
 * necesitan estados guardados distintos. Con una sola clave, o una de las dos
 * se pierde: antes se borraba la clave al elegir "auto", y eso hacía que
 * "auto" y "nunca he elegido" fueran lo mismo.
 *
 * El test corre el script **de verdad**, con el mismo código que va al
 * navegador, y un `document` de mentira. Un test que leyera el código y
 * comprobara una cadena comprobaría que la cadena está, no que el script hace
 * lo que dice.
 */

import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";

const ROOT = resolve(__dirname, "..");
const LAYOUT = readFileSync(join(ROOT, "app", "layout.tsx"), "utf8");
const TOGGLE = readFileSync(join(ROOT, "app", "components", "ThemeToggle.tsx"), "utf8");

/** Saca el script inline del `<head>`, que es el que se ejecuta. */
function sacarScript(): string {
  const m = LAYOUT.match(/__html:\s*`([\s\S]*?)`/);
  if (!m) throw new Error("No se encuentra el script de tema en app/layout.tsx");
  return m[1];
}

/**
 * Ejecuta el script con un navegador de mentira y devuelve el atributo
 * `data-theme` que queda puesto, o `null` si no hay ninguno.
 */
function ejecutar(
  guardado: string | null,
  sistemaOscuro: boolean
): string | null {
  const atributos: Record<string, string> = {};
  const almacen: Record<string, string> = {};
  if (guardado !== null) almacen["gasteiz-theme"] = guardado;

  const documento = {
    documentElement: {
      get dataset() {
        return {
          get theme() {
            return atributos["data-theme"];
          },
          set theme(v: string) {
            atributos["data-theme"] = v;
          },
        };
      },
      setAttribute(nombre: string, valor: string) {
        atributos[nombre] = valor;
      },
      removeAttribute(nombre: string) {
        delete atributos[nombre];
      },
    },
  };

  const ventana = {
    matchMedia: () => ({ matches: sistemaOscuro, addEventListener: () => {} }),
    addEventListener: () => {},
  };

  const localStorage = {
    getItem: (k: string) => (k in almacen ? almacen[k] : null),
    setItem: (k: string, v: string) => {
      almacen[k] = v;
    },
    removeItem: (k: string) => {
      delete almacen[k];
    },
  };

  new Function("window", "document", "localStorage", sacarScript())(
    ventana,
    documento,
    localStorage
  );

  return atributos["data-theme"] ?? null;
}

describe("el script de tema", () => {
  it("sin nada guardado, el sitio sale en claro", () => {
    // El valor por defecto del sitio, decidido al rehacer la paleta. Y es el
    // mismo con el sistema en claro que en oscuro: el sistema **no** decide
    // por su cuenta, se decide al elegir "Tema del sistema".
    expect(ejecutar(null, false)).toBe("light");
    expect(ejecutar(null, true)).toBe("light");
  });

  it("una elección explícita gana", () => {
    expect(ejecutar("dark", false)).toBe("dark");
    expect(ejecutar("light", true)).toBe("light");
  });

  it("con \"auto\" no se pone atributo, y decide el CSS", () => {
    // Sin atributo, la media query de `globals.css` —`:root:not([data-theme="dark"])`—
    // es la que aplica, y con ella el sistema. Un atributo "dark" o "light"
    // puesto aquí dejaría el "auto" sin efecto.
    expect(ejecutar("auto", true)).toBeNull();
    expect(ejecutar("auto", false)).toBeNull();
  });
});

describe("el ThemeToggle", () => {
  it("guarda la elección, también la de \"auto\"", () => {
    // Antes "auto" **borraba** la clave. Eso hacía que "auto" y "nunca he
    // elegido" fueran el mismo estado, y la elección se perdía al recargar.
    expect(TOGGLE).not.toContain('localStorage.removeItem(KEY)');
    expect(TOGGLE).toContain("localStorage.setItem(KEY, next)");
  });

  it("\"auto\" quita el atributo en vez de dejar uno vacío", () => {
    // `dataset.theme = ""` deja un atributo vacío, que sigue casando con
    // `:root:not([data-theme="dark"])`: la regla del "auto" quedaría atada al
    // tema claro para siempre.
    expect(TOGGLE).toContain('removeAttribute("data-theme")');
  });

  it("lo que no ha elegido nadie es el tema claro, no \"auto\"", () => {
    // El botón decía "Tema del sistema" mientras la página estaba en claro.
    // El control mentía.
    expect(TOGGLE).toMatch(/return "light";/);
  });
});
