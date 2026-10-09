import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { Adjunto } from "./mail";

/** Una imagen ya descargada, con el número con el que se sube y el nombre que lleva. */
export type ImagenDescargada = {
  /** `01`, `02`, … Es lo que va al `cid` y al principio del nombre del fichero. */
  indice: string;
  /** El nombre sin número: `portada`, o el slug del evento. */
  nombre: string;
  content: Buffer;
};

/** El nombre completo, en disco y en el adjunto. */
function nombreCompleto(img: ImagenDescargada): string {
  return `${img.indice}-${img.nombre}`;
}

/**
 * Baja las imágenes del paquete y las deja numeradas.
 *
 * **Baja del despliegue y no de un fichero local**, porque el paquete ya existe como
 * URLs públicas servidas por el sitio: `/api/promo` está en `PUBLIC_API_NAMESPACES` justo
 * para eso. Es la misma puerta por la que Meta las descargaría.
 */
export async function descargarImagenes(urls: string[]): Promise<ImagenDescargada[]> {
  return Promise.all(
    urls.map(async (url, i) => {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`No se pudo descargar ${url}: HTTP ${res.status}`);
      return {
        indice: String(i + 1).padStart(2, "0"),
        nombre: i === 0 ? "portada" : slugDe(url),
        content: Buffer.from(await res.arrayBuffer()),
      };
    })
  );
}

/** El último tramo de la URL es el slug del evento. */
function slugDe(url: string): string {
  return url.split("/").pop() ?? "evento";
}

/**
 * Los adjuntos, dos veces.
 *
 * **No es un descuido.** No hay un camino único entre clientes de correo: el que
 * funciona en Gmail no es el que funciona en el cliente por defecto de iOS, y sin la
 * copia `attachment` el correo llega sin fotos en el móvil. Con las dos son 1–3 MB y el
 * límite de Gmail son 25 MB.
 *
 * **El `cid` sale del `indice`, no de trocear el nombre.** Un slug puede empezar por un
 * guion, y `nombre.split("-")[0]` devolvería entonces una cadena vacía: el `cid` sería
 * `promo-` y la imagen no se vería en el correo. Es el tipo de fallo que solo aparece la
 * semana que toca, y por eso el número viaja explícito.
 */
export function adjuntosDe(imagenes: ImagenDescargada[]): Adjunto[] {
  return [
    ...imagenes.map(
      (img): Adjunto => ({
        filename: `${nombreCompleto(img)}.png`,
        content: img.content,
        contentDisposition: "inline",
        cid: `promo-${img.indice}`,
      })
    ),
    ...imagenes.map(
      (img): Adjunto => ({
        filename: `${nombreCompleto(img)}.png`,
        content: img.content,
        contentDisposition: "attachment",
      })
    ),
  ];
}

/**
 * Los ficheros en disco, antes de mandar nada.
 *
 * **El orden lo pone el script, no este módulo:** primero escribe, después manda. Si el
 * correo falla, lo que se necesita ya está aquí.
 *
 * Y por defecto van a `data/promo/<fecha>/`, que **no sobrevive a un redeploy** si Dokploy
 * no tiene volumen montado. Por eso el correo lleva las imágenes dentro y no solo su
 * ruta: el disco es la comodidad, el correo es el canal.
 */
export async function escribirPaqueteEnDisco(
  destino: string,
  desde: string,
  imagenes: ImagenDescargada[],
  paquete: unknown
): Promise<string> {
  const dir = join(destino, desde);
  await mkdir(dir, { recursive: true });
  for (const img of imagenes) {
    await writeFile(join(dir, `${nombreCompleto(img)}.png`), img.content);
  }
  await writeFile(join(dir, "paquete.json"), JSON.stringify(paquete, null, 2), "utf8");
  return dir;
}