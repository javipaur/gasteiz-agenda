import { IMAGE_HOSTS } from "./image-hosts";

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