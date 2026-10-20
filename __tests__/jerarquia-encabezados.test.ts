/**
 * La jerarquía de encabezados.
 *
 * **Qué se rompe, y por qué no se ve.** Un salto de nivel —un `h1` seguido de un
 * `h3` sin ningún `h2` entre medias— no da error, no rompe la página y no se ve
 * en una captura. Solo lo nota quien navega por encabezados, que es lo que hace
 * un lector de pantalla: se encuentra con un `h1` y, de pronto, un `h3`, sin
 * saber en qué sección está.
 *
 * Medido el 20 de octubre de 2026 con un barrido de todas las páginas: **catorce
 * de veintiuna** tenían el salto, y la mayoría por el mismo motivo —el pie, que
 * usa `h3` para sus tres columnas y aparece en todas las páginas.
 *
 * **Y por qué se lee el código y no se pinta la página.** Es el mismo enfoque que
 * `__tests__/home-secciones.test.ts`: la regla es de composición, no de
 * comportamiento, y un fichero de texto la comprueba sin arrastrar `next/image`,
 * los `Suspense` ni la animación de entrada.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();

function fuente(relativo: string): string {
  return readFileSync(join(ROOT, relativo), "utf8");
}

/**
 * Las páginas que son **una lista y nada más**.
 *
 * Su único encabezado es el `h1` del título de la página, así que el título de
 * cada tarjeta es una sección de ese `h1` y su nivel es `2`. Con `h3` se saltaba
 * un nivel.
 */
const PAGINAS_QUE_SON_UNA_LISTA = [
  "app/components/CulturePageClient.tsx",
  "app/components/KidsPageClient.tsx",
  "app/components/GastronomiaPageClient.tsx",
  "app/components/TurismoPageClient.tsx",
  "app/components/SportPageClient.tsx",
  "app/components/BusPageClient.tsx",
];

/**
 * Las páginas que pintan tarjetas con el `EventCard` o el `MovieCard` **compartidos**.
 *
 * Aquí el nivel no está en el fichero de la tarjeta —que se usa también en la
 * home, bajo un `h2` de sección, y ahí sí es `h3`— sino en la llamada: por eso
 * se comprueba que la página **pase** `nivel={2}`.
 */
const PAGINAS_CON_LISTA_DE_TARJETAS: [string, string][] = [
  ["app/hoy/page.tsx", "EventCard"],
  ["app/buscar/page.tsx", "EventCard"],
  ["app/favoritos/page.tsx", "EventCard"],
  ["app/components/MoviesPageClient.tsx", "MovieCard"],
];

describe("la jerarquía de encabezados", () => {
  it("las columnas del pie son secciones de primer nivel, no de tercero", () => {
    // **El pie es la causa de la mayoría de los saltos.** Sus tres columnas —
    // "Explorar", "Por categoría", "Sobre"— son secciones al mismo nivel que el
    // contenido de la página, y en las páginas que no tienen otro `h2` —`/bus`,
    // `/buscar`, `/favoritos`, `/metricas`— el salto era de `h1` a `h3` sin más.
    const pie = fuente("app/components/Footer.tsx");

    expect(pie).not.toContain("<h3");
    expect(pie.match(/<h2/g)?.length).toBe(3);
  });

  it("las páginas que son una lista no saltan del h1 al h3", () => {
    const conSalto = PAGINAS_QUE_SON_UNA_LISTA.filter(
      (f) => fuente(f).includes("<h3")
    );

    expect(conSalto).toEqual([]);
  });

  it("las listas de tarjetas piden el nivel 2 explícitamente", () => {
    // El nivel va en la llamada y no en la tarjeta, porque la misma tarjeta se
    // usa en la home —donde cuelga de un `h2` de sección y sí es `h3`—.
    const sinNivel = PAGINAS_CON_LISTA_DE_TARJETAS.filter(
      ([f]) => !fuente(f).includes("nivel={2}")
    );

    expect(sinNivel).toEqual([]);
  });

  it("la tarjeta compartida sigue siendo h3 por defecto", () => {
    // El valor por defecto es `3` porque en la home y en los carruseles la
    // tarjeta cuelga de un `h2` de sección. Si el defecto pasara a `2`, la home
    // sería `h1` → `h2` de sección → `h2` de tarjeta, que no es una jerarquía.
    const compartido = fuente("lib/shared.tsx");

    expect(compartido).toMatch(/nivel = 3/);
    expect(compartido).toMatch(/nivel\?: 2 \| 3/);
  });
});
