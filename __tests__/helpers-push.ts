import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

/**
 * `lib/push.ts` abre `node:sqlite` contra `.data/push.db` y guarda la conexión en
 * una variable de módulo, así que hace falta una base distinta por caso y
 * recargar los módulos entre ellos. `PUSH_DB_DIR` existe justo para esto.
 *
 * Cada `dbDePrueba()` crea un directorio nuevo, y no uno por fichero de test: con
 * uno compartido, las suscripciones de un caso se colaban en el siguiente y los
 * recuentos de `sendToAll` salían con filas de más.
 *
 * Los directorios **no** se borran entre tests. `node:sqlite` mantiene el
 * fichero bloqueado mientras el objeto `DatabaseSync` está vivo, y tras
 * `resetModules` el módulo viejo sigue referenciado hasta que el GC pase, así
 * que en Windows el `rmSync` falla con `EPERM` casi siempre. Se limpian todos al
 * final y el fallo se ignora: si quedan, los borra el temp del sistema, y
 * prefiero eso a un `afterEach` que falla la suite por un fichero abierto.
 */
const dirs: string[] = [];
let dirActual: string | null = null;

export function dbDePrueba(): string {
  const dir = mkdtempSync(join(tmpdir(), "gasteiz-push-"));
  dirs.push(dir);
  dirActual = dir;
  process.env.PUSH_DB_DIR = dir;
  return dir;
}

/**
 * Vuelve a apuntar a la base que ya hay, sin crear otra.
 *
 * Es lo que necesita un caso que quiere comprobar que algo **sobrevive a una
 * recarga de módulos**, que es justo lo contrario de un caso normal: si el estado
 * estuviera en memoria de módulo, recargar lo borraría, y eso es precisamente lo
 * que no debe pasar con el marcador del digest diario.
 */
export function reutilizarDbDePrueba(): string {
  if (!dirActual) throw new Error("No hay base previa que reutilizar");
  process.env.PUSH_DB_DIR = dirActual;
  return dirActual;
}

export function limpiarDbsDePrueba(): void {
  for (const dir of dirs) {
    try {
      rmSync(dir, { recursive: true, force: true, maxRetries: 3, retryDelay: 50 });
    } catch {
      // Sigue bloqueado. El temp del sistema se encarga.
    }
  }
  dirs.length = 0;
  dirActual = null;
  delete process.env.PUSH_DB_DIR;
}

/** Una suscripción con la forma que valida `app/api/push/subscribe/route.ts`. */
export function suscripcion(endpoint: string) {
  return {
    endpoint,
    keys: { p256dh: `p256dh-${endpoint}`, auth: `auth-${endpoint}` },
    addedAt: 1_700_000_000_000,
  };
}

/** Un rechazo de `web-push` con el `statusCode` que dispara la poda. */
export function errorDePush(statusCode?: number): Error & { statusCode?: number } {
  const err = new Error(
    statusCode === 410 ? "Gone" : statusCode === 404 ? "Not Found" : "boom"
  ) as Error & { statusCode?: number };
  if (statusCode !== undefined) err.statusCode = statusCode;
  return err;
}