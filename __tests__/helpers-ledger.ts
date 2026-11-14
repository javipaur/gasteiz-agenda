import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

/**
 * `lib/event-ledger.ts` abre `node:sqlite` contra `.data/event-ledger.db` y
 * guarda la conexión en una variable de módulo, así que hace falta una base
 * distinta por caso y recargar los módulos entre ellos. `EVENT_LEDGER_DB_DIR`
 * existe justo para esto, igual que `PUSH_DB_DIR` y `METRICAS_DB_DIR` para sus
 * siblings.
 *
 * Cada caso crea un directorio nuevo: con uno compartido, las filas de un caso
 * se colarían en el siguiente y los recuentos de `registrarImportacion` saldrían
 * con eventos de más.
 *
 * Los directorios **no** se borran entre tests, y por el motivo que ya está
 * escrito en `__tests__/helpers-push.ts`: `node:sqlite` mantiene el fichero
 * bloqueado mientras el `DatabaseSync` está vivo, y tras `resetModules` el módulo
 * viejo sigue referenciado hasta que pase el GC, así que en Windows el `rmSync`
 * falla con `EPERM` casi siempre. Se limpian todos al final y el fallo se ignora.
 */
const dirs: string[] = [];
let dirActual: string | null = null;

export function dbDePrueba(): string {
  const dir = mkdtempSync(join(tmpdir(), "gasteiz-ledger-"));
  dirs.push(dir);
  dirActual = dir;
  process.env.EVENT_LEDGER_DB_DIR = dir;
  return dir;
}

/**
 * Vuelve a apuntar a la base que ya hay, sin crear otra.
 *
 * Es lo que necesita un caso que quiere comprobar que algo **sobrevive a una
 * recarga de módulos**: si el estado estuviera en memoria de módulo, recargar lo
 * borraría, y eso es precisamente lo que no debe pasar con el registro de eventos
 * vistos.
 */
export function reutilizarDbDePrueba(): string {
  if (!dirActual) throw new Error("No hay base previa que reutilizar");
  process.env.EVENT_LEDGER_DB_DIR = dirActual;
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
  delete process.env.EVENT_LEDGER_DB_DIR;
}
