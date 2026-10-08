/**
 * La regla que decide si una imagen va por `/api/img` o por `/_next/image`.
 *
 * **Por qué esto importa.** El optimizador de `next/image` manda `user-agent: node`
 * hardcodeado (`BASE_REQ_HEADERS` en `image-optimizer.js` de Next 16) y no hay opción de
 * `next.config.ts` para cambiarlo. La Genterula bloquea cualquier User-Agent que contenga
 * la cadena "node", así que sus fotos nunca llegan al optimizador y las tarjetas pintaban
 * el degradado gris del tile: 65 de las 111 imágenes de la home.
 *
 * **Por qué las tarjetas llaman a `propsImagen` y no a las dos piezas.** Un `<Image
 * src={…} unoptimized={…}>` repetido trece veces es trece sitios donde se puede olvidar
 * la segunda prop, y olvidarla no rompe la página: hace que la imagen vuelva a pasar por
 * el optimizador, que la pide a nuestro propio origen y la devuelve sin redimensionar.
 * Un fallo silencioso que se ve en el peso de la imagen y en ningún error. Devolviendo
 * las dos props juntas no hay forma de dejar una fuera.
 */
import { imagenServible } from "@/lib/image-hosts";

/**
 * Los hosts cuyo WAF rechaza las cabeceras del optimizador de Next.
 *
 * **Y también las del renderizador de las tarjetas de redes.** El motivo por el que la
 * lista se exporta es este: `ImageResponse` —el SVG de `next/og`— descarga las
 * imágenes con el `fetch` de Node, que manda la misma cadena "node". Una tarjeta de
 * `app/api/promo` que le pase la URL cruda de uno de estos hosts sale con un
 * rectángulo del color del fondo, no con un error. Medido el 8 de octubre de 2026 con
 * `ImageResponse` de verdad, a 1080×1350: 31795 bytes con la URL cruda —igual que el
 * fondo vacío— y 700427 bytes pasando por `/api/img`.
 * `urlImagenPromo` de `lib/promo.ts` manda estos hosts por `/api/img` por eso, y el
 * test que lo comprueba enumera esta lista en vez de escribir los nombres a mano, que
 * es lo que hace que un host nuevo no se escape.
 *
 * **El criterio es medido y hay que volver a medirlo.** El optimizador manda
 * `user-agent: node` hardcodeado en `BASE_REQ_HEADERS` (`image-optimizer.js` de Next 16)
 * y no hay ninguna opción de `next.config.ts` para cambiarlo, así que la única pregunta
 * que decide si un host funciona aquí es si su WAF deja pasar esa cadena.
 *
 * La Genterula no la deja pasar. Tres peticiones por valor contra el sitio en vivo el 7
 * de octubre de 2026: `node` y `Node.js` devolvieron 403 las seis, y `undici/7`,
 * `curl/8`, `Mozilla/5.0` y sin `User-Agent` devolvieron 200 los doce. El bloqueo es de
 * la cadena, no del cliente: el mismo Chrome que sí lo ve en su navegador recibe 403
 * desde el servidor. Repetido el 8 de octubre de 2026 contra el mismo sitio, con el
 * `fetch` de Node y no con `curl`: 403 sin tocar nada y 200 con un `user-agent`
 * de navegador, que es exactamente por lo que `app/api/img/route.ts` pone uno
 * explícito.
 *
 * **El fallo que arregla esto era grande y estaba en producción.** 65 de las 111 imágenes
 * de la home salían rotas, todas de este host, todas con el degradado gris del tile. El
 * commit `e8ada65` metió el host en `remotePatterns` y quitó el crash, pero dejó el
 * síntoma: estar en la lista evita que `next/image` lance, no que el host conteste.
 *
 * Un host sale de aquí cuando su WAF deje de rechazar un UA de navegador. Eso se
 * comprueba en un minuto, que es por lo que esto es una decisión revisable y no una
 * sentence permanente: nada de esto es "hasta que se arregle", es "mientras el WAF
 * bloquee esa cadena", y la medición está escrita para que se pueda repetir.
 */
export const HOSTS_CON_WAF_QUE_RECHAZA_NODE: ReadonlySet<string> = new Set([
  "lagenterula.com",
  "www.lagenterula.com",
]);

/** Esquema y host de una URL absoluta. El grupo 1 es el host. */
const URL_ABSOLUTA = /^https?:\/\/([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/;

/**
 * Si esta imagen tiene que pasar por `/api/img` en vez de por `/_next/image`.
 *
 * Las dos condiciones hacen falta juntas, y por razones distintas:
 *
 * - **El host tiene que estar bloqueado arriba.** Si no, `/api/img` es un proxy inútil:
 *   se pierde el redimensionado y la conversión a AVIF/WebP que da el optimizador, a
 *   cambio de nada. Los otros veinticinco hosts de la lista funcionan con el optimizador.
 * - **La URL tiene que ser servible.** Un host que no está en `IMAGE_HOSTS` no se
 *   descarga por ninguna de las dos rutas; `imagenServible` lo dice y la tarjeta degrada
 *   al tile, que es lo que ya hace.
 *
 * Es un `boolean` y no un type guard, a diferencia de `imagenServible`: el `src` no
 * cambia, solo el prefijo que se le pone delante, así que no hay nada que estrecha.
 */
export function debeUsarProxy(url: string | undefined | null): boolean {
  if (!imagenServible(url)) return false;

  const m = URL_ABSOLUTA.exec(url);
  if (!m) return false;

  return HOSTS_CON_WAF_QUE_RECHAZA_NODE.has(m[1].toLowerCase());
}

/** Lo que se le pasa a `<Image {...}>`. */
export type PropsImagen = {
  readonly src: string;
  readonly unoptimized: boolean;
};

/**
 * Las props del `<Image>` de una imagen de la agenda, o `undefined` si no se puede pintar.
 *
 * Es la función que las tarjetas usan, y decide las tres cosas a la vez: si la imagen se
 * puede pintar —y si no, `undefined`, que es lo que hace que la tarjeta caiga en su
 * degradado en vez de tumbar la página—, por qué ruta va, y si se salta el optimizador.
 *
 * Las rutas del propio sitio —el logo, `/carteles/…`— salen con `unoptimized: false`:
 * no tienen host y no pasan ni por el optimizador ni por el proxy, así que el
 * optimizador es justo lo que quieren.
 *
 * `unoptimized` va pegado a la decisión porque las dos van juntas siempre: un `src` con el
 * prefijo de `/api/img` y sin `unoptimized` vuelve a pasar por el optimizador, que pide
 * esa ruta a nuestro propio origen y la devuelve sin redimensionar. No es un error rojo,
 * es un peso de más que nadie ve.
 */
export function propsImagen(url: string | undefined | null): PropsImagen | undefined {
  if (!imagenServible(url)) return undefined;
  if (!debeUsarProxy(url)) return { src: url, unoptimized: false };
  return { src: `/api/img?url=${encodeURIComponent(url)}`, unoptimized: true };
}

/**
 * La URL sola, para el caso de que un sitio la necesite sin las props.
 *
 * Existe porque hay al menos un consumidor que compara URLs —un `find` sobre una lista,
 * un `src` que se pasa a un `<img>` plano— y no tiene un `<Image>` que montar. Devolver
 * `undefined` con el mismo contrato que `propsImagen` es lo que permite que los dos se
 * usen sinstitutivamente.
 */
export function urlImagen(url: string | undefined | null): string | undefined {
  return propsImagen(url)?.src;
}