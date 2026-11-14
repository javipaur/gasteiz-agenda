import { AsyncLocalStorage } from "node:async_hooks";
import { tmpdir } from "node:os";
import { join } from "node:path";

if (typeof (globalThis as { AsyncLocalStorage?: unknown }).AsyncLocalStorage === "undefined") {
  (globalThis as { AsyncLocalStorage: typeof AsyncLocalStorage }).AsyncLocalStorage = AsyncLocalStorage;
}

/**
 * El registro de eventos vistos escribe en disco en **cada** agregación, y las
 * suites de la agenda llaman al agregador decenas de veces. Sin redirigirlo,
 * cada `npm test` llenaría el `.data/event-ledger.db` de la máquina de
 * desarrollo con eventos de fixture, que es justo lo que la detección de
 * ausencias leerá después: el registro que existe para no perder un evento real
 * quedaría sembrado de planes inventados.
 *
 * Un directorio por worker y no uno compartido por el mismo motivo por el que
 * `lib/metricas-store.ts` crea una base por test: dos workers escribiendo el
 * mismo fichero se pelean por el lock, y con `node:sqlite` esa pelea se paga en
 * tiempo, no en corrección. Quien quiera su propia base —los tests del propio
 * registro— pone la variable antes de importar y gana, porque esto solo rellena
 * el hueco cuando nadie lo ha hecho.
 */
if (!process.env.EVENT_LEDGER_DB_DIR) {
  process.env.EVENT_LEDGER_DB_DIR = join(
    tmpdir(),
    `gasteiz-event-ledger-test-${process.env.JEST_WORKER_ID ?? "0"}`
  );
}

/**
 * React 19 se niega a correr `act()` sin este flag, y avisa por consola con
 * "The current testing environment is not configured to support act(...)" en vez
 * de fallar. Ese aviso se cuela en la salida de las 45 suites de node, que no
 * renderizan nada, así que solo se pone cuando hay un test de componente.
 *
 * Va en un `beforeEach` con condición en lugar de en el cuerpo del fichero
 * porque leerlo de aquí lo evalúa Jest al cargar el setup, que es antes de que el
 * entorno de un fichero con `@jest-environment jsdom` esté montado.
 */
beforeEach(() => {
  if (typeof document !== "undefined") {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT =
      true;
  }
});

afterEach(() => {
  jest.restoreAllMocks();
});