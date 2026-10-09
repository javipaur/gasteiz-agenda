import { IMAGE_HOSTS } from "./image-hosts";
import { debeUsarProxy } from "./image-proxy";
import { localDateStr } from "./utils";

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

/**
 * Cuántos eventos entran en un post, y por qué es un solo número para todos.
 *
 * **Instagram no acepta más de diez diapositivas, y una es la portada.** De ahí el
 * nueve.
 *
 * **El número estaba escrito en tres sitios y no coincidían**: aquí, `LIMITE_POR_DEFECTO`
 * en `lib/recomendados.ts` —que son 8— y un `limite: 9` a pelo en la ruta de la
 * portada. La consecuencia medida fue que el post del finde del 10 y 11 de octubre
 * llevaba 9 diapositivas y la página a la que enlazaba pintaba 8 tarjetas: **el
 * noveno evento salía en la imagen del carrusel y no estaba donde el enlace
 * prometía.** Por eso `/hoy` usa este número y no el del selector: la página a la
 * que lleva un post no puede enseñar menos que el post.
 *
 * **`LIMITE_POR_DEFECTO` sigue siendo 8** y no se toca: es el valor por defecto de un
 * selector genérico, y este número es de un canal concreto.
 *
 * **Y bajó de nueve a seis.** Instagram admite diez, así que el nueve no lo ponía el
 * límite sino una decisión de lectura: con seis el carrusel se termina en el móvil sin
 * desplazar, y un post que hay que arrastrar hasta el final es un post que no se ve
 * entero. Además con la deduplicación de días, nueve plazas dejaban dos para el mismo
 * evento en fechas distintas.
 */
export const MAX_DIAPOSITIVAS = 6;

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

/** La ventana que toca publicar un día dado, o `null` si ese día no se publica. */
export type VentanaPromo = {
  desde: string;
  hasta: string;
  etiqueta: "HOY" | "ESTE FINDE";
};

/**
 * Tres días de siete, y la regla es una tabla del calendario.
 *
 * | Día | Publica |
 * |---|---|
 * | jueves | ese jueves |
 * | viernes | ese viernes |
 * | sábado | ese sábado y el domingo |
 * | domingo, lunes, martes y miércoles | nada |
 *
 * **Un cron diario con una tabla dentro es una entrada en Dokploy que se mantiene sola.**
 * Tres tareas de cron son tres que hay que configurar y que se desincronizan el día que
 * una falla sin que nadie lo note.
 *
 * **El domingo es `null` a propósito, y es el caso que más conviene mirar.** El sábado
 * publica el finde entero, así que el domingo volver a publicar mandaría el mismo
 * carrusel dos días seguidos. Cuando solo se publicaba los viernes el domingo sí
 * devolvía el finde en curso, y era lo correcto entonces; con tres ventanas es
 * exactamente el bucle a evitar.
 *
 * **La fecha va como argumento y no se lee dentro.** Sin eso la tabla de arriba no se
 * podría escribir, y una tabla que no se puede probar es una intención.
 *
 * **`null` y un error no son lo mismo, y por eso una fecha rota lanza.** Un `null`
 * significa "hoy no se publica", que es una respuesta correcta y silenciosa; una fecha
 * inválida tiene que ser un error, porque si no el cron se creería que hoy no toca y
 * saldría con 0 sin mandar nada, tres viernes seguidos sin que nadie lo advierta.
 */
export function ventanaDelDia(hoy: string): VentanaPromo | null {
  const dia = new Date(`${hoy}T12:00:00`);
  if (isNaN(dia.getTime())) {
    throw new Error(`ventanaDelDia necesita una fecha YYYY-MM-DD, y recibió "${hoy}"`);
  }

  // `getDay()` es 0 el domingo y 6 el sábado. El mediodía evita el borde del cambio de
  // hora: con medianoche, un día que cambia de hora local se desplaza de sábado a
  // viernes o al revés.
  const diaSemana = dia.getDay();

  if (diaSemana === 6) {
    return { desde: hoy, hasta: sumarDias(hoy, 1), etiqueta: "ESTE FINDE" };
  }
  if (diaSemana === 4 || diaSemana === 5) {
    return { desde: hoy, hasta: hoy, etiqueta: "HOY" };
  }

  return null;
}

/** La forma que consume la publicación. Cerrada: un campo que sobra lo lee sin querer. */
export type PaquetePromo = {
  portada: string;
  imagenes: string[];
  pie: string;
  texto: string;
  enlace: string;
};

/**
 * El paquete del día o del finde, listo para mandar por correo.
 *
 * **Recibe la lista ya seleccionada y no los eventos**, y el motivo es que quien llama
 * es quien ha llamado al selector: el script necesita quedarse con la lista para poner
 * el título de cada diapositiva bajo su imagen en el correo. Si esta función recibiera
 * los eventos y llamara a `recomendados` por dentro, el script tendría que volver a
 * seleccionar para tener los títulos, y dos llamadas al selector son dos reglas que
 * divergen el día que se toque una.
 *
 * **El paquete deja de definirse en la ruta.** `app/api/promo/route.ts` es un envoltorio
 * que llama a esta hoja, y el script importa la misma. Dos copias divergirían el día que
 * se tocara una, y las dos seguirían funcionando: ese es el fallo caro, el que nadie ve.
 *
 * **No hay ninguna llamada a la Graph API aquí ni en ninguna parte de este proyecto.**
 * Publicar es una decisión editorial y la publicación es manual.
 */
export function paqueteDePromo(
  lista: Array<{ slug: string; title: string; location: string }>,
  { desde, hasta }: { desde: string; hasta: string }
): PaquetePromo {
  const ventana = `${ORIGEN_PROMO}/hoy?desde=${desde}&hasta=${hasta}`;
  return {
    portada: urlDePromo(desde),
    imagenes: lista.map((e) => urlDePromo(desde, e.slug)),
    pie: ventana,
    texto: textoDelPie(lista, desde, hasta),
    // El `utm_content` lleva la fecha y no un texto fijo, que es lo que permite saber
    // después qué post trajo visitas. Solo sirve si `NEXT_PUBLIC_ANALYTICS_URL` está
    // puesta en Dokploy: `app/components/Analytics.tsx` devuelve `null` sin ella.
    enlace: `${ventana}&utm_source=ig&utm_medium=social&utm_content=gasteizclick-${desde}`,
  };
}

/** Suma días a una fecha local y la vuelve a escribir como `YYYY-MM-DD`. */
function sumarDias(ymd: string, dias: number): string {
  const d = new Date(`${ymd}T12:00:00`);
  d.setDate(d.getDate() + dias);
  return localDateStr(d);
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