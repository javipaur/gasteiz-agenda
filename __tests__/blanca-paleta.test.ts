import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";

/**
 * La Blanca tenía dos paletas con el mismo nombre y `mapFiestaToCard` duplicado
 * entero.
 *
 * El síntoma era de contenido, no de estilo: cuatro categorías —Vaquillas,
 * Fuegos, Teatro y Humor— sólo existían en la paleta de la página, así que en la
 * home caían al gris por defecto de `CATEGORY_COLORS`. La misma fiesta se veía de
 * un color en `/fiestas-blanca` y de otro en la home, según dónde se mirara. Y la
 * duplicación de `mapFiestaToCard` era la parte peor: dos funciones que deberían
 * producir la misma tarjeta, divergiendo sin que nada lo comprobara.
 *
 * Se comprueba leyendo los dos ficheros en vez de importarlos porque el defecto
 * es precisamente que había **dos** definiciones: importar sólo una daría verde
 * con la otra duplicada intacta.
 */

const ROOT = resolve(__dirname, "..");
const FUENTES = [
  "app/components/FiestasBlancaSection.tsx",
  "app/components/FiestasBlancaPageClient.tsx",
] as const;

/** El módulo donde tienen que estar las dos cosas, y sólo una vez. */
const FUENTE_UNICA = "app/components/blanca.ts";

function texto(fichero: string): string {
  return readFileSync(join(ROOT, fichero), "utf8");
}

describe("la paleta de La Blanca tiene una sola fuente", () => {
  it("ninguno de los dos componentes declara BLANCA_COLORS ni mapFiestaToCard", () => {
    // Se busca la **declaración**, no el nombre: los dos importan las dos cosas
    // desde la fuente única y ese import es justo lo que se quiere. Lo que no
    // puede volver es una segunda copia definida aquí.
    const infractores = FUENTES.filter((f) =>
      /const\s+BLANCA_COLORS|function\s+mapFiestaToCard/.test(texto(f))
    );
    expect(infractores).toEqual([]);
  });

  it("la fuente única existe y exporta las dos cosas", () => {
    const fuente = texto(FUENTE_UNICA);
    expect(fuente).toMatch(/export const BLANCA_COLORS/);
    expect(fuente).toMatch(/export function mapFiestaToCard/);
  });

  it.each(FUENTES)("%s usa la fuente única", (fichero) => {
    const fuente = texto(fichero);
    // Importar en vez de re-declarar: es lo que impide que vuelvan a separarse.
    expect(fuente).toMatch(new RegExp(`from "[^"]*blanca"`));
  });

  it("la paleta cubre las categorías que sólo tenía la página", () => {
    // Estas cuatro son las que caían al gris en la home. Si alguien las quita de
    // la fuente única, el fallo vuelve exactamente como estaba.
    const fuente = texto(FUENTE_UNICA);
    for (const categoria of ["Vaquillas", "Fuegos", "Teatro", "Humor"]) {
      expect({ categoria, declarada: new RegExp(`\\b${categoria}:`).test(fuente) }).toEqual({
        categoria,
        declarada: true,
      });
    }
  });

  it("la paleta hereda las 15 categorías de `CATEGORY_COLORS`", () => {
    // Sin el spread, cualquier categoría nueva de la taxonomía se queda sin
    // color: no falla, sale el gris por defecto.
    const fuente = texto(FUENTE_UNICA);
    expect(fuente).toMatch(/\.\.\.CATEGORY_COLORS/);
  });

  it("cada entrada de la paleta es un hex de seis dígitos", () => {
    // `CATEGORY_COLORS` sí son hex; estas son propias y es donde se cuela un
    // `#fff` o un nombre de color que después no se puede medir.
    const fuente = texto(FUENTE_UNICA);
    const bloque = fuente.match(/BLANCA_COLORS[^=]*=\s*\{([\s\S]*?)\n\};/)?.[1] ?? "";
    const valores = [...bloque.matchAll(/:\s*"([^"]+)"/g)].map((m) => m[1]);
    expect(valores.length).toBeGreaterThan(0);
    expect(valores.filter((v) => !/^#[0-9a-f]{6}$/i.test(v))).toEqual([]);
  });
});
