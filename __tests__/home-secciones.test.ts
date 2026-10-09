import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Las secciones de la home y el orden en que salen.
 *
 * **Por qué un test que lee el fichero y no uno que pinta la página.** La home son
 * 408 líneas con catorce `Suspense`, cada uno con su esqueleto, y sus componentes
 * arrastran `next/image`, scroll horizontal y animación de entrada. Un test que la
 * pintara se ataría a todo eso a la vez y se pondría rojo cada vez que se tocara un
 * color o un tamaño de tarjeta, que es lo contrario de un test útil.
 *
 * Lo que importa aquí es una cosa más pequeña y que sí se rompe: **qué secciones hay y
 * en qué orden**. Ese es el invariante, y un fichero de texto lo comprueba sin
 * arrastrar nada.
 *
 * Es el mismo enfoque que `__tests__/colores-a-mano.test.ts` y
 * `__tests__/source-data.test.ts`: leer el código para fijar una regla de composición
 * que ningún test de comportamiento va a detectar.
 */

const PAGINA = join(process.cwd(), "app", "page.tsx");

function fuente(): string {
  return readFileSync(PAGINA, "utf8");
}

/** La posición de la primera aparición de un texto, o -1. */
function en(texto: string, aguja: string): number {
  return texto.indexOf(aguja);
}

describe("la composición de la home", () => {
  it("ya no pinta el teaser de hoy, que era los mismos 35 eventos dos veces", () => {
    // **Medido en producción el 9 de octubre de 2026.** `Hoy en Gasteiz` y
    // `Próximos 7 días` tenían exactamente los mismos 35 eventos: el primero en un
    // carrusel horizontal de 222 px y el segundo en una rejilla de 3.845 px. Cuarenta
    // y dos eventos únicos en toda la página, treinta y cinco de ellos repetidos.
    //
    // Y el teaser era el peor de los dos: `TodayStrip` ocultaba la barra de scroll
    // con `scrollbar-none`, así que lo único que indicaba que se podía arrastrar era
    // la tarjeta que quedaba cortada.
    //
    // **Se mira el uso y no la mención**: el comentario que explica por qué se quitó
    // tiene que poder decir `TodayStrip`, y un `not.toMatch(/TodayStrip/)` lo
    // prohíbe. Lo que no puede volver es el import o el elemento en el JSX.
    expect(fuente()).not.toMatch(/^\s*import .*TodayStrip/m);
    expect(fuente()).not.toMatch(/<TodayStrip/);
    expect(fuente()).not.toMatch(/<TodayWithData/);
    expect(fuente()).not.toMatch(/function TodayWithData/);
  });

  it("el componente del teaser se borra del repo, no solo deja de pintarse", () => {
    // Si el fichero se queda, el siguiente que llegue lo reutiliza sin saber que era
    // el duplicado, y la sección vuelve dos meses después.
    expect(() =>
      readFileSync(join(process.cwd(), "app", "components", "TodayStrip.tsx"), "utf8")
    ).toThrow();
  });

  it("los recomendados salen antes que la lista cruda del día", () => {
    // Esto es consecuencia directa de quitar el teaser, no una mejora aparte.
    //
    // Antes el orden era: teaser (35) → rejilla del día (35) → recomendados (10), y
    // el riel curado quedaba **después** de tres mil píxeles de lista cruda. Al quitar
    // el teaser, losbx10untar el riel donde estaba deja el día en una jerarquía clara:
    // primero lo que el sitio recomienda, después todo lo que hay.
    //
    // Y es el mismo criterio que el post de Instagram: `recomendados` es el selector
    // que usan los dos.
    const recomendados = en(fuente(), "<TopWithData />");
    const dia = en(fuente(), "<NextDaysWithData />");

    expect(recomendados).toBeGreaterThan(-1);
    expect(dia).toBeGreaterThan(-1);
    expect(recomendados).toBeLessThan(dia);
  });

  it("ninguna sección con eventos se pinta dos veces", () => {
    // El fallo general era la repetición: hoy salía en tres secciones. Este test no
    // comprueba qué secciones hay —eso es una decisión de diseño que cambia— sino que
    // no se pinte dos veces la misma, que siempre es un error.
    const usos = [...fuente().matchAll(/<Suspense[^>]*>\s*<([A-Z][A-Za-z]*)WithData\s*\/>/g)].map(
      (m) => m[1]
    );
    const repetidos = usos.filter((u, i) => usos.indexOf(u) !== i);

    expect(repetidos).toEqual([]);
  });
});