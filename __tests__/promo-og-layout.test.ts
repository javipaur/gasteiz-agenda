import { readFileSync } from "node:fs";
import { join } from "node:path";
import ts from "typescript";

/**
 * Las tres rutas de imágenes del promo compartían un fallo que nadie vio.
 *
 * Satori —el renderizador de `next/og`— exige que todo `<div>` con más de un hijo declare
 * `display: flex`, `display: contents` o `display: none`. Si no, la respuesta se corta a
 * mitad y el cliente recibe un **502 sin cuerpo y casi sin rastro en el log**: el fallo
 * ocurre dentro del stream, después de que las cabeceras ya han salido.
 *
 * Lo que lo escondía era una combinación de dos cosas:
 *
 * - **Ningún test las renderizaba.** Los tests de `/api/promo/*` comprueban `status` y
 *   `content-type`. `ImageResponse` es perezoso: el render ocurre al leer el cuerpo, así
 *   que un test que nunca lee el cuerpo no puede fallar. Los tres tests pasaban con las
 *   tres rotas.
 * - **`next build` tampoco las tocaba.** `/api/promo/[fecha]/portada` y
 *   `/api/promo/[fecha]/evento/[slug]` son dinámicas y no se prerenderizan; la
 *   `/api/promo/presentacion` sí es estática, y por eso el fallo equivalente de aquella
 *   apareció en el build mientras que estas dos llevan desde octubre fallen en producción.
 *
 * El aviso de Satori es más general que «pon display»: también salta cuando un `<div>`
 * tiene un solo hijo pero ese hijo es un ternario que puede devolver **un número o una
 * cadena**, porque para él son dos tipos de nodo. Por eso hay dos reglas, y por eso los dos
 * fallos que hubo que arreglar eran distintos.
 *
 * Ninguno de los dos es un problema de este repo: es el fallo de Satori más habitual al
 * escribir JSX a mano. Por eso el test no mira las cabeceras, sino el árbol.
 */

const RUTAS_IMAGEN = [
  "app/api/promo/presentacion/route.tsx",
  "app/api/promo/[fecha]/portada/route.tsx",
  "app/api/promo/[fecha]/evento/[slug]/route.tsx",
];

/** Un `<div>` con estos `display` es válido con cualquier número de hijos. */
const DISPLAY_ACEPTADOS = new Set(["flex", "contents", "none"]);

/**
 * Cuenta los hijos reales de un elemento JSX.
 *
 * Importa el detalle que hace fallar la regla: el espacio entre `{day} {month}` **es un
 * hijo**, igual que el salto de línea entre dos `<div>`. JSX descarta los `JsxText` que
 * son solo espacios, y es lo único que se descarta aquí.
 */
function contarHijos(nodos: ts.NodeArray<ts.JsxChild>): number {
  let hijos = 0;

  for (const nodo of nodos) {
    if (ts.isJsxText(nodo)) {
      if (nodo.text.trim() !== "") hijos += 1;
      continue;
    }
    if (ts.isJsxExpression(nodo)) {
      // `{/* comentario */}` no produce nada.
      if (!nodo.expression) continue;
      if (ts.isJsxExpression(nodo.expression) && !nodo.expression.expression) continue;
      hijos += 1;
      continue;
    }
    hijos += 1;
  }

  return hijos;
}

/** Lee el `display` declarado en el `style={{ ... }}` de un elemento, si lo hay. */
function displayDeclarado(nodo: ts.JsxElement): string | null {
  for (const atributo of nodo.openingElement.attributes.properties) {
    if (!ts.isJsxAttribute(atributo)) continue;
    if (ts.isJsxNamespacedName(atributo.name) || atributo.name.text !== "style") continue;

    const expr = atributo.initializer;
    if (!expr || !ts.isJsxExpression(expr) || !expr.expression) return null;

    // `style={{ ... }}` da un `ObjectLiteralExpression` **directo**: los dos llaves son
    // el contenedor JSX y el objeto, no un paréntesis. Se acepta también el envoltorio
    // por si alguien escribe `style={({ ... })}`.
    const objeto = ts.isParenthesizedExpression(expr.expression)
      ? expr.expression.expression
      : expr.expression;
    if (!ts.isObjectLiteralExpression(objeto)) return null;

    for (const propiedad of objeto.properties) {
      if (!ts.isPropertyAssignment(propiedad)) continue;
      if (propiedad.name.getText() !== "display") continue;
      if (ts.isStringLiteral(propiedad.initializer)) return propiedad.initializer.text;
    }
  }

  return null;
}

/**
 * Una rama de ternario es segura si no pinta nada (`null`) o si pinta **elementos**.
 * Devolver texto, un número o una interpolación es justo lo que Satori descompone en
 * varios hijos.
 */
function ramaSegura(rama: ts.Expression): boolean {
  // El paréntesis es solo agrupación: `cond ? (<img />) : null` es igual de seguro que
  // `cond ? <img /> : null`, y como está partido en dos líneas es la forma habitual de
  // escribirlo aquí.
  const plano = ts.isParenthesizedExpression(rama) ? rama.expression : rama;
  if (plano.kind === ts.SyntaxKind.NullKeyword) return true;
  return (
    ts.isJsxElement(plano) || ts.isJsxSelfClosingElement(plano) || ts.isJsxFragment(plano)
  );
}

/** Devuelve un mensaje por cada construcción que Satori va a rechazar. */
function auditar(codigo: string, ruta: string): string[] {
  const fuente = ts.createSourceFile(
    ruta,
    codigo,
    ts.ScriptTarget.ESNext,
    true,
    ts.ScriptKind.TSX
  );
  const problemas: string[] = [];
  const linea = (nodo: ts.Node): number =>
    fuente.getLineAndCharacterOfPosition(nodo.getStart()).line + 1;

  const visitar = (nodo: ts.Node): void => {
    // Regla 1: `<div>` con más de un hijo y sin `display` válido.
    if (ts.isJsxElement(nodo) && nodo.openingElement.tagName.getText() === "div") {
      const hijos = contarHijos(nodo.children);
      const display = displayDeclarado(nodo);

      if (hijos > 1 && (display === null || !DISPLAY_ACEPTADOS.has(display))) {
        problemas.push(
          `${ruta}:${linea(nodo)} — <div> con ${hijos} hijos y ` +
            `${display === null ? "sin display" : `display: "${display}"`}`
        );
      }
    }

    // Regla 2: ternario inline en el JSX que devuelva valores sueltos.
    if (ts.isJsxExpression(nodo) && nodo.expression) {
      const expr = ts.isParenthesizedExpression(nodo.expression)
        ? nodo.expression.expression
        : nodo.expression;

      if (ts.isConditionalExpression(expr)) {
        const inseguras = [expr.whenTrue, expr.whenFalse].filter((r) => !ramaSegura(r));
        if (inseguras.length > 0) {
          problemas.push(
            `${ruta}:${linea(nodo)} — ternario en el JSX que devuelve ` +
              `${inseguras.length === 2 ? "número o cadena" : "texto"}; ` +
              `calcúlalo antes y píntalo como interpolación`
          );
        }
      }
    }

    ts.forEachChild(nodo, visitar);
  };

  ts.forEachChild(fuente, visitar);
  return problemas;
}

describe("layout JSX de las imágenes de promo (reglas de Satori)", () => {
  // **Primero los dientes del detector.** Sin esto, el bloque de abajo pasaría igual con un
  // checker vacío, que es la forma habitual en que un test de este tipo se vuelve decorativo.
  // Los dos casos son los fallos reales que exitieron en producción.
  describe("detecta los fallos reales que hubo en producción", () => {
    it("marca un ternario que puede devolver número o cadena", () => {
      const codigo = `export function F({ lista }: { lista: string[] }) {
        return (
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ fontSize: 190, lineHeight: 1 }}>
              {lista.length > 0 ? lista.length : "—"}
            </div>
          </div>
        );
      }`;
      const problemas = auditar(codigo, "ternario.tsx");
      expect(problemas).toHaveLength(1);
      expect(problemas[0]).toMatch(/ternario en el JSX/);
    });

    it("marca dos interpolaciones separadas por un espacio", () => {
      const codigo = `export function F({ day, month }: { day: string; month: string }) {
        return (
          <div style={{ display: "flex", fontSize: 30 }}>
            <div style={{ marginRight: 24 }}>{day} {month}</div>
          </div>
        );
      }`;
      // El recuento sale en 2 y no en 3: TypeScript deja el espacio pegado al texto del
      // primer hijo, así que los nodos son `{day}` y `" {month}"`. Lo que importa es que
      // son más de uno, y eso es lo que dispara el aviso de Satori.
      const problemas = auditar(codigo, "dos-interpolaciones.tsx");
      expect(problemas).toHaveLength(1);
      expect(problemas[0]).toMatch(/<div> con 2 hijos y sin display/);
    });

    it("deja pasar el ternario que solo alterna elementos y null", () => {
      const codigo = `export function F({ a }: { a: boolean }) {
        return (
          <div style={{ display: "flex" }}>
            {a ? <div style={{ fontSize: 20 }}>hola</div> : null}
          </div>
        );
      }`;
      expect(auditar(codigo, "elementos.tsx")).toEqual([]);
    });

    it("no se dispara con un solo hijo, ni con display válido, ni con whitespace", () => {
      const codigo = `export function F({ a }: { a: string }) {
        return (
          <div style={{ display: "flex" }}>
            <div style={{ fontSize: 20 }}>
              {a}
            </div>
            <div style={{ display: "contents" }}>texto</div>
            <div style={{ display: "none" }}>{a}</div>
          </div>
        );
      }`;
      expect(auditar(codigo, "sano.tsx")).toEqual([]);
    });
  });

  it("ninguna de las tres rutas tiene una construcción que Satori vaya a rechazar", () => {
    const problemas = RUTAS_IMAGEN.flatMap((ruta) =>
      auditar(readFileSync(join(process.cwd(), ruta), "utf8"), ruta)
    );
    expect(problemas).toEqual([]);
  });
});