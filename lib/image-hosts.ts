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
    motivo: "La Genterula: el API MEC se pide en `www.lagenterula.com` (rula.ts:1)",
  },
  {
    // **Sin `www`, y en la lista por el peor motivo posible.** Esta entrada no
    // estaba, y su ausencia tumbaba el sitio entero: `next/image` lanza en tiempo de
    // render cuando el host no está en `remotePatterns`, así que una sola tarjeta con
    // una imagen de este host tumba la home, `/culture` y `/agenda/[mes]`, y las
    // las tres pintan la pantalla de error con un HTTP 200. Nótese que el `motivo`
    // de la entrada de arriba, que sí estaba, era **falso**: decía que las imágenes
    // "cuelgan del propio dominio", y el `www` de la API no es el host del `cdn` de
    // las imágenes. El test que valida esta lista no lo detectó porque atestigua
    // contra `lib/sources/**` **y** los fixtures, y el `www` sí aparece en `rula.ts:1`.
    //
    // El `www` se queda porque el API se llama así, y los dos host conviven.
    hostname: "lagenterula.com",
    motivo:
      "La Genterula: es el host real de `featured_image.large` en la respuesta del API, sin www. Medido en la respuesta en vivo el 4 de octubre de 2026, 399 apariciones en el fixture",
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
    hostname: "www.buscametas.com",
    motivo:
      "Buscametas: buscametas.ts:64 antepone la base al `src` de `.card-img-top img` cuando viene relativo, igual que hace municipal.ts:49 con el suyo",
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
    // Segundo host que faltaba y que tumbaba la home, medido el 4 de octubre de 2026
    // con la web en marcha: un evento de Arkabia usa una foto de Wikimedia como imagen
    // de cabecera —`upload.wikimedia.org/wikipedia/commons/…/Vitoria_-_Asador_Sagartoki.jpg`—,
    // porque el Third que organiza el evento publica el cartel en la wiki y no en su
    // propia web. Arkabia no lo filtra, y con la lista como estaba, la home no cargaba.
    //
    // Es el caso de uno, no de un scraper: la causa de que un `og:image` de un tercero
    // sea de donde sea, y la razón de que `imagenServible` exista. Esta entrada es
    // para que **esa** foto se vea; el `imagenServible` es para que la siguiente no
    // tumbe nada.
    hostname: "upload.wikimedia.org",
    motivo:
      "Arkabia: un Third publica su cartel en la wiki y usa la foto de Wikimedia como imagen del evento. Es el segundo host que faltaba y el que tumbaba la home",
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

/**
 * El único protocolo que el optimizador acepta, y el motivo de que sea una constante
 * y no un `"https"` repetido en dos sitios: `imagenServible` —el predicado que decide
 * si una tarjeta pinta `<Image>` o degrada— tiene que decir **exactamente** lo que
 * dicen los `remotePatterns`, porque `next/image` lanza en render con lo que no case
 * (`image-loader.js:96`). Dos literales sueltos son dos verdades que divergen el día
 * que alguien amplía la lista, y divergen calladas: el predicado acepta, la etiqueta
 * lanza y la página cae.
 */
const PROTOCOLO = "https" as const;

/** El `remotePatterns` que se pasa a `next/image`, derivado de la lista. */
export const REMOTE_PATTERNS = IMAGE_HOSTS.map((h) => ({
  protocol: PROTOCOLO,
  hostname: h.hostname,
}));

/**
 * Si `next/image` puede descargar esta URL, o si hay que pintarla sin imagen.
 *
 * Es un **type guard** (`url is string`) y no un `boolean` a propósito. Los trece
 * sitios que pintan una imagen tienen esta forma —
 *
 *     {imagenServible(evento.image) ? <Image src={evento.image} … /> : <fallback />}
 *
 * y sin el guard, TypeScript no estrecha `evento.image` dentro de la rama y
 * `src={evento.image}` deja de compilar. Un predicado que obliga a sus consumidores a
 * escribir `!` o un cast es un predicado que no se va a usar.
 *
 * Existe por el incidente que motivó el arreglo del host de La Genterula.
 * `next/image` **lanza en tiempo de render** cuando el host no está en
 * `remotePatterns`, y no es una excepción que se pueda capturar en el `onError` de la
 * etiqueta, porque el `onError` es para fallos de descarga y este throw pasa antes de
 * que exista la etiqueta. El efecto fue que **una sola** imagen con un host no
 * listado —un `www` de más, un CDN que cambia— tumbaba la home, `/culture`,
 * `/agenda/[mes]` y `/conciertos` a la vez, cada una con un HTTP 200 y la pantalla de
 * error pintada. Un sitio de agenda no puede caerse por una miniatura.
 *
 * La lista de `remotePatterns` sigue siendo la puerta que evita el proxy abierto, y
 * por eso `next.config.ts` no cambia. Lo que cambia es que la tarjeta **degrada**:
 * si el host no está, se pinta el tile con la inicial del título, que es lo que ya se
 * pinta cuando un evento no trae imagen. Una miniatura que falta es un dato que falta;
 * una home que no carga es el producto entero.
 *
 * El predicado es una lista y un `Set` porque `EventCard` es `"use client"` y esto se
 * evalúa en cada tarjeta de la home. `lib/image-hosts.ts` no importa nada —por eso
 * está en su propio fichero— así que llega al bundle del cliente sin arrastrar los
 * scrapers.
 *
 * **La clave del `Set` lleva el esquema y no solo el host**, por dos razones que salen
 * de `match-remote-pattern.js`, que es donde Next decide: `protocol` se compara con
 * `!==` y `hostname` con picomatch. Un `http://` de un host perfectamente listado
 * **no casa** y por lo tanto tumba la página igual que un host desconocido —y no es
 * hipotético: `gasteizhoy-listing.html` trae
 * `src="http://www.gasteizhoy.com/wp-content/uploads/2026/08/megabanner-*.gif"`, dos
 * imágenes en claro de una fuente que sí está en la lista. Y el predicado comparaba
 * solo el host, así que las daba por buenas y la página caía igual. Con la clave
 * `esquema://host` la lista de permitidos y los `remotePatterns` no pueden discrepar:
 * salen de la misma `PROTOCOLO`.
 */
const SERVIDORES_PERMITIDOS = new Set(
  IMAGE_HOSTS.map((h) => `${PROTOCOLO}://${h.hostname.toLowerCase()}`)
);

/** Esquema y host, o `null`. El grupo 1 es el esquema sin `:` y el 2 el host. */
const URL_ABSOLUTA = /^([a-zA-Z][a-zA-Z0-9+.-]*):\/\/([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/;

export function imagenServible(url: string | undefined | null): url is string {
  if (!url) return false;

  // Las rutas del propio sitio —el logo, los iconos— no pasan por el optimizador, así
  // que no tienen host que esté en la lista. Sin esta línea, marcarlas como "no
  // servibles" las borraría de la pantalla.
  //
  // `//` se queda fuera a propósito y por un motivo medido: `next/image` **lanza** con
  // una URL relativa al protocolo —`image-loader.js:59`—"protocol-relative URL (//)
  // must be changed to an absolute URL"—, o sea que aceptar las devolvería al
  // comportamiento que este predicado existe para quitar. Que hoy ninguna fuente las
  // produzca —las cuatro apariciones en las fixtures son `<script src>` de jQuery y
  // del adscript— no es una garantía: basta con que un scraper lea un `src` en crudo.
  if (url.startsWith("//")) return false;
  if (url.startsWith("/")) return true;

  const match = URL_ABSOLUTA.exec(url);
  if (!match) return false;
  return SERVIDORES_PERMITIDOS.has(`${match[1].toLowerCase()}://${match[2].toLowerCase()}`);
}
