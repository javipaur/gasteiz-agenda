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
 * El tamaño de una historia: 1080×1920, que es 9:16.
 *
 * **No es el de las historias de Instagram**, que occupies pantalla completa y cambian
 * según el móvil. Es el formato de origen de un Reel o de un vídeo, y es el único que
 * genera `ImageResponse` con una proporción fija. Se sube como imagen y se recorta por
 * arriba y por abajo en cada pantalla.
 *
 * **Va en su propia constante y no como un segundo `TAMANO_*` en cada ruta.** El error
 * concreto que evita: cambiar la proporción de las tarjetas del feed y que las historias
 * sigan en 4:5, o al revés. Son dos formatos con dos gramáticas, y un solo número de
 * tamaño sería uno solo para las dos.
 */
export const TAMANO_HISTORIA = { width: 1080, height: 1920 } as const;

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
 * **Y subió de seis a diez, porque el «límite de diez» que lo justificaba era falso.**
 * El comentario anterior afirmaba que Instagram no acepta más de diez diapositivas y de
 * ahí salía el seis. Comprobado contra la documentación de Meta en octubre de 2026: un
 * carrusel admite **veinte** hijos. Así que el seis nunca lo puso la plataforma, lo puso
 * una decisión de lectura —«con seis el carrusel se termina sin desplazar»—, y esa
 * decisión se revisa ahora con el número delante: medido el 23 de octubre de 2026, la
 * cuenta de referencia del sector publica **13 diapositivas o más** por post, y nosotros
 * seis, con 56 seguidores y dos publicaciones. Lo que falta ahí no es brevedad.
 *
 * **Diez y no veinte, por el mismo motivo en la otra dirección.** Veinte diapositivas de
 * una ciudad de 250.000 habitantes son la agenda entera, y la agenda entera ya está en
 * el enlace. Diez es lo que cabe en el pulgar sin que ninguna diapositiva sobre, y lo
 * que hace que el «10 planes» del pie de foto sea verdad y no una promesa a medias.
 *
 * **El número aparece en tres sitios y tiene que ser el mismo:** el pie de foto, el
 * carrusel y `/hoy`. Ya pasó una vez que el post llevaba nueve y la página ocho.
 */
export const MAX_DIAPOSITIVAS = 10;

/**
 * Los colores del paquete de redes.
 *
 * **Los mismos que la web y que `public/brand-mark.svg`**, y en un solo sitio por el
 * mismo motivo que `TAMANO_PROMO`: el día que la marca cambie de rojo, este es el
 * fichero que se toca. La versión anterior de estas tarjetas usaba `#141210` y
 * `#E0A34E`, que no son de la marca: eran un tema oscuro elegido a mano para una serie
 * de tres imágenes que no se parecía a nada de lo que hay en el sitio.
 */
export const PALETA_PROMO = {
  /** El crema de la marca. Es el fondo de todas las tarjetas del carrusel. */
  papel: "#faf9f5",
  /** El marco de las fotos: un paso más oscuro que el papel, para que la foto tenga borde. */
  marco: "#efece4",
  tinta: "#1c1917",
  tintaSuave: "#57534e",
  tintaTenue: "#78716c",
  rojo: "#dc2626",
  mostaza: "#a16207",
  filete: "#e7e5e4",
} as const;

/**
 * Las etiquetas del pie de foto.
 *
 * **Cinco y no treinta.** Un muro de etiquetas no da alcance desde 2023: lo que mueve
 * una cuenta pequeña es la primera línea y que alguien guarde o comparta, no la lista.
 * Así que aquí van las cinco que describen la cuenta —ciudad, planes, agenda, ocio— y
 * ninguna genérica del tipo `#photooftheday`, que trae seguidores que no son de aquí.
 *
 * **`#Gasteiz` además de `#VitoriaGasteiz`**, porque la ciudad se busca con las dos y la
 * segunda es la que usa la gente de casa.
 */
export const HASHTAGS_PROMO = [
  "#VitoriaGasteiz",
  "#Gasteiz",
  "#PlanesVitoria",
  "#AgendaVitoria",
  "#OcioVitoria",
].join(" ");

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
 * La URL de la historia del día, en vertical.
 *
 * **Vive en la hoja y no se escribe a mano en el correo.** Es lo mismo que hizo mal el
 * enlace del post cuando estaba duplicado en tres sitios: una URL escrita en dos ficheros
 * es una URL que un día apunta a un sitio y al otro a nada.
 */
export function urlHistoria(fecha: string): string {
  return `${ORIGEN_PROMO}/api/promo/${fecha}/historia`;
}

/**
 * El post de presentación: quiénes somos. Y no es un plan de hoy.
 *
 * **Va en el paquete pero como campo aparte, y no como una diapositiva más.** Es otro
 * post: este no caduca, mientras que el carrusel de la agenda cambia cada mañana. Si
 * fuera una diapositiva ocuparía la última posición —justo donde quien publica espera el
 * plan del sábado— y se publicaría por error. Mandarlo en su propio bloque, con su
 * propio pie de foto, es lo que evita esa confusión.
 *
 * **Solo se incluye cuando hay algo que presentar**, y por eso la decisión es del
 * script y no de aquí. Una cuenta que ya se conoce no necesita el "quiénes somos" cada
 * jueves; mandarlo siempre solo consigue que deje de leerse. La variable es
 * `PROMO_CON_PRESENTACION`.
 */
export const URL_PRESENTACION = `${ORIGEN_PROMO}/api/promo/presentacion`;

/**
 * El pie del post de presentación.
 *
 * **Va escrito a mano, y no generado como `textoDelPie`.** Aquel sí sale de los datos
 * —cuántos planes, de qué categorías, para qué fechas—, porque eso cambia cada día.
 * Este no: es un texto fijo sobre la cuenta, y un texto fijo es justo lo que lo hace
 * legible.
 *
 * **Sin `utm_content` con fecha, a diferencia del enlace del carrusel.** El del día lo
 * lleva porque su pregunta es "qué post trajo visitas", y esa pregunta tiene respuesta
 * distinta cada día. Aquí el enlace es siempre el mismo, así que el parámetro solo
 * serviría para distinguir dos posts idénticos.
 */
export const TEXTO_PRESENTACION = [
  "Vitoria-Gasteiz tiene planes de sobra. El problema era encontrarlos.",
  "",
  "Gasteiz Click junta la agenda de toda la ciudad en un solo sitio y te dice qué merece la pena hoy.",
  "Gratis, sin registro y sin que te manden nada.",
  "",
  "Guárdalo, y mándaselo a quien siempre te dice «cuando quieras». 👇",
  "",
  HASHTAGS_PROMO,
].join("\n");

/** El enlace del post de presentación: siempre el mismo, y sin utm. */
export const ENLACE_PRESENTACION = ORIGEN_PROMO;

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
 * Qué días se publica, y qué ventana lleva cada uno.
 *
 * | Día | Publica |
 * |---|---|
 * | domingo, lunes, martes y miércoles | ese día |
 * | jueves | ese jueves |
 * | viernes | ese viernes |
 * | sábado | ese sábado y el domingo |
 *
 * **Antes eran tres días de siete y ahora son siete, y el motivo está medido.** Los tres
 * días originales —jueves, viernes y sábado— eran una decisión editorial tomada cuando
 * el objetivo era no cansar. Midiendo la agenda del 13 al 26 de octubre sale que **los
 * catorce días tienen los seis planes completos**: no hay un día flojo en el calendario, y
 * el veto de cuatro días no respondía a que faltara contenido sino a que sobraban correos.
 *
 * **La tabla está en un `Record` y no en un `if` para que sea un dato y no una decisión
 * repartida por el código.** Cambiar la cadencia es cambiar esta constante, y el cambio
 * se lee de un vistazo. Un `switch` con siete casos parece lo mismo y no lo es: con un
 * `switch` habría que tocar la función y acordarse de añadir el día nuevo a dos sitios.
 *
 * **`lunes` a `miércoles` devuelven ese mismo día, y no el día anterior.** Es lo que
 * distingue este cambio de un simple "publicar el finde también entre semana": el
 * contenido cambia cada día y el enlace lleva la `utm` de esa fecha, así que el miércoles
 * enlaza al miércoles. Reutilizar la ventana del sábado mandaría el mismo carrusel cinco
 * días con la misma `utm`, y los cinco aparecerían como el mismo post en las estadísticas.
 */
const VENTANAS_POR_DIA: Record<number, (hoy: string) => VentanaPromo | null> = {
  // `getDay()` es 0 el domingo. El mediodía evita el borde del cambio de hora: con
  // medianoche, un día que cambia de hora local se desplaza de sábado a viernes o al revés.
  0: (hoy) => ({ desde: hoy, hasta: hoy, etiqueta: "HOY" }),
  1: (hoy) => ({ desde: hoy, hasta: hoy, etiqueta: "HOY" }),
  2: (hoy) => ({ desde: hoy, hasta: hoy, etiqueta: "HOY" }),
  3: (hoy) => ({ desde: hoy, hasta: hoy, etiqueta: "HOY" }),
  4: (hoy) => ({ desde: hoy, hasta: hoy, etiqueta: "HOY" }),
  5: (hoy) => ({ desde: hoy, hasta: hoy, etiqueta: "HOY" }),
  6: (hoy) => ({ desde: hoy, hasta: sumarDias(hoy, 1), etiqueta: "ESTE FINDE" }),
};
/**
 * La ventana de un día, o `null` si ese día no se publica.
 *
 * **La tabla decide y esta función solo la consulta**, y por eso no hay un `if` con los
 * días dentro: `VENTANAS_POR_DIA` es el sitio donde se cambia la cadencia, y aquí solo se
 * traduce "qué día es hoy" a "qué ventana hay".
 *
 * **Un día sin entrada en la tabla devuelve `null`, y no hay ninguna ahora mismo.** El
 * `?? null` está para que añadir un día no pueda olvidarse de esta función, y para que un
 * error de dedo en la tabla se vea como "no publica" en vez de como una excepción que tumba
 * el cron.
 *
 * **Una fecha rota lanza, y no devuelve `null`.** `null` significa "hoy no se publica", que
 * es una respuesta correcta y silenciosa; una fecha inválida es un error, porque si no el
 * cron se creería que hoy no toca y saldría con 0 sin mandar nada, siete días seguidos sin
 * que nadie lo advierta. Con siete días publicando, ese falso silencio es mucho más caro.
 */
export function ventanaDelDia(hoy: string): VentanaPromo | null {
  const dia = new Date(`${hoy}T12:00:00`);
  if (isNaN(dia.getTime())) {
    throw new Error(`ventanaDelDia necesita una fecha YYYY-MM-DD, y recibió "${hoy}"`);
  }

  // El mediodía evita el borde del cambio de hora: con medianoche, un día que cambia de
  // hora local se desplaza de sábado a viernes o al revés.
  const construir = VENTANAS_POR_DIA[dia.getDay()];
  return construir ? construir(hoy) : null;
}

/** La forma que consume la publicación. Cerrada: un campo que sobra lo lee sin querer. */
export type PaquetePromo = {
  portada: string;
  imagenes: string[];
  /**
   * El título de cada diapositiva, en el mismo orden que `imagenes`.
   *
   * **Va en el paquete y no se reconstruye al consumirlo**, y el motivo es que el
   * cliente de correo necesita poner el nombre de cada plan bajo su imagen. Si el que
   * lee el paquete calculara los títulos por su cuenta —o los sacara de los slugs—,
   * tendría su propia copia de la lista, y es justo la copia que se desincroniza: una
   * lista local puede tener un evento que la de producción todavía no conoce, y de ahí
   * salen los 404 al descargar. Al viajarlos juntos, **la imagen y su nombre son la misma
   * verdad**, porque los ha puesto el mismo sitio en el mismo momento.
   *
   * El slug es un nombre de fichero, no un título: `l0rna-9-de-octubre-jimmy-jazz-…` no
   * es lo que hay que poner bajo la diapositiva.
   */
  titulos: string[];
  pie: string;
  texto: string;
  enlace: string;
  /**
   * El criterio con el que se eligió el orden, y si llegó a aplicarse.
   *
   * **Es `null` cuando no hubo casting**, que es un caso normal y no un fallo: el modelo
   * no respondió, se publica con el orden por puntuación y el pie se lee igual. Se escribe
   * en el paquete porque es la respuesta a "por qué el post de hoy sale así", y porque
   * está en `paquete.json` junto a lo demás.
   */
  casting: { motivo: string; aplicado: boolean } | null;
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
 * **Aquí no hay ninguna llamada a la Graph API, y no la va a haber.** Este fichero
 * prepara el paquete y nada más: el token no vive en el repositorio y publicar es una
 * decisión editorial de una persona.
 *
 * **Lo que sí se ha decidido después es no hacerlo todo a mano.** Cuando esa persona
 * decida publicar, subir once imágenes una por una desde el móvil es donde se pierden
 * los posts. Esa parte vive **fuera** de este proyecto, en el flujo de n8n, que lee
 * `/api/promo?fecha=` y es quien guarda el token. Así que la frontera queda así: el
 * repositorio sirve el paquete y nunca publica; n8n publica y nunca decide.
 *
 * **Y por eso `MAX_DIAPOSITIVAS` importa más que antes.** Ese número es exactamente el
 * de imágenes que n8n sube como hijos del carrusel: si el límite cambia aquí y no en el
 * flujo, el carrusel sale incompleto sin que nada falle.
 */
export function paqueteDePromo(
  lista: Array<{ slug: string; title: string; location: string }>,
  { desde, hasta }: { desde: string; hasta: string },
  casting: { motivo: string; aplicado: boolean } | null = null
): PaquetePromo {
  const ventana = `${ORIGEN_PROMO}/hoy?desde=${desde}&hasta=${hasta}`;
  return {
    portada: urlDePromo(desde),
    imagenes: lista.map((e) => urlDePromo(desde, e.slug)),
    titulos: lista.map((e) => e.title),
    casting,
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
 * **La forma la copia la cuenta de referencia del sector, y no por imitación sino porque
 * cada línea hace un trabajo.**
 *
 * 1. **La promesa, con número y con fechas.** «10 planes en Vitoria-Gasteiz, del sábado
 *    10 al domingo 11 de octubre.» Es lo único que se lee en el feed antes del «ver
 *    más», así que tiene que decir cuánto hay y para cuándo. El pie anterior empezaba
 *    por «HOY en Vitoria-Gasteiz: 6 planes que recomendamos», que promete lo mismo sin
 *    decir cuándo acaba.
 * 2. **Qué hay dentro.** «Día, hora, sitio y precio en cada uno.» Es la razón para
 *    deslizar: si el carrusel tiene lo que hace falta para decidir, no hace falta abrir
 *    el enlace.
 * 3. **El abanico de categorías.** Sustituye a la lista de seis viñetas. Una lista de
 *    títulos en el pie es un índice de algo que ya está en las diapositivas; el abanico
 *    dice de qué va la semana, que es lo que decide si alguien sigue leyendo. Y sale de
 *    los datos, no de una plantilla.
 * 4. **La pregunta.** «¿Cuál te llevas?» es lo que se comparte, y compartir es el único
 *    crecimiento que tiene una cuenta de 56 seguidores.
 * 5. **Los hashtags.** Cinco, los de `HASHTAGS_PROMO`.
 *
 * **Se fue la línea «la agenda completa, con las 28 fuentes».** Era un número interno:
 * a quien lee el post le da igual de cuántas webs sale el dato, y decírselo convierte
 * una recomendación en un inventario. El enlace lo pone el paquete, no el pie.
 */
export function textoDelPie(
  lista: Array<{ title: string; location: string; category?: string }>,
  desde: string,
  hasta: string
): string {
  if (lista.length === 0) {
    return [
      `${ventanaEnPalabras(desde, hasta)} no hay nada que recomendarte.`,
      "",
      "Pero el resto de la agenda sigue en pie. Está aquí abajo.",
    ].join("\n");
  }

  const cuenta = lista.length === 1 ? "hay 1 plan" : `hay ${lista.length} planes`;
  const abanico = abanicoDeCategorias(lista);

  return [
    `${ventanaEnPalabras(desde, hasta)} ${cuenta} en Vitoria-Gasteiz.`,
    "Día, hora, sitio y precio en cada uno: solo hay que elegir.",
    ...(abanico ? ["", abanico] : []),
    "",
    "¿Cuál te llevas? 👇",
    "",
    "Los demás, por día y por hora, en el enlace de la bio.",
    "",
    HASHTAGS_PROMO,
  ].join("\n");
}

/** Los días y los meses, en minúscula y enteros: el pie es una frase, no una etiqueta. */
const DIAS_SEMANA = [
  "domingo",
  "lunes",
  "martes",
  "miércoles",
  "jueves",
  "viernes",
  "sábado",
];

const MESES_LARGOS = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "octubre",
  "noviembre",
  "diciembre",
];

const DIAS_CORTOS = ["DOM", "LUN", "MAR", "MIÉ", "JUE", "VIE", "SÁB"];

const MESES_CORTOS = [
  "ENE",
  "FEB",
  "MAR",
  "ABR",
  "MAY",
  "JUN",
  "JUL",
  "AGO",
  "SEP",
  "OCT",
  "NOV",
  "DIC",
];

/**
 * La fecha de un `AgendaEvento` como día civil, a mediodía.
 *
 * **`evento.date` no es `AAAA-MM-DD`: es un instante ISO completo**, del tipo
 * `2026-10-23T00:00:00.000Z`. Y ahí estaba el fallo que se vio en la primera
 * diapositiva renderizada: `new Date("2026-10-23T00:00:00.000Z" + "T12:00:00")` es
 * `Invalid Date`, la función devolvía el texto de entrada y la tarjeta acabó enseñando
 * la cadena ISO cruda en la línea de la fecha. **No dio ningún error**: una fecha
 * ilegible es una fecha.
 *
 * Se queda con los diez primeros caracteres y los reinterpreta a mediodía, que es lo
 * mismo que hace `lib/agenda` con estas fechas en el resto del proyecto: el día no se
 * mueve por el huso porque a las 12:00 no hay frontera cerca.
 */
function diaCivil(iso: string): Date | null {
  const ymd = iso.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return null;

  const d = new Date(`${ymd}T12:00:00`);
  return isNaN(d.getTime()) ? null : d;
}

/** `miércoles 21 de octubre` a partir de `2026-10-21` o de su instante ISO. */
function diaEnPalabras(fecha: string): string {
  const d = diaCivil(fecha);
  if (!d) return fecha;
  return `${DIAS_SEMANA[d.getDay()]} ${d.getDate()} de ${MESES_LARGOS[d.getMonth()]}`;
}

/**
 * `VIE 23 OCT`: la fecha de las imágenes, en caja alta y corta.
 *
 * **Va aquí y no en la ruta por el mismo motivo que todo lo demás del paquete.** La
 * tarjeta de evento la necesitaba y la portada necesitaba la de la ventana, y las dos
 * son la misma pregunta —«¿qué día es esto?»— con dos respuestas distintas. Con una
 * copia en cada ruta, el día que una aprenda a leer `evento.date` la otra seguiría
 * escupiendo la cadena ISO, que es exactamente el fallo que esto corrige.
 */
export function fechaCortaPromo(fecha: string): string {
  const d = diaCivil(fecha);
  if (!d) return fecha;
  return `${DIAS_CORTOS[d.getDay()]} ${d.getDate()} ${MESES_CORTOS[d.getMonth()]}`;
}

/**
 * La ventana en la esquina de la portada: `VIE 23 OCT`, `23 — 25 OCT`, `31 OCT — 1 NOV`.
 *
 * **No dice «HOY».** Lo decía, y es una palabra que la imagen no puede saber: la portada
 * se pide por URL con una fecha, y una URL guardada de la semana pasada habría seguido
 * afirmando que es hoy. El día de la semana dice lo mismo sin poder mentir.
 *
 * El mes se escribe **una vez** cuando la ventana no cruza de mes, que es lo que hace
 * que `23 — 25 OCT` se lea de un vistazo y `23 OCT — 25 OCT` no.
 */
export function ventanaCortaPromo(desde: string, hasta: string): string {
  const d1 = diaCivil(desde);
  if (!d1) return "";

  const d2 = desde === hasta ? d1 : diaCivil(hasta);
  if (!d2) return "";

  if (desde === hasta) return fechaCortaPromo(desde);

  const mismoMes = d1.getMonth() === d2.getMonth() && d1.getFullYear() === d2.getFullYear();
  if (mismoMes) return `${d1.getDate()} — ${d2.getDate()} ${MESES_CORTOS[d2.getMonth()]}`;

  return `${d1.getDate()} ${MESES_CORTOS[d1.getMonth()]} — ${d2.getDate()} ${MESES_CORTOS[d2.getMonth()]}`;
}

/**
 * La ventana, al principio de la frase.
 *
 * **`T12:00:00` y no medianoche**, por el mismo motivo que el resto del paquete: una
 * fecha sin hora la parsea el motor como UTC y en `Europe/Madrid` eso es el día
 * anterior. A mediodía el día no se puede mover por el huso.
 *
 * Devuelve «Este miércoles 21 de octubre» o «Del sábado 10 al 11 de octubre»: las dos
 * empiezan por mayúscula porque van al principio de la frase, y el mes se escribe una
 * sola vez cuando es el mismo.
 */
function ventanaEnPalabras(desde: string, hasta: string): string {
  if (desde === hasta) return `Este ${diaEnPalabras(desde)}`;

  const d1 = diaCivil(desde);
  const d2 = diaCivil(hasta);
  if (!d1 || !d2) return `Del ${desde} al ${hasta}`;

  const mismoMes =
    d1.getMonth() === d2.getMonth() && d1.getFullYear() === d2.getFullYear();

  if (mismoMes) {
    return `Del ${DIAS_SEMANA[d1.getDay()]} ${d1.getDate()} al ${d2.getDate()} de ${MESES_LARGOS[d2.getMonth()]}`;
  }
  return `Del ${diaEnPalabras(desde)} al ${diaEnPalabras(hasta)}`;
}

/**
 * De qué va la semana, en una línea, sacado de las categorías de verdad.
 *
 * **Sale de los datos y no de una lista de categorías escrita aquí.** Si un día el post
 * es todo teatro, el pie dice «Todo de teatro»; si hay cinco cosas distintas, dice de
 * dónde a dónde va. Una plantilla con las quince categorías de `lib/categories.ts`
 * mentiría el día que el carrusel no las traiga.
 *
 * Devuelve `null` cuando no hay ninguna categoría —los tests construyen eventos sin
 * ella— y entonces el pie simplemente no lleva la línea. Un hueco se lee mejor que
 * «De undefined a undefined».
 */
function abanicoDeCategorias(lista: Array<{ category?: string }>): string | null {
  const vistas: string[] = [];
  for (const evento of lista) {
    const categoria = evento.category?.trim().toLowerCase();
    if (categoria && !vistas.includes(categoria)) vistas.push(categoria);
  }

  if (vistas.length === 0) return null;
  if (vistas.length === 1) return `Todo de ${vistas[0]}.`;
  if (vistas.length === 2) return `De ${vistas[0]} a ${vistas[1]}.`;

  const primera = vistas[0];
  const ultima = vistas[vistas.length - 1];
  const intermedias = vistas.slice(1, -1);

  if (intermedias.length === 1) {
    return `De ${primera} a ${ultima}, pasando por ${intermedias[0]}.`;
  }

  const cola = intermedias[intermedias.length - 1];
  return `De ${primera} a ${ultima}, pasando por ${intermedias.slice(0, -1).join(", ")} y ${cola}.`;
}