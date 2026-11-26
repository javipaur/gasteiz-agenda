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
 * **La búsqueda se inyecta.** Es una petición a un WP de terceros y el módulo se prueba
 * en node, sin red. El resolutor recibe la función de búsqueda, y el buscador recibe el
 * `fetch`, para que un test pueda decidir qué devuelve el espejo y cuándo falla.
 */
import { urlImagenPromo } from "@/lib/promo";

/** Qué devuelve una búsqueda: la URL de la copia, o `null` si no hay. */
export type BuscadorDeEspejos = (id: string) => Promise<string | null>;

/** La URL de la que se busca la copia; un id ajeno no se toca. */
const HOST_MUNICIPAL = /^https?:\/\/www\.vitoria-gasteiz\.org(?:\/|$)/i;
const ID_FOTO = /gi_\d+/i;

function idDeFotoMunicipal(url: string): string | null {
  if (!HOST_MUNICIPAL.test(url)) return null;
  return ID_FOTO.exec(url)?.[0] ?? null;
}

/**
 * Busca en el WP de GasteizHoy una foto cuyo fichero lleve el mismo id.
 *
 * `source_url` es lo que el REST devuelve y lo que `ImageResponse` descarga. Aceptar la
 * primera entrada sin mirar el id sería peor que no encontrar nada: una búsqueda por
 * `gi_93095` que devolviera la foto de otro plan pondría en el post una imagen que no
 * corresponde al título, y eso no lo ve nadie.
 */
export function crearBuscadorDeEspejos(
  fetchImpl: typeof fetch = fetch
): BuscadorDeEspejos {
  return async (id) => {
    try {
      const url = `https://www.gasteizhoy.com/wp-json/wp/v2/media?search=${encodeURIComponent(id)}&per_page=5`;
      const respuesta = await fetchImpl(url);
      if (!respuesta.ok) return null;

      const datos: unknown = await respuesta.json();
      if (!Array.isArray(datos)) return null;

      // El id se compara como trozo de nombre de fichero, no como subcadena de la URL:
      // `gi_93095` no puede confundirse con `gi_930951`.
      const esperado = new RegExp(`(^|[^0-9])${id}([^0-9]|$)`);
      for (const entrada of datos) {
        const origen = (entrada as { source_url?: unknown } | null)?.source_url;
        if (typeof origen !== "string") continue;
        const nombre = origen.split("?")[0].split("/").pop() ?? "";
        if (esperado.test(nombre)) return origen;
      }
      return null;
    } catch {
      return null;
    }
  };
}

/**
 * Cambia una foto municipal por su copia; deja las demás como estaban.
 *
 * **Sin copia devuelve `null` y no la URL municipal**, aunque `urlImagenPromo` sabría
 * mandarla por `/api/img`: ese camino es el que acabó en el carrusel rechazado. Ante un
 * host caído, esperar y pintar el rectángulo de reserva es exactamente el fallo que se
 * está arreglando.
 *
 * La caché va por id y no por URL: el mismo plan sale en la portada y en su diapositiva
 * con rutas municipales distintas, y las diez tarjetas se piden a la vez. Sin ella una
 * sola foto costaría diez peticiones al WP ajeno. Las peticiones en vuelo se comparten,
 * para que una caché fría no dispare una por tarjeta.
 */
export function crearResolutorDeImagenPromo(
  buscar: BuscadorDeEspejos = crearBuscadorDeEspejos()
): (url: string | null | undefined) => Promise<string | null | undefined> {
  const resueltos = new Map<string, string | null>();
  const enVuelo = new Map<string, Promise<string | null>>();

  return async (url) => {
    if (!url) return url;

    const id = idDeFotoMunicipal(url);
    if (id === null) return urlImagenPromo(url);

    const guardado = resueltos.get(id);
    if (guardado !== undefined) return guardado ? urlImagenPromo(guardado) : null;

    let busqueda = enVuelo.get(id);
    if (!busqueda) {
      busqueda = (async () => {
        try {
          return await buscar(id);
        } catch {
          return null;
        }
      })();
      enVuelo.set(id, busqueda);
      void busqueda.then((copia) => {
        resueltos.set(id, copia);
        enVuelo.delete(id);
      });
    }

    const copia = await busqueda;
    resueltos.set(id, copia);
    return copia ? urlImagenPromo(copia) : null;
  };
}

/** El resolutor que usan las rutas de render. La caché vive mientras viva el proceso. */
export const resolverImagenPromo = crearResolutorDeImagenPromo();
