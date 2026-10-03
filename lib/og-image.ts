import * as cheerio from "cheerio";

/**
 * La imagen de una página externa, leída de sus etiquetas Open Graph.
 *
 * Vive en un módulo de servidor y no en `lib/utils.ts` por el peso que arrastra:
 * `cheerio` son 148,2 KB de chunk de cliente —medido con `next build` limpio, en
 * `static/chunks/0zrqvx2mdvxh4.js`, cargado por las 23 páginas prerenderizadas
 * incluida la home— y de esos 148 KB el navegador no ejecutaba ni un byte. No
 * servía para nada: el único que llama a esta función es
 * `lib/sources/gasteizhoy.ts`, que es un scraper de servidor.
 *
 * La función ni siquiera estaba en el chunk: Turbopack la podó, porque en el grafo
 * de cliente no hay quien la llame, y dejó el cuerpo de `cheerio` porque el
 * `import * as cheerio` es un espacio de nombres completo. O sea que el bundle
 * pagaba el análisis del parser HTML entero a cambio de nada. Mismo patrón y mismo
 * arreglo que el registro de fuentes, que ya se resolvió separando la hoja de datos
 * de la composición: `lib/source-data.ts` no importa nada y `lib/source-registry.ts`
 * es el que compone con los scrapers.
 *
 * `lib/utils.ts` lo cargan los componentes cliente a través de `lib/shared.tsx`, así
 * que la frontera que importa es la del import. Lo comprueba
 * `__tests__/source-data.test.ts`, que recorre el grafo de imports desde las 44
 * raíces `"use client"` y falla si alguna alcanza `lib/sources/`; este módulo es
 * justo el caso que ese grafo no ve, porque no es un scraper sino un scraper en
 * potencia, y por eso el aviso va aquí además de en el fichero que se movió.
 */

/**
 * El TTL y el tope de la caché de imágenes.
 *
 * **Los mismos números que `lib/sources/vam.ts`, y a propósito.** Los dos leen la
 * imagen de la portada de un evento en la ficha de un tercero, con la misma capa de
 * debajo —`next: { revalidate: 86400 }`—, así que cuando los dos hagan lo mismo
 * tienen que hacerlos con los mismos números. Una hora es de sobra para una foto de
 * una cartelera que cambia cada semana. El tope de 200 cubre el catálogo entero: el
 * que más se ha visto son 13 eventos en Vitoria, y existe para que un proceso de días
 * no acumule entradas para siempre.
 *
 * Aquí no está el gemelo del bug que ya se arregló en `vam.ts`: este `Map` no tenía
 * ni TTL ni tope, así que un `og:image` viejo se servía durante todo el proceso del
 * servidor de Next —solo un reinicio lo cambiaba— y el `Map` crecía con cada enlace
 * distinto que aparecía en el catálogo. Las entradas negativas que guardaban
 * `undefined` no se leían nunca (el guard era `if (cached !== undefined)`, y eso es
 * lo mismo que no tener entrada), así que no dejaban la imagen sin imagen para
 * siempre: dejaban una entrada muerta por cada URL fallida.
 */
export const OG_IMAGE_CACHE_TTL_MS = 60 * 60 * 1000;
export const OG_IMAGE_CACHE_MAX = 200;

export type CacheDeImagenes<T> = {
  /** El valor si sigue vigente, o `undefined` si no hay o ya expiró. */
  leer: (clave: string) => T | undefined;
  /** Guarda con caducidad, y echa la más antigua si el tope se ha llenado. */
  guardar: (clave: string, valor: T) => void;
  /** Vacía la caché entera. */
  invalidar: () => void;
};

/**
 * Una caché con TTL y tope FIFO, en memoria y por proceso.
 *
 * Vive aquí como fábrica —y no como un `Map` suelto en cada módulo— porque
 * `lib/sources/vam.ts` lleva su propia copia de este mismo TTL desde que se le
 * arregló, y **dos copias del mismo TTL con dos valores distintos son dos formas de
 * que el mismo bug vuelva sin que nadie lo note**: nadie lee las dos a la vez, cada
 * una parece correcta donde está, y el día que una cambia nadie se pone a comparar.
 * Que una se lea desde `gasteizhoy.ts` y la otra desde dentro del propio `vam.ts` no
 * las hace distintas: es el mismo dato —la portada de un evento en la ficha de un
 * tercero— con el mismo ciclo de vida.
 *
 * Que sea una fábrica y no un módulo con estado exportado es lo que hace que el
 * segundo consumidor sea barato: `vam.ts` crea la suya con estos mismos dos números y
 * borra sus tres funciones privadas, en vez de tener que ponerse de acuerdo con
 * alguien sobre qué estado comparte con quién.
 */
export function crearCacheDeImagenes<T>(ttlMs: number, max: number): CacheDeImagenes<T> {
  // El `Map` guarda **caducidad**, no el valor con la marca del momento: así leer es
  // una comparación y no hay ninguna rama que devuelva `undefined` *como si fuera un
  // acierto*. Un `undefined` guardado y una entrada ausente son la misma cosa, y el
  // llamante no puede distinguirlos —ni debe poder, porque no le sirven para nada.
  const mapa = new Map<string, { valor: T; expira: number }>();

  return {
    leer: (clave) => {
      const entrada = mapa.get(clave);
      if (!entrada) return undefined;
      if (Date.now() >= entrada.expira) {
        // Se borra al leerla, no solo se ignora: una entrada caducada que no se
        // borra ocupa sitio hasta que la llave FIFO la eche, y para entonces ya no
        // cuenta como la más antigua.
        mapa.delete(clave);
        return undefined;
      }
      return entrada.valor;
    },

    guardar: (clave, valor) => {
      // El `Map` de JavaScript mantiene el orden de inserción y `keys()` los devuelve
      // en ese orden, así que el primero es el más antiguo y basta con borrar el
      // primero que salga. Con `size >= max` y no con `size > max` para no llegar a
      // `max + 1`.
      if (mapa.size >= max) {
        const masAntigua = mapa.keys().next();
        if (!masAntigua.done) mapa.delete(masAntigua.value);
      }
      mapa.set(clave, { valor, expira: Date.now() + ttlMs });
    },

    invalidar: () => mapa.clear(),
  };
}

const ogImageCache = crearCacheDeImagenes<string>(
  OG_IMAGE_CACHE_TTL_MS,
  OG_IMAGE_CACHE_MAX
);

/**
 * Vacía la caché de imágenes.
 *
 * La usan los tests, que si no comparten la primera respuesta entre casos, y para
 * forzar un re scrape desde código. Es la misma puerta que exportan
 * `lib/sources/vam.ts` (`invalidateVamImages`), `mercado-abastos.ts`,
 * `civitatis.ts` y `kora.ts`: los módulos con estado de módulo necesitan salida o
 * no hay forma de probarlos.
 */
export function invalidateOgImageCache(): void {
  ogImageCache.invalidar();
}

export async function fetchOgImage(url: string): Promise<string | undefined> {
  const cached = ogImageCache.leer(url);
  if (cached !== undefined) return cached;

  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
      signal: AbortSignal.timeout(8000),
      next: { revalidate: 86400 },
    });

    // Y los fallos **no** se guardan. Antes se guardaba `undefined`, que ocupaba una
    // entrada para siempre sin poder servirse nunca, porque el guard de lectura
    // comprobaba `!== undefined`: la entrada era letra muerta desde el momento en que
    // se escribía. Lo que se hace es no escribir nada, para que el siguiente intento
    // vuelva a pedir la ficha —que es lo único que puede hacer que aparezca— y para
    // que el tope de tamaño signifique algo, que es lo único para lo que está.
    // Tampoco se cachea el "200 sin imagen": puede ser una página que se pinta con
    // JavaScript y que un despliegue posterior sí trae con `og:image`.
    if (!res.ok) return undefined;

    const html = await res.text();
    const $ = cheerio.load(html);

    const ogImage =
      $('meta[property="og:image"]').attr("content") ||
      $('meta[name="og:image"]').attr("content") ||
      $('meta[name="twitter:image"]').attr("content");

    if (ogImage) {
      const absolute = ogImage.startsWith("http")
        ? ogImage
        : new URL(ogImage, url).href;
      ogImageCache.guardar(url, absolute);
      return absolute;
    }

    const firstImg = $(
      "article img, .entry-content img, main img, .content img"
    )
      .first()
      .attr("src");
    if (firstImg) {
      const absolute = firstImg.startsWith("http")
        ? firstImg
        : new URL(firstImg, url).href;
      ogImageCache.guardar(url, absolute);
      return absolute;
    }

    return undefined;
  } catch {
    // Un error de red o un plazo agotado sí puede ser pasajero: no se guarda nada
    // para que el siguiente intento vuelva a intentarlo.
    return undefined;
  }
}
