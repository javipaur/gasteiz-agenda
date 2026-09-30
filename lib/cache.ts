import fs from 'fs/promises';
import path from 'path';
import { tmpdir } from 'os';

const CACHE_DIR = path.join(tmpdir(), 'gasteiz-cache');

/**
 * Peticiones en vuelo, por clave. La idea es que N llamadas concurrentes a la
 * misma clave ejecuten el `fetcher` **una sola vez**: la segunda espera a la
 * primera en vez de arrancar la suya.
 *
 * Sin esto, con la caché fría y tráfico normal, el coste se multiplica por el
 * número de peticiones simultáneas. Para una fuente de 6,5 MB son descargas
 * repetidas y simultáneas al servidor de la otra punta, no una: la primera
 * petición de una web con RSC y un sitemap son las mínimas que se solapan.
 *
 * Solo vive entradas mientras dura el `fetcher` y se borra al terminar, así que
 * no crece. La comparación de identidad del borrado importa: si la primera
 * llamada se vacila y otra entra después con su propia promesa, el `finally` de
 * la primera no puede llevarse por delante la entrada de la segunda.
 */
const enVuelo = new Map<string, Promise<unknown>>();

function sanitizeKey(key: string): string {
  return Buffer.from(key).toString('base64url').slice(0, 120);
}

async function fetchAndStore<T>(
  key: string,
  ttlMs: number,
  fetcher: () => Promise<T>
): Promise<T> {
  const filePath = path.join(CACHE_DIR, `${sanitizeKey(key)}.json`);

  try {
    const stat = await fs.stat(filePath);
    const age = Date.now() - stat.mtimeMs;
    if (age < ttlMs) {
      const raw = await fs.readFile(filePath, 'utf-8');
      return JSON.parse(raw);
    }
  } catch {}

  const data = await fetcher();

  try {
    await fs.mkdir(CACHE_DIR, { recursive: true });
    await fs.writeFile(filePath, JSON.stringify(data, null, 0), 'utf-8');
  } catch {}

  return data;
}

export async function getCachedOrFetch<T>(
  key: string,
  ttlMs: number,
  fetcher: () => Promise<T>
): Promise<T> {
  const pendiente = enVuelo.get(key);
  if (pendiente) return pendiente as Promise<T>;

  const propia = fetchAndStore(key, ttlMs, fetcher);
  enVuelo.set(key, propia);

  try {
    return await propia;
  } finally {
    // Se borra también cuando el `fetcher` falla, y por eso va en `finally` y no
    // en el camino feliz. Si la entrada se quedara, toda llamada posterior a la
    // clave recibiría la promesa rechazada de un intento que ya terminó: no
    // volvería a intentarlo nunca, y el fallo de un scrape se convertiría en un
    // fallo permanente de esa fuente.
    if (enVuelo.get(key) === propia) enVuelo.delete(key);
  }
}
