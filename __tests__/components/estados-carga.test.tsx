/**
 * @jest-environment jsdom
 */

/**
 * Los `loading.tsx` son esqueletos puramente visuales: cajas con `animate-pulse`
 * y nada más. Sin `role="status"`, sin `aria-busy` y sin texto, cambiar de ruta
 * es un silencio para quien usa lector de pantalla: no hay nada que anunciar ni
 * nada que le diga que la página está llegando.
 *
 * La lista de módulos **sale del disco**, no de un inventario escrito a mano.
 * Un inventario se queda atrás sin que nadie lo note —y de hecho se había
 * quedado: `fiestas-blanca` tenía su esqueleto sin anunciar y no estaba en la
 * lista—, así que el test recorre todos los `loading.tsx` que cuelgan de `app/`
 * y exige el anuncio a todos. El día que alguien añada uno sin `LoadingStatus`, este
 * test lo caza sin que haya que acordarse de tocar nada.
 *
 * Y hay una segunda mitad que no es de accesibilidad y es la razón por la que el
 * de la raíz se retiró: un `loading.tsx` ancestro es una **frontera de Suspense**,
 * y una frontera compromete el `200` antes de que la página llegue a llamar a
 * `notFound()`. Por eso `/evento/[slug]` y `/agenda/[mes]` respondían 200 con
 * `noindex` en vez de 404. El segundo bloque protege justo eso: esas dos rutas no
 * pueden volver a tener un esqueleto por encima.
 */
import { globSync } from "node:fs";
import { join, resolve } from "node:path";
import { escenario } from "../helpers-a11y";

type Modulo = { default: () => unknown };

// Este test vive en `__tests__/components/`, así que la raíz está dos niveles
// arriba y no uno: con un solo `..` el glob apuntaría a `__tests__/app/…`, que no
// existe, y devolvería cero ficheros —un verde vacío en vez de un rojo—.
const ROOT = resolve(__dirname, "..", "..");

/** Rutas relativas, con `/`, de todos los `loading.tsx` de la App Router. */
function esqueletos(): string[] {
  return globSync(join(ROOT, "app", "**", "loading.tsx"))
    .map((f) => f.slice(ROOT.length + 1).replace(/\\/g, "/"))
    .sort();
}

/**
 * De `app/hoy/loading.tsx` a `@/app/hoy/loading`, y el nombre que se enseña en
 * el test: el directorio de la ruta, que es lo que se lee.
 */
function comoModulo(relativo: string): [string, string] {
  const sinExtension = relativo.replace(/\.tsx$/, "");
  const nombre = sinExtension.replace(/^app\//, "").replace(/\/loading$/, "");
  return [nombre, `@/${sinExtension}`];
}

const RUTAS: [string, string][] = esqueletos().map(comoModulo);

/**
 * Rutas que **no** pueden tener un esqueleto por encima, ni propio ni heredado.
 *
 * `app/` es ancestro de todo, así que si `app/loading.tsx` reaparece esto lo
 * caza igual que si alguien pusiera un `loading.tsx` dentro de la propia ruta.
 */
const RUTAS_QUE_EXIGEN_404_REAL = ["app/evento/[slug]", "app/agenda/[mes]"];

describe("estados de carga", () => {
  it("hay al menos un esqueleto que comprobar", () => {
    // Sin esta guarda, un glob que no encontrara nada daría un verde vacío: cero
    // rutas que fallan el `it.each` se lee igual que todas las rutas correctas.
    expect(RUTAS.length).toBeGreaterThan(0);
  });

  it.each(RUTAS)("%s anuncia que está cargando", (_nombre, ruta) => {
    const { crear, montar, modulo: componente } = escenario<Modulo>(ruta);
    const vista = montar(crear(componente.default, {}));

    const estado = vista.consultar('[role="status"]');
    expect(estado).not.toBeNull();
    expect(estado!.getAttribute("aria-busy")).toBe("true");
    // El texto va en `sr-only`: los esqueletos son cajas vacías y no tienen texto
    // visible que anuncie nada.
    expect(estado!.querySelector(".sr-only")!.textContent).toContain("Cargando");

    vista.desmontar();
  });

  it("cultura y deporte anuncian los dos", () => {
    // Los dos ficheros son copia el uno del otro (solo cambia el nombre del
    // componente), así que si uno se arregla y el otro no, el mismo fallo vive en
    // dos sitios y ya no se distingue del original. La palabra concreta puede
    // cambiar: lo que no puede es que uno anuncie y el otro no.
    const cultura = escenario<Modulo>("@/app/culture/loading");
    const deporte = escenario<Modulo>("@/app/deporte/loading");

    const vCultura = cultura.montar(cultura.crear(cultura.modulo.default, {}));
    const vDeporte = deporte.montar(deporte.crear(deporte.modulo.default, {}));

    const anuncio = (estado: HTMLElement) => ({
      role: estado.getAttribute("role"),
      busy: estado.getAttribute("aria-busy"),
      texto: estado.querySelector(".sr-only")!.textContent,
    });

    expect(anuncio(vCultura.consultar('[role="status"]')!)).toEqual({
      role: "status",
      busy: "true",
      texto: "Cargando la agenda cultural…",
    });
    expect(anuncio(vDeporte.consultar('[role="status"]')!)).toEqual({
      role: "status",
      busy: "true",
      texto: "Cargando la agenda deportiva…",
    });

    vCultura.desmontar();
    vDeporte.desmontar();
  });
});

describe("el 404 real no lo tapa un esqueleto", () => {
  it.each(RUTAS_QUE_EXIGEN_404_REAL)(
    "%s no cuelga de ningún loading.tsx",
    (ruta) => {
      // Un `loading.tsx` en la propia carpeta o en cualquiera de sus ancestros
      // —incluida `app/`— es una frontera de Suspense, y ahí el `notFound()` ya
      // no puede cambiar el status: Next compromete el 200 con el esqueleto y
      // mete un `noindex` en vez de devolver un 404 de verdad.
      const culpables = esqueletos().filter((relativo) => {
        const carpeta = relativo.replace(/\/loading\.tsx$/, "");
        return ruta === carpeta || ruta.startsWith(`${carpeta}/`);
      });
      expect(culpables).toEqual([]);
    }
  );
});
