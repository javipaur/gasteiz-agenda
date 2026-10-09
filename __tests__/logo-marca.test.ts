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

/**
 * Los iconos que se instalan de verdad, que nadie miraba.
 *
 * **La marca vive en cuatro ficheros y el test cubría dos.** `generate-icons.mjs`
 * lee `icon-512.svg` y `icon-maskable.svg`, no `brand-mark.svg`, así que los dos que
 * se acaban convirtiendo en PNG —192, 512 y apple-touch— no tenían ninguna paridad
 * comprobada. Y el comentario de `brand-mark.svg` decía que de ahí salían los PNG,
 * que es falso.
 *
 * Estos tres tests no miran que se parezcan, que sería comparar trazados y se
 * pondría rojo por cualquier retoque. Mueven lo único que importa a esta distancia:
 * que lleven la misma paleta y el mismo número de piezas.
 */
describe("los iconos que se instalan", () => {
  const ICONO_512 = readFileSync(join(ROOT, "public", "icon-512.svg"), "utf8");
  const MASKABLE = readFileSync(join(ROOT, "public", "icon-maskable.svg"), "utf8");

  it("los dos llevan la paleta de la marca", () => {
    for (const color of [ROJO, NEGRO, VERDE, CREMA]) {
      expect(ICONO_512.toLowerCase()).toContain(color);
      expect(MASKABLE.toLowerCase()).toContain(color);
    }
  });

  it("los dos llevan las mismas piezas que la marca completa", () => {
    // El listado de `PIEZAS` no mira formas sino colores, y aquí sirve igual: si uno de
    // los dos iconos perdiera una pieza, perdería su color, y el rojo o el verde
    // sobrarían en un icono al que ya no le sirven.
    const faltan512 = PIEZAS.filter((p) => !ICONO_512.toLowerCase().includes(p.color));
    const faltanMaskable = PIEZAS.filter((p) => !MASKABLE.toLowerCase().includes(p.color));

    expect(faltan512.map((p) => p.nombre)).toEqual([]);
    expect(faltanMaskable.map((p) => p.nombre)).toEqual([]);
  });

  it("el comentario de brand-mark.svg dice de dónde salen los PNG, y dice la verdad", () => {
    // El comentario mentía: `generate-icons.mjs` abre `icon-512.svg` y
    // `icon-maskable.svg`. Es el mismo modo de fallo que el test de arriba, un
    // comentario que describe una regla que ya no existe.
    const generador = readFileSync(join(ROOT, "scripts", "generate-icons.mjs"), "utf8");

    expect(generador).toContain("icon-512.svg");
    expect(generador).toContain("icon-maskable.svg");
    expect(generador).not.toContain("brand-mark.svg");
    expect(ICONO_PWA).not.toMatch(/generate-icons[^\n]*de aquí/);
  });
});

/**
 * La variante reducida, que es lo que se ve a 24 px.
 *
 * **Medido, no supuesto.** La marca completa rasterizada: a 16 px no sobrevive nada,
 * a 24 px —que es exactamente el tamaño que la usa `Header.tsx`— solo quedan la G,
 * la txapela y la raya del pincho, y a 96 px están las seis piezas. **Cuatro de seis
 * son ruido a la taille en la que se pintaba.**
 *
 * El recorte circular de Instagram **no** se lleva nada —también medido, aplicando un
 * `dest-in` circular al SVG— así que el problema no era el recorte sino el tamaño.
 *
 * Y no es un logo nuevo: el icono del PWA, que se ve a 192 y 512 px, sigue siendo el
 * completo, porque allí las seis piezas sí se leen. Por eso son dos ficheros y no uno.
 */
describe("el encuadre, que es donde estaba el bug", () => {
  /**
   * **Las tres copias de la marca tienen que dibujar en el centro de su lienzo.**
   *
   * Las piezas van colocadas alrededor del origen —`M 85 -85`, `translate(108, 18)`,
   * `translate(-38, -120)`— y el `viewBox` de las cuatro es el cuadrado entero, así
   * que hace falta un `translate(256, 256)` que las lleve al centro. Sin él, la marca
   * se pinta pegada a la esquina superior izquierda y de las 512×512 del lienzo solo
   * se ve el cuadrante de abajo a la derecha.
   *
   * **`LogoMark.tsx` no lo tenía, y por eso el logo de la cabecera no se parecía al
   * del icono de la pantalla de inicio.** No era que el de la web tuviera más
   * detalle: era que estaba encuadrado distinto, y recortado. Los tests de arriba
   * miraban el color de cada pieza y no lo cazaron, porque el color estaba donde
   * tocaba aunque el dibujo no estuviera centrado.
   *
   * Es el mismo motivo por el que `app/hoy/page.tsx` no lleva su propio `pt`: una
   * propiedad de colocación que nadie mira y que solo se ve en la pantalla.
   */
  const COPIAS = [
    ["app/components/LogoMark.tsx", "app", "components", "LogoMark.tsx"],
    ["app/components/LogoMarkReducido.tsx", "app", "components", "LogoMarkReducido.tsx"],
    ["public/brand-mark.svg", "public", "brand-mark.svg"],
    ["public/icon-512.svg", "public", "icon-512.svg"],
    ["public/icon-maskable.svg", "public", "icon-maskable.svg"],
  ] as const;

  it("las cinco llevan el grupo que centra la marca", () => {
    // Con coma o sin ella, y con escala o sin ella: `icon-512.svg` y
    // `icon-maskable.svg` reducen la marca al 87% y al 72% porque el sistema aplica
    // su propia máscara encima, y eso es correcto. Lo que no puede faltar es el
    // traslado al centro, y ese es el que se mira.
    //
    // La coma es opcional **y el espacio también**: los tres JSX y `brand-mark.svg`
    // escriben `translate(256, 256)` con coma y espacio, y los dos iconos escriben
    // `translate(256 256)` sin coma. Un `[, ]` en vez de `,?\s*` acepta un carácter y
    // no los dos, y hace que la prueba no-case con ninguno de los cinco.
    const sinCentrar = COPIAS.filter(
      ([, ...partes]) =>
        !/translate\(256,?\s*256\)/.test(readFileSync(join(ROOT, ...partes), "utf8"))
    ).map(([nombre]) => nombre);

    expect(sinCentrar).toEqual([]);
  });

  it("ninguna dibuja fuera del lienzo sin querer", () => {
    // El complemento del anterior: que la marca no se salga del `viewBox`. Con el
    // grupo puesto, las piezas más extremas llegan a 182 del centro, muy dentro del
    // disco inscrito de 256. Si un día se mueve una pieza, esto avisa.
    for (const [, ...partes] of COPIAS) {
      const fuente = readFileSync(join(ROOT, ...partes), "utf8");
      const radio = Math.max(
        ...[...fuente.matchAll(/(?:M|x1|x2|cx|cy)\s*[=]?\s*(-?\d{2,3})/g)].map((m) =>
          Math.abs(Number(m[1]))
        )
      );

      expect(radio).toBeLessThanOrEqual(256);
    }
  });
});

describe("la variante reducida", () => {
  const REDUCIDO = readFileSync(
    join(ROOT, "app", "components", "LogoMarkReducido.tsx"),
    "utf8"
  );

  it("se queda con la G, la txapela y el pincho", () => {
    // Las tres que sobreviven a 32 px. La txapela es lo que hace que sea de aquí y
    // el pincho en diagonal es la silueta: es lo único que distingue esta G roja de
    // las otras mil.
    expect(REDUCIDO).toContain("translate(-38, -120)");
    expect(REDUCIDO).toMatch(/<line[^>]*stroke=/);
  });

  it("fuera la nota, la gilda y el cursor, que a ese tamaño son manchas", () => {
    // Cada pieza se reconoce por el `translate` que la coloca, y ese `translate` es
    // el mismo en la marca completa, así que el discriminador es exacto y no una
    // coincidencia de colores.
    expect(REDUCIDO).not.toMatch(/translate\(-18, -48\)/); // la nota
    expect(REDUCIDO).not.toMatch(/translate\(-24, 2\)/); // la gilda
    expect(REDUCIDO).not.toMatch(/translate\(108, 18\)/); // el cursor
    expect(REDUCIDO).not.toMatch(/<ellipse/); // la cabeza de la nota
  });

  it("engorda el pincho, porque a 16 de ancho no se ve", () => {
    // **El motivo por el que esto no es solo borrar tres grupos.** El pincho completo
    // va con `strokeWidth="9"` sobre un lienzo de 512: a 32 px son 0,56 px de grosor, y
    // por debajo del píxel desaparece. El valor de aquí está en unidades del mismo
    // lienzo, así que subirlo es lo que lo hace legible sin tocar la geometría.
    const grosor = Number(REDUCIDO.match(/<line[^>]*strokeWidth="(\d+)"/)?.[1] ?? "0");

    expect(grosor).toBeGreaterThanOrEqual(14);
  });

  it("la cabecera la usa, que es para lo que existe", () => {
    const cabecera = readFileSync(join(ROOT, "app", "components", "Header.tsx"), "utf8");

    expect(cabecera).toContain("LogoMarkReducido");
  });

  it("el icono del PWA sigue siendo el completo, porque a 192 px sí se lee todo", () => {
    // La variante reducida no se cuela en los iconos. Si se colara, el icono de la
    // pantalla de inicio perdería las piezas que a ese tamaño sí distinguen la marca,
    // y se comprueba mirando que el cursor —una de las tres que se quitan— siga
    // ahí. No se mira que la variante no mencione los iconos en un comentario: eso
    // impediría explicarlos.
    expect(readFileSync(join(ROOT, "public", "icon-512.svg"), "utf8")).toMatch(
      /translate\(108, 18\)/
    );
  });
});