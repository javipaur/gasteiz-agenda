/**
 * La copia de una foto del Ayuntamiento que el otro medio ya publicó.
 *
 * **El fallo que arregla, medido el 26 de noviembre de 2026.** `www.vitoria-gasteiz.org`
 * dejó de responder: el calendario y las nueve fotos municipales del carrusel agotaban el
 * timeout a los ~12 s. `ImageResponse` espera lo mismo y, cuando la descarga falla, no
 * lanza: pinta el rectángulo de reserva con el mismo tamaño que la foto. Diez imágenes
 * así tardan más de un minuto en renderizarse, y Graph rechaza el carrusel con
 * `9004 / 2207052` —«Only photo or video can be accepted as media type»— porque las URLs
 * de los hijos caducan antes de que se suban. Desde fuera parece un error de Meta.
 *
 * **Por qué un espejo y no el proxy.** `/api/img` no arregla un host caído: el servidor
 * tiene que descargar la misma foto y también se queda esperando. En cambio GasteizHoy
 * publica ocho de las nueve fotos con el **mismo id** (`gi_…`) en su WordPress, y ese host
 * sirve la imagen directa en ~150 ms. La novena no tiene copia: ahí la tarjeta se pinta
 * sin foto —la marca de reserva—, que es un dato honesto, en vez de una espera de diez
 * segundos que acaba en un rectángulo que parece una imagen.
 *
 * **Cómo se encuentra la copia, medido el mismo día.** La primera versión preguntaba al
 * REST de WordPress (`wp-json/wp/v2/media?search=gi_…`) y tardaba **16–19 s por id**: diez
 * fotos agotaban el plazo de descarga de los hijos de Instagram aunque el espejo existiera.
 * El fichero está en `/wp-content/uploads/AAAA/MM/gi_….webp`, y una sonda HEAD a esa URL
 * tarda **37–188 ms**. El mes y el año se toman de la fecha del evento, con el año anterior
 * y el mes previo como respaldo: `gi_89795`, la foto del encendido de 2026, se subió en
 * 2025/11. La fecha viaja desde la ruta de render porque el id no codifica cuándo se publicó.
 *
 * **La sonda se inyecta.** Es una petición a un medio de terceros y el módulo se prueba
 * en node, sin red. El resolutor recibe la función de búsqueda, y el buscador recibe el
 * `fetch`, para que un test pueda decidir qué devuelve el espejo y cuándo falla.
 */
import sharp from "sharp";

import { urlImagenPromo } from "@/lib/promo";

/** Qué devuelve una búsqueda: la URL de la copia, o `null` si no hay. */
export type BuscadorDeEspejos = (
  id: string,
  fecha: string | null | undefined
) => Promise<string | null>;

/** Qué devuelve una conversión: un data URI que Satori sí sabe pintar, o nada. */
export type ConvertidorDeEspejos = (url: string) => Promise<string | null>;

/** La URL de la que se busca la copia; un id ajeno no se toca. */
const HOST_MUNICIPAL = /^https?:\/\/www\.vitoria-gasteiz\.org(?:\/|$)/i;
const ID_FOTO = /gi_\d+/i;
const BASE_ESPEJOS = "https://www.gasteizhoy.com/wp-content/uploads";

function idDeFotoMunicipal(url: string): string | null {
  if (!HOST_MUNICIPAL.test(url)) return null;
  return ID_FOTO.exec(url)?.[0] ?? null;
}

/**
 * Los directorios donde GasteizHoy puede haber publicado la copia, por orden.
 *
 * Sin fecha no se inventa un mes: pedir cuatro rutas al azar por una foto que no se sabe
 * cuándo es devolvería imágenes de otros planes con el mismo id de fichero.
 */
function rutasCandidatas(id: string, fecha: string | null | undefined): string[] {
  const partes = /^(\d{4})-(\d{2})-\d{2}/.exec(fecha ?? "");
  if (!partes) return [];

  const anio = Number(partes[1]);
  const mes = Number(partes[2]);
  if (mes < 1 || mes > 12) return [];

  const previo = new Date(Date.UTC(anio, mes - 2, 1));
  const mesPrevio = previo.getUTCMonth() + 1;
  const ruta = (a: number, m: number) =>
    `${BASE_ESPEJOS}/${a}/${String(m).padStart(2, "0")}/${id}.webp`;

  return [
    ruta(anio, mes),
    ruta(anio - 1, mes),
    ruta(anio, mesPrevio),
    ruta(anio - 1, mesPrevio),
  ];
}

/**
 * Un fichero que no existe en WordPress responde 302 a la portada con HTML. Aceptarlo
 * como foto sería peor que no encontrar nada: Satori descargaría una página con el
 * aspecto de una imagen y nadie lo notaría hasta que el post fuera rechazado.
 */
function esFoto(respuesta: Response): boolean {
  if (respuesta.status !== 200) return false;
  if ((respuesta.headers.get("content-type") ?? "").toLowerCase().includes("text/html")) {
    return false;
  }
  const longitud = Number(respuesta.headers.get("content-length"));
  return !Number.isFinite(longitud) || longitud > 0;
}

/** Sonda las rutas posibles y devuelve la primera que contenga una foto. */
export function crearBuscadorDeEspejos(
  fetchImpl: typeof fetch = fetch
): BuscadorDeEspejos {
  return async (id, fecha) => {
    for (const url of rutasCandidatas(id, fecha)) {
      try {
        const respuesta = await fetchImpl(url, {
          method: "HEAD",
          redirect: "manual",
        });
        if (esFoto(respuesta)) return url;
      } catch {
        // Una ruta que falla no descarta las demás.
      }
    }
    return null;
  };
}

/**
 * La copia del otro medio se sirve solo en WebP, y `ImageResponse` no lo pinta.
 *
 * Medido el 26 de noviembre de 2026: el renderizador de Next acepta PNG, JPEG, GIF y
 * SVG, pero lanza `Unsupported image type: image/webp` y calla el error, así que la
 * tarjeta vuelve al rectángulo de reserva aunque la sonda haya encontrado la foto en
 * 150 ms. La URL rápida no arregla nada sin este paso: hay que entregarle al render un
 * data URI JPEG, que sí acepta y al que no tiene que volver a buscar por red.
 */
export async function convertirImagenPromo(
  url: string,
  fetchImpl: typeof fetch = fetch
): Promise<string | null> {
  const control = new AbortController();
  const temporizador = setTimeout(() => control.abort(), 2500);

  try {
    const respuesta = await fetchImpl(url, {
      signal: control.signal,
      headers: { "user-agent": "Mozilla/5.0" },
    });
    if (!respuesta.ok) return null;

    const buffer = Buffer.from(await respuesta.arrayBuffer());
    const jpeg = await sharp(buffer).jpeg({ quality: 85 }).toBuffer();
    return `data:image/jpeg;base64,${jpeg.toString("base64")}`;
  } catch {
    // Un espejo roto no puede tumbar la tarjeta: el hueco honesto vale más.
    return null;
  } finally {
    clearTimeout(temporizador);
  }
}

/**
 * Cambia una foto municipal por su copia; deja las demás como estaban.
 *
 * **Sin copia devuelve `null` y no la URL municipal**, aunque `urlImagenPromo` sabría
 * mandarla por `/api/img`: ese camino es el que acabó en el carrusel rechazado. Ante un
 * host caído, esperar y pintar el rectángulo de reserva es exactamente el fallo que se
 * está arreglando.
 *
 * La caché va por id y mes, no por URL: el mismo plan sale en la portada y en su
 * diapositiva con rutas municipales distintas, y las diez tarjetas se piden a la vez. Sin
 * ella una sola foto costaría diez sondas al otro medio. El mes entra en la clave porque
 * un mismo id puede resolverse distinto en dos campañas, y las peticiones en vuelo se
 * comparten para que una caché fría no dispare una por tarjeta.
 */
export function crearResolutorDeImagenPromo(
  buscar: BuscadorDeEspejos = crearBuscadorDeEspejos(),
  convertir: ConvertidorDeEspejos = convertirImagenPromo
): (
  url: string | null | undefined,
  fecha?: string | null
) => Promise<string | null | undefined> {
  const resueltos = new Map<string, string | null>();
  const enVuelo = new Map<string, Promise<string | null>>();

  return async (url, fecha) => {
    if (!url) return url;

    const id = idDeFotoMunicipal(url);
    if (id === null) return urlImagenPromo(url);

    const clave = `${id}|${(fecha ?? "").slice(0, 7)}`;
    const guardado = resueltos.get(clave);
    if (guardado !== undefined) return guardado;

    let busqueda = enVuelo.get(clave);
    if (!busqueda) {
      busqueda = (async () => {
        try {
          const copia = await buscar(id, fecha);
          return copia ? await convertir(copia) : null;
        } catch {
          return null;
        }
      })();
      enVuelo.set(clave, busqueda);
      void busqueda.then((imagen) => {
        resueltos.set(clave, imagen);
        enVuelo.delete(clave);
      });
    }

    const imagen = await busqueda;
    resueltos.set(clave, imagen);
    return imagen;
  };
}

/** El resolutor que usan las rutas de render. La caché vive mientras viva el proceso. */
export const resolverImagenPromo = crearResolutorDeImagenPromo();
