import { IMAGE_HOSTS } from "./image-hosts";
import { debeUsarProxy } from "./image-proxy";

/**
 * Lo que tienen en común las tarjetas del paquete de redes.
 *
 * **Por qué el tamaño y las URLs salen de aquí y no de cada ruta.** Las tres rutas
 * del paquete necesitan lo mismo, y si eso vive en tres sitios un día uno se queda
 * a 1080×1080 sin que nada se entere: en el móvil se ve bien y en el feed queda con
 * dos bandas negras.
 *
 * 1080×1350 es 4:5, que es lo que más pantalla ocupa en el feed de Instagram por
 * debajo del 10:4.
 */
export const TAMANO_PROMO = { width: 1080, height: 1350 } as const;

/** La base pública del sitio. Es la de `metadataBase` en `app/layout.tsx`. */
export const ORIGEN_PROMO = "https://gasteizclick.javierpalacio.es";

/** `lib/image-hosts.ts` no importa nada, así que esto llega al bundle sin scrapers. */
const HOSTS: readonly string[] = IMAGE_HOSTS.map((h) => h.hostname.toLowerCase());

/** La URL de una tarjeta, tal como la necesita Instagram. */
export function urlDePromo(fecha: string, slug?: string): string {
  const base = `${ORIGEN_PROMO}/api/promo/${fecha}`;
  return slug ? `${base}/evento/${slug}` : `${base}/portada`;
}

/**
 * Un host que la tarjeta pueda pintar, o nada.
 *
 * **El predicado no es `imagenServible` y la diferencia es el motivo.** El de
 * `lib/image-hosts.ts` decide qué acepta el optimizador de `next/image`, y aquí la
 * imagen es un `<img>` de HTML plano dentro del SVG de `ImageResponse`, que no pasa
 * por el optimizador. Lo que sí hay que comprobar es lo otro: que el host esté en la
 * lista, porque un cartel en un CDN que el sitio no sirve deja un rectángulo vacío en
 * un post ya publicado, y desde fuera no hay forma de saber por qué.
 *
 * Devuelve `null` y no una imagen de relleno porque el hueco no es decorativo: es un
 * hueco en un post que alguien va a leer.
 */
export function radioImagenPromo(url: string | undefined | null): string | null {
  if (!url) return null;
  if (url.startsWith("/")) return url;
  const m = /^https?:\/\/([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/.exec(url);
  if (!m) return null;
  return HOSTS.includes(m[1].toLowerCase()) ? url : null;
}

/**
 * La URL que hay que darle a `ImageResponse` para que pinte la imagen, o nada.
 *
 * **`radioImagenPromo` no sirve para esto, y la diferencia es el bug que arregla esta
 * función.** `radioImagenPromo` contesta a "de qué hosts sé descargar"; esta contesta a
 * "qué URL puede descargar este renderizador en concreto". Son dos preguntas y desde el
 * 8 de octubre de 2026 dan dos respuestas distintas para La Genterula.
 *
 * **El motivo, medido y no deducido.** `ImageResponse` descarga las imágenes con el
 * `fetch` de Node, cuyo User-Agent lleva la cadena "node". La Genterula tiene un WAF que
 * devuelve 403 a cualquier User-Agent que la contenga. Con una tarjeta real de
 * `app/api/promo`, a 1080×1350 y sobre una imagen de ese host: 31795 bytes con la URL
 * cruda y 31795 bytes sin imagen. Idénticas, porque lo que se ve en el post es el
 * rectángulo del fondo y no un error. Por el mismo proxy, 700427 bytes. La Genterula son
 * 65 de las 111 imágenes de la home, así que esto no era un caso raro: era la mitad de
 * las diapositivas de un post normal.
 *
 * **Por qué el proxy y no reintentar con otro User-Agent.** `next/og` acepta un `fetch`
 * propio, pero eso es una línea por ruta y una lista de cabeceras que alguien tendría
 * que mantener. `/api/img` ya existe, ya pone un User-Agent de navegador, ya está en la
 * lista blanca de hosts y ya lo usan las trece tarjetas de la web. La imagen la descarga
 * el sitio, no el renderizador, y por lo tanto sale por el mismo camino que todo lo
 * demás.
 *
 * **Y por qué el `null` se decide antes que la ruta.** `/api/img` responde 400 a un host
 * que no está en `IMAGE_HOSTS`, así que mandar ahí una URL que no va a ser servida
 * convierte un 403 en un 400 y no arregla nada. Primero `radioImagenPromo`, y solo
 * después la pregunta de por dónde va.
 *
 * **Por qué sale absoluta.** `ImageResponse` no tiene origen contra el que resolver una
 * ruta relativa: `<img src="/logo.svg">` no la descarga. Para las rutas del propio sitio,
 * que `radioImagenPromo` acepta porque el logo sí se pinta en la web, eso significa
 * prefijar `ORIGEN_PROMO`.
 */
export function urlImagenPromo(url: string | undefined | null): string | null {
  const servible = radioImagenPromo(url);
  if (servible === null) return null;

  if (debeUsarProxy(servible)) {
    return `${ORIGEN_PROMO}/api/img?url=${encodeURIComponent(servible)}`;
  }

  return servible.startsWith("/") ? `${ORIGEN_PROMO}${servible}` : servible;
}

/**
 * El pie de foto.
 *
 * Va escrito a mano y no se genera con una plantilla: un pie de foto es texto de
 * persona, y la diferencia entre "3 planes para hoy" y "3 planes para hoy 👇" es la
 * diferencia entre un post que se lee y uno que se salta. Lo que sí es mecánico es
 * la lista, y esa sale de los datos.
 */
export function textoDelPie(
  lista: Array<{ title: string; location: string }>,
  desde: string,
  hasta: string
): string {
  const ventana = desde === hasta ? "HOY" : "ESTE FINDE";
  if (lista.length === 0) {
    return `${ventana} no hay nada recomendado.\n\nPero el resto de la agenda sí: mira la de aquí abajo.`;
  }

  const lineas = lista.map(
    (e) => `• ${e.title}${e.location ? ` — ${e.location}` : ""}`
  );

  return [
    `${ventana} en Vitoria-Gasteiz: ${lista.length} ${lista.length === 1 ? "plan" : "planes"} que recomendamos.`,
    "",
    ...lineas,
    "",
    "La agenda completa, con las 28 fuentes:",
  ].join("\n");
}