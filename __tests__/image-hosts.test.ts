/**
 * `imagenServible` decide si una tarjeta pinta `<Image>` o degrada al tile con la
 * inicial, y esa decisión tiene un coste asimétrico: equivocarse en un sentido rompe la
 * página, y equivocarse en el otro la deja sin fotos sin que nada lo diga.
 *
 * Los dos sentidos son errores reales y los dos han pasado:
 *
 * - **Al revés** —aceptar lo que Next no puede descargar. `next/image` lanza en render
 *   con un host no listado (`image-loader.js:96`), con un esquema distinto al del
 *   `remotePattern` (`match-remote-pattern.js`, que compara `protocol` con `!==`) y con
 *   una URL relativa al protocolo (`image-loader.js:59`). Los tres son la misma caída y
 *   el mismo HTTP 200 con la pantalla de error pintada.
 * - **A la inversa** —rechazar un host que sí está en la lista. No rompe nada: la
 *   tarjeta sale sin foto, en silencio, y nadie lo ve hasta que alguien pregunta por qué
 *   la portada no tiene imágenes de LA Genterula.
 *
 * Por eso el primer test no es un ejemplo: es **todos los hosts de la lista**, y es el
 * que ata el predicado a `REMOTE_PATTERNS`. Los dos salen del mismo array y de la misma
 * constante de protocolo, así que si mañana alguien amplía la lista y olvida el otro
 * lado, esto se pone rojo.
 */
import { readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";

import { IMAGE_HOSTS, REMOTE_PATTERNS, imagenServible } from "@/lib/image-hosts";

const ROOT = resolve(__dirname, "..");

/** Todos los ficheros de un directorio, para después quedarse con los `.tsx`. */
function ficherosConJSX(dir: string): string[] {
  const out: string[] = [];
  const walk = (d: string) => {
    for (const e of readdirSync(d, { withFileTypes: true })) {
      if (e.name === "node_modules" || e.name.startsWith(".")) continue;
      const p = join(d, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.name.endsWith(".tsx")) out.push(p);
    }
  };
  walk(dir);
  return out;
}

describe("imagenServible", () => {
  it("acepta todos y cada uno de los hosts de la lista", () => {
    const rechazados = IMAGE_HOSTS.filter(
      (h) => !imagenServible(`https://${h.hostname}/cartel.jpg`)
    );

    // El fallo que esto evita es el silencioso: un host de la lista que el predicado
    // rechaza no da error, desaparece de la web. Por eso el aserto dice **qué** se
    // quedó fuera y no solo que "no hay ninguno".
    expect(rechazados.map((h) => h.hostname)).toEqual([]);
  });

  it("el predicado y los remotePatterns cuentan lo mismo", () => {
    // La forma de la deriva: alguien añade `protocol: "http"` a un patrón para admitir
    // una fuente en claro, y el predicado —que compartía el array pero no el
    // protocolo— se queda diciendo que esa URL no es servible. O al revés, que es el
    // que tumba la página. Los dos lados se leen del mismo sitio, y aquí se compara.
    expect(REMOTE_PATTERNS.length).toBe(IMAGE_HOSTS.length);
    for (const p of REMOTE_PATTERNS) {
      expect(p.protocol).toBe("https");
      expect(imagenServible(`${p.protocol}://${p.hostname}/cartel.jpg`)).toBe(true);
    }
  });

  it("rechaza un host que no está en la lista", () => {
    // El incidente: `lagenterula.com` sin `www` no estaba en la lista y tumbaba la
    // home entera. La lista ya lo tiene, así que el caso de interés es el vecino.
    expect(imagenServible("https://cdn.desconocido.example/cartel.jpg")).toBe(false);
    expect(imagenServible("https://example.com/f1.jpg")).toBe(false);
  });

  it("rechaza un host que se hace pasar por uno de la lista", () => {
    // La comparación es por host exacto, no por sufijo: `www.lagenterula.com` es un
    // host distinto de `lagenterula.com` y este último sí está en la lista. Aceptar el
    // sufijo sería abrir el optimizador a cualquiera que registre un dominio que
    // acabe en `.lagenterula.com`, que es justo el proxy abierto que la lista existe
    // para evitar.
    expect(IMAGE_HOSTS.some((h) => h.hostname.endsWith("lagenterula.com"))).toBe(true);
    expect(imagenServible("https://www.lagenterula.com/cartel.jpg")).toBe(true);
    expect(imagenServible("https://lagenterula.com.otro.example/cartel.jpg")).toBe(false);
    expect(imagenServible("https://malo-lagenterula.com/cartel.jpg")).toBe(false);
  });

  it("acepta las rutas del propio sitio", () => {
    // El logo y los iconos no pasan por el optimizador: no tienen host que esté en la
    // lista y sin esta línea desaparecerían de la pantalla.
    expect(imagenServible("/logo.svg")).toBe(true);
    expect(imagenServible("/carteles/octubre/portada.webp")).toBe(true);
  });

  it("rechaza lo que no es ni ruta ni URL", () => {
    for (const vacio of [undefined, null, ""]) {
      expect(imagenServible(vacio)).toBe(false);
    }
    expect(imagenServible("carteles/octubre.png")).toBe(false);
    expect(imagenServible("data:image/png;base64,iVBORw0KGgo=")).toBe(false);
  });

  it("rechaza http:// de un host de la lista, porque el remotePattern es https", () => {
    // El caso que no es hipotético: `gasteizhoy-listing.html` trae
    // `src="http://www.gasteizhoy.com/wp-content/uploads/2026/08/megabanner-*.gif"`.
    // Dos imágenes en claro de una fuente que sí está en la lista. El predicado
    // comparaba solo el host, así que las daba por buenas, y `next/image` las rechazaba
    // al comparar `protocol` con `!==` —la misma caída que un host desconocido.
    expect(IMAGE_HOSTS.some((h) => h.hostname === "www.gasteizhoy.com")).toBe(true);
    expect(imagenServible("https://www.gasteizhoy.com/wp-content/uploads/2026/08/x.gif")).toBe(
      true
    );
    expect(imagenServible("http://www.gasteizhoy.com/wp-content/uploads/2026/08/x.gif")).toBe(
      false
    );
  });

  it("rechaza una URL relativa al protocolo, que Next no acepta en absoluto", () => {
    // `image-loader.js:59` lanza con "//cdn… must be changed to an absolute URL". Aquí
    // no hay ni host ni esquema que comparar: la decisión es siempre que no.
    expect(imagenServible("//cdn.lagenterula.com/cartel.jpg")).toBe(false);
    expect(imagenServible("//")).toBe(false);
  });

  it("compara el host sin distinguir mayúsculas", () => {
    // Las URLs de un scraper heredan las mayúsculas que traiga el HTML, y un `WWW` o
    // un `Lagenterula` no son hosts distintos: el DNS no distingue. Un predicado
    // sensible a la caja borraría la imagen de una tarjeta por una mayúscula.
    expect(imagenServible("https://WWW.VITORIA-GASTEIZ.ORG/cartel.jpg")).toBe(true);
    expect(imagenServible("https://WWW.gasteizhoy.com/x.gif")).toBe(true);
  });

  it("no se deja engañar por el host en la ruta ni en los parámetros", () => {
    // El regex saca el host **del principio**, y no de cualquier `//` que aparezca
    // después. Una URL que lleva el host permitido en el query —un `og:image` de
    // redirección, un proxy— no es una imagen de ese host, y aceptarla sería dejar
    // pasar al optimizador lo que la lista niega.
    expect(
      imagenServible("https://otro.example/redirect?u=https%3A%2F%2Fwww.vitoria-gasteiz.org%2Fx.jpg")
    ).toBe(false);
  });
});

/**
 * Que el predicado esté **usado**, que es la mitad que se puede comprobar desde el repo
 * y la que ninguna de las aserciones de arriba ven.
 *
 * El barrido del 4 de octubre de 2026 pasó por trece ficheros y se dejó dos sin tocar:
 * la ficha de `/evento/[slug]` y el hub de secciones seguían con `<Image
 * src={evento.image}>` a pelo. Ningún test se enteró, y no por casualidad: el
 * predicado no tenía ninguno, y los que había —el de `remotePatterns`, el de `alt`— no
 * miran este atributo. Faltaban las dos mitades a la vez.
 *
 * No es una regla de ESLint porque no se puede escribir de forma fiable: la pregunta es
 * si el `src` **dinámico** de una etiqueta `<Image>` está bajo un predicado, y eso
 * depende de si la condición es `{imagenServible(x) ? …}`, `{imagenServible(x) && …}`
 * o una variable que se asignó antes con el predicado. Es justo lo que una regla
 * adivinando se equivocaría. Lo que sí es verificable, y es lo que importa, es que el
 * fichero **sepa** del predicado: un fichero que pinta imágenes de datos scrapeados y
 * no menciona `imagenServible` en ninguna parte es un fichero que se expone al throw.
 *
 * El coste es que el guard es de fichero y no de etiqueta: un `src` pelado en un
 * fichero que también usa el predicado en otro sitio pasaría. Se acepta porque el
 * otro extremo —`remplazar` una línea por un fichero entero— es peor, y porque este
 * test atrapa lo que de verdad se ha escapado dos veces.
 */
describe("el predicado está cableado en todos los sitios que pintan imágenes", () => {
  it("cada fichero que pinta <Image> lo llama, y no solo lo importa", () => {
    // Lo de **llamarlo** y no lo de mencionarlo es el detalle que hace que esto
    // sirva. La primera versión de este test buscaba el nombre del predicado en el
    // fichero y daba verde: el `import` y el comentario de al lado ya lo ponían, así
    // que un fichero que lo importaba y dejaba de usarlo —justo lo que se hace al
    // añadir una segunda imagen a una tarjeta— pasaba limpio. Buscar `imagenServible(`
    // con el paren es lo que separa "lo usa" de "lo conoce".
    const sinGuardar: string[] = [];

    for (const dir of ["app", "lib"]) {
      for (const ruta of ficherosConJSX(join(ROOT, dir))) {
        const txt = readFileSync(ruta, "utf8");
        if (!/<Image\b/.test(txt)) continue;

        // Fuera los comentarios de bloque, que en este repo son largos y citan el
        // predicado por nombre. Un `src` que no sea `http` es una estática del propio
        // sitio: ahí no hay host que pueda no estar en `remotePatterns`.
        const codigo = txt.replace(/\/\*[\s\S]*?\*\//g, "");
        if (codigo.includes("imagenServible(")) continue;
        if (/src="(?!http)/.test(codigo)) continue;

        sinGuardar.push(ruta.replace(ROOT, "."));
      }
    }

    expect(sinGuardar).toEqual([]);
  });

  it("el inventario de sitios que pintan imágenes está cerrado, y da igual el orden", () => {
    // Los trece, escritos. Un recuento suelto —"son 13"— no dice **cuáles**, y lo que
    // interesa es que un sitio nuevo entre a mirar en vez de colarse: añadir un
    // componente con `<Image>` obliga a decidir si su `src` necesita el predicado, y
    // esa decisión es la que aquí se está documentando.
    const SITIOS = [
      "app/components/ConciertosPageClient.tsx",
      "app/components/CulturePageClient.tsx",
      "app/components/GastronomiaPageClient.tsx",
      "app/components/Header.tsx",
      "app/components/HeroSearch.tsx",
      "app/components/KidsPageClient.tsx",
      "app/components/MovieCard.tsx",
      "app/components/NextDaysSection.tsx",
      "app/components/SectionsHub.tsx",
      "app/components/SportPageClient.tsx",
      "app/components/TopEventsSection.tsx",
      "app/evento/[slug]/page.tsx",
      "lib/shared.tsx",
    ];

    const encontrados = ficherosConJSX(join(ROOT, "app"))
      .concat(ficherosConJSX(join(ROOT, "lib")))
      .map((ruta) =>
        ruta
          .slice(ROOT.length + 1)
          // La lista se escribe con barras normales para que el test sea el mismo en
          // Windows y en Dokploy. Un `toEqual` de rutas con separadores distintos es
          // un test que solo falla en la mitad de las máquinas.
          .replace(/\\/g, "/")
      )
      .filter((ruta) => /<Image\b/.test(readFileSync(join(ROOT, ruta), "utf8")))
      .sort();

    expect(encontrados).toEqual(SITIOS);
  });
});