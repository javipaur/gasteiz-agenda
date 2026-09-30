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

const ogImageCache = new Map<string, string | undefined>();

export async function fetchOgImage(url: string): Promise<string | undefined> {
  const cached = ogImageCache.get(url);
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
    if (!res.ok) {
      ogImageCache.set(url, undefined);
      return undefined;
    }

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
      ogImageCache.set(url, absolute);
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
      ogImageCache.set(url, absolute);
      return absolute;
    }

    ogImageCache.set(url, undefined);
    return undefined;
  } catch {
    ogImageCache.set(url, undefined);
    return undefined;
  }
}
