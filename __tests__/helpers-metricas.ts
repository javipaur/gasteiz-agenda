import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

/**
 * `lib/metricas-store.ts` abre `node:sqlite` contra `.data/metricas.db` y guarda
 * la conexión en una variable de módulo, así que hace falta una base distinta por
 * caso y recargar los módulos entre ellos. `METRICAS_DB_DIR` existe justo para
 * esto, igual que `PUSH_DB_DIR` existe para el sibling de `lib/push.ts`.
 *
 * Cada caso crea un directorio nuevo y no uno por fichero de test: con uno
 * compartido, los recuentos de un caso se colaban en el siguiente y el `resumen()`
 * salía con filas de más.
 *
 * Los directorios **no** se borran entre tests, y por el motivo que ya está escrito
 * en `__tests__/helpers-push.ts`: `node:sqlite` mantiene el fichero bloqueado
 * mientras el `DatabaseSync` está vivo, y tras `resetModules` el módulo viejo sigue
 * referenciado hasta que pase el GC, así que en Windows el `rmSync` falla con
 * `EPERM` casi siempre. Se limpian todos al final y el fallo se ignora.
 */
const dirs: string[] = [];

export function dbDePrueba(): string {
  const dir = mkdtempSync(join(tmpdir(), "gasteiz-metricas-"));
  dirs.push(dir);
  process.env.METRICAS_DB_DIR = dir;
  return dir;
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
  delete process.env.METRICAS_DB_DIR;
}