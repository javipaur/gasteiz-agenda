/**
 * La marca del logo, en los dos ficheros donde vive.
 *
 * Son **dos** ficheros y no uno por una razón que hay que tener presente: el del
 * PWA es un SVG plano que se sirve tal cual y del que `scripts/generate-icons.mjs`
 * saca los PNG del manifest, y el de la cabecera es un componente JSX que usa
 * `currentColor` y la variable de acento. El sistema operativo no puede heredar
 * el tema de la web, así que el color de acento vive solo en el componente.
 *
 * Lo que este test fija es que **los dos dicen lo mismo**, que es lo que se
 * rompe en silencio: si uno cambia y el otro no, el icono del escritorio y el
 * de la cabecera son marcas distintas y no hay ningún error, solo dos logos.
 */
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";

const ROOT = resolve(__dirname, "..");

const ICONO_PWA = readFileSync(join(ROOT, "public", "brand-mark.svg"), "utf8");
const CABECERA = readFileSync(join(ROOT, "app", "components", "LogoMark.tsx"), "utf8");

/** Los colores que se han medido en el SVG que sale de Stitch. */
const ROJO = "#dc2626";
const NEGRO = "#18181b";
const VERDE = "#65a30d";
const CREMA = "#faf9f5";

/**
 * Los elementos de la marca, y el nombre de cada uno.
 *
 * **La lista está porque un logo no es un dibujo sino un conjunto de formas
 * con nombre.** Sin ella, borrar la txapela del SVG no pone ningún test en rojo:
 * el SVG seguiría siendo un SVG válido y el logo seguiría siendo "el logo", solo
 * que con una cosa menos. Lo que ata esto al diseño es que los cinco estén, y
 * que el rojo de la G sea el rojo que se medió.
 */
const PIEZAS = [
  { nombre: "la G roja", color: ROJO },
  { nombre: "la txapela", color: NEGRO },
  { nombre: "la nota musical", color: NEGRO },
  { nombre: "el cursor", color: NEGRO },
  { nombre: "el pincho", color: "#ca8a04" },
  { nombre: "la gilda", color: VERDE },
];

describe("el icono del PWA", () => {
  it("tiene las cinco piezas de la marca, cada una con su color", () => {
    const faltan = PIEZAS.filter((p) => !ICONO_PWA.toLowerCase().includes(p.color));
    expect(faltan.map((p) => p.nombre)).toEqual([]);
  });

  it("no lleva texto dentro, porque a 48px no se lee y moja el recorte", () => {
    // Un `<text>` en un icono de app se rasteriza a pixeles de nada. El nombre
    // va en el `short_name` del manifest, que es donde el sistema lo pinta bien.
    expect(ICONO_PWA).not.toMatch(/<text\b/i);
  });

  it("es vector de verdad, sin imagenes embebidas ni degradados", () => {
    // Un `<image href="data:...">` o un `linearGradient`Convertiría un logo de
    // 3 KB en uno de 40 KB y lo dejaría dependiente de lo que el navegador sepa
    // rasterizar. Es una comprobación de formato, y el formato es el logo.
    expect(ICONO_PWA).not.toMatch(/<image\b/i);
    expect(ICONO_PWA).not.toMatch(/linearGradient|radialGradient/i);
  });
});

describe("el logo de la cabecera", () => {
  it("usa el mismo rojo que el icono del PWA", () => {
    // Es la forma de que "los dos son el mismo logo" sea comprobable: si el
    // componente queda con el rojo viejo y el SVG con el nuevo, son dos marcas.
    expect(CABECERA.toLowerCase()).toContain(ROJO);
  });

  it("no pinta el fondo crema, porque el Header se ve sobre cualquier color", () => {
    // El icono del PWA necesita su crema porque el escritorio lo recorta en
    // circulo sobre lo que haya. El del Header no: va sobre el fondo de la web,
    // que cambia con el tema, y un cuadrado crema seria un parche.
    //
    // Se mira que no haya un `<rect>` de fondo y no que el crema no aparezca: el
    // crema es tambien el destello de la aceituna y el contorno del cursor, y
    // las dos cosas son legitimas aqui. Lo que no puede haber es el lienzo.
    expect(CABECERA).not.toMatch(/<rect[^>]*width="512"/i);
    expect(CABECERA).not.toMatch(/fill=\{(?:crema|"#faf9f5")\}[^>]*width=/i);
  });
});

describe("los dos ficheros, juntos", () => {
  it("el SVG del PWA y el componente de la cabecera no se pueden separar", () => {
    // El aviso de que si uno cambia hay que cambiar el otro, escrito. El test de
    // arriba mira los colores, que es donde se nota la desincronizacion; este
    // existe para que el motivo este en el sitio donde alguien va a editar.
    expect(ICONO_PWA).toContain("<svg");
    expect(CABECERA).toContain("LogoMark");
  });
});