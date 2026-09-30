/**
 * Los hosts de los que `next/image` puede descargar una imagen, uno a uno.
 *
 * Antes de este fichero, `next.config.ts` tenía
 * `remotePatterns: [{ protocol: "https", hostname: "**" }, { protocol: "http", hostname: "**" }]`.
 * El optimizador de imágenes de Next es un proxy: hace fetch de la URL que le
 * pidan por `/_next/image?url=...` y devuelve el resultado desde el mismo origen
 * del sitio. Con `hostname: "**"` eso es un proxy abierto —cualquiera podía usar
 * el despliegue de gasteizclick.javierpalacio.es para amplificar tráfico contra
 * un tercero, o para meter contenido arbitrario bajo el mismo origen— y
 * ninguna lista de Scratch lo habría parado.
 *
 * ## De dónde sale cada host
 *
 * De medir, no de suponer. Para cada scraper se ha buscado el host en el
 * atributo que el scraper **realmente** lee, no en cualquier `img` de la página:
 *
 * - `src` de `.mec-event-image img` para `gasteizhoy`;
 * - `src` de `.mkp-ticket-image img` para `musikaze` y `jimmyjazz`;
 * - `data-src` para `civitatis` y `kora`, porque en las dos el `src` es un
 *   placeholder;
 * - `data-original` de `img.lazy` para `cines`, y `data-src` de
 *   `img.thumbnail-img` para `boulevard`;
 * - `images[].imageUrl` del API de Euskadi, `image_url` del agregador del VAM,
 *   `featured_image.large` de La Genterula, `_embedded["wp:featuredmedia"]` de
 *   Miniature, `image` del JSON-LD de Fever;
 * - y los literales de URL que el propio scraper concatena
 *   (`municipal.ts:49`, `jimmyjazz.ts:58`, `musikaze.ts:64`, `vam.ts:31`...).
 *
 * Sobre `__tests__/fixtures/` y, para las dos carteleras —que no tienen
 * fixture—, contra el sitio en vivo.
 *
 * `__tests__/next-config.test.ts` comprueba que ningún host de esta lista esté
 * inventado: todos tienen que aparecer en `lib/sources/**` o en
 * `__tests__/fixtures/**`.
 *
 * ## Cómo añadir uno
 *
 * Es una decisión consciente, no una consecuencia. Cuando una fuente se mude de
 * CDN, la imagen no se verá —`next/image` devolverá un 400— y el arreglo es una
 * línea aquí con su motivo. La tentación de volver a `"**"` es exactamente lo
 * que este fichero existe para no ceder.
 *
 * ## Lo que no está, y por qué
 *
 * `lib/sources/vam.ts:34-66` enriquece los eventos del VAM con el `og:image` de
 * la página a la que enlazan, resuelto contra el host de esa página. Ese host no
 * tiene techo: el agregador devuelve eventos de toda España y su `image_url` de
 * los de Vitoria da siete hosts distintos (`arkabia.eus`, `base44.app`,
 * `diocesisvitoria.org`, `erreserbak.arkabia.eus`, `www.kulturklik.euskadi.eus`,
 * `www.martxoak3.org`, `www.vitoria-gasteiz.org`), y los que no tienen
 * `image_url` caen al `og:image` de la ficha del organizador. Esos hosts no se
 * han visto servir una imagen, así que no están. El sitio correcto para
 * arreglarlo es el scraper —que debería limitarse a los 28 dominios del
 * registro—, no esta lista.
 */

/** Un host que sirve imágenes de la agenda, y por qué está aquí. */
export type ImageHost = {
  readonly hostname: string;
  /** De qué fuente sale, con el fichero y la línea. */
  readonly motivo: string;
};

export const IMAGE_HOSTS: readonly ImageHost[] = [
  {
    hostname: "www.vitoria-gasteiz.org",
    motivo:
      "Ayuntamiento y La Blanca: municipal.ts:49 concatena la ruta a esta base y fiestas-blanca.ts:41 la repite",
  },
  {
    hostname: "www.gasteizhoy.com",
    motivo: "Gasteiz Hoy: gasteizhoy.ts:72 antepone la base cuando la ruta viene relativa",
  },
  {
    hostname: "sarrerak.jimmyjazzgasteiz.com",
    motivo: "Jimmy Jazz: jimmyjazz.ts:58 antepone la base a la ruta de la imagen de la entrada",
  },
  {
    hostname: "entradas.musikaze.com",
    motivo: "Musikaze: musikaze.ts:64 antepone la base al `src` de la cartelera de Vitoria",
  },
  {
    hostname: "helldorado.net",
    motivo: "HellDorado: helldorado.ts:52 usa la base cuando el `img` del JSON-LD es relativo",
  },
  {
    hostname: "www.cm-gazteiz.com",
    motivo: "Senderismo: senderismo.ts:62 convierte la ruta de la imagen en absoluta con esta base",
  },
  {
    hostname: "via.placeholder.com",
    motivo:
      "Senderismo: senderismo.ts:63 lo usa de reserva cuando la excursions no trae imagen. El servicio está muerto, pero dejarlo fuera convertiría su 404 en un 400 del optimizador",
  },
  {
    hostname: "www.lagenterula.com",
    motivo: "La Genterula: las imágenes de `featured_image.large` del API MEC cuelgan del propio dominio",
  },
  {
    hostname: "opendata.euskadi.eus",
    motivo: "Euskadi: es el host de `images[].imageUrl`, y también la imagen por defecto del VAM (vam.ts:8)",
  },
  {
    hostname: "www.kulturklik.euskadi.eus",
    motivo: "VAM: vam.ts:31 antepone la base cuando el `image_url` del evento es relativo",
  },
  {
    hostname: "arkabia.eus",
    motivo: "Arkabia: sale del `src` de las tarjetas del `admin-ajax.php`, y también del `image_url` de un evento del VAM",
  },
  {
    hostname: "erreserbak.arkabia.eus",
    motivo: "VAM: es el `image_url` de una de las trece entradas de Vitoria del agregador",
  },
  {
    hostname: "base44.app",
    motivo: "VAM: es el `image_url` de una de las trece entradas de Vitoria del agregador",
  },
  {
    hostname: "diocesisvitoria.org",
    motivo: "VAM: es el `image_url` de una de las trece entradas de Vitoria del agregador",
  },
  {
    hostname: "www.martxoak3.org",
    motivo: "VAM: es el `image_url` de una de las trece entradas de Vitoria del agregador",
  },
  {
    hostname: "miniature.pintxos.eus",
    motivo: "Miniature: es el `source_url` de `_embedded[wp:featuredmedia]` en los doce items del fixture",
  },
  {
    hostname: "mercadoabastos.eus",
    motivo: "Mercado de Abastos: las imágenes del REST de The Events Calendar son de su propio dominio",
  },
  {
    hostname: "img.evbuc.com",
    motivo: "Eventbrite: es el CDN de imágenes que devuelve la búsqueda de la ciudad",
  },
  {
    hostname: "m.entradium.com",
    motivo: "Entradium: el `srcset` de `picture img` es absoluto y sale de aquí, y entradium.ts lo usa de base para las URL",
  },
  {
    hostname: "www.civitatis.com",
    motivo: "Civitatis: el `data-src` de sus tarjetas, que es donde esconden la imagen real",
  },
  {
    hostname: "cdn-kora.koragreencity.com",
    motivo: "Kora: el `data-src` de las fichas, donde el `src` es un placeholder",
  },
  {
    hostname: "koraliving.cms.koraliving.com",
    motivo: "Kora: el `data-src` de algunas fichas viene con el CMS delante",
  },
  {
    hostname: "dj0btluajbxkl.cloudfront.net",
    motivo: "Kora: el `data-src` de otras fichas sale por su CDN de CloudFront",
  },
  {
    hostname: "applications-media.feverup.com",
    motivo: "Fever: el `image.contentUrl` del JSON-LD de las páginas de evento, 598 apariciones en el fixture",
  },
  {
    hostname: "media.feverup.com",
    motivo: "Fever: el mismo JSON-LD sirve imágenes de este host según el evento",
  },
  {
    hostname: "res.cloudinary.com",
    motivo: "Fever: Candlelight y otros promotores alojan su cartelera en Cloudinary y sale del mismo JSON-LD",
  },
  {
    hostname: "es.web.img3.acsta.net",
    motivo: "Boulevard: `app/services/boulevard.ts` saca la miniatura de Sensacine, que vive en la red de acsta",
  },
  {
    hostname: "es.web.img2.acsta.net",
    motivo: "Boulevard: el mismo `data-src` de Sensacine reparte las miniaturas entre dos subdominios",
  },
  {
    hostname: "florida.reservaentradas.com",
    motivo: "Cines: es el `data-original` de las carátulas de Florida, 24 en el fixture",
  },
  {
    hostname: "www.reservaentradas.com",
    motivo: "Cines: es el `src` con el que reservaentradas sirve hoy la cartelera, el plan B de `cines.ts:40`",
  },
];

/** El `remotePatterns` que se pasa a `next/image`, derivado de la lista. */
export const REMOTE_PATTERNS = IMAGE_HOSTS.map((h) => ({
  protocol: "https" as const,
  hostname: h.hostname,
}));
