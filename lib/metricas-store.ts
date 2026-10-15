import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import path from "node:path";

import { EVENTOS, resumenVacio, type Evento, type Resumen } from "./metricas";

/**
 * El almacén de las métricas, que es SQLite por lo mismo que las suscripciones de
 * push: ya está en el proyecto, ya tiene sus migraciones, y ya hay un volumen
 * persistente en Dokploy montado en `.data/`.
 *
 * Lo que cambia respecto a `lib/push.ts` es el motivo de la tabla, y ese motivo
 * decide la forma: `subscriptions` guarda filas que hay que poder **borrar** por
 * endpoint (la poda), y `eventos` solo crece y se agrega. Por eso no hay índice
 * único ni columna que proteger, solo un índice por `nombre` para que el `GROUP BY`
 * no repase la tabla entera.
 */

const DB_DIR = process.env.METRICAS_DB_DIR || path.join(process.cwd(), ".data");
const DB_PATH = path.join(DB_DIR, "metricas.db");

/**
 * El tiempo que espera un `INSERT` a que otro suelte el lock.
 *
 * Copiado de `lib/push.ts` y por el mismo motivo medido allí: sin esto,
 * `PRAGMA busy_timeout` sale `{timeout: 0}` y el segundo escritor falla **al
 * instante** con `SQLITE_BUSY`, sin reintentar. Y aquí el segundo escritor existe
 * de verdad: el navegador manda un `POST` por visita y puede haber dos a la vez.
 */
const BUSY_TIMEOUT_MS = 5_000;

const SCHEMA_VERSION = 1;

/**
 * Migraciones en orden. Solo hay un paso, pero la lista existe desde el principio
 * por lo mismo que en `lib/push.ts`: `CREATE TABLE IF NOT EXISTS` no hace nada
 * sobre una base que ya existe, así que la siguiente columna nueva se
 * encontraría con una tabla a la que le falta, y el fallo saldría en la primera
 * escritura del día, en runtime, y solo en las instalaciones que ya tuvieran
 * datos.
 */
const MIGRASIONES: readonly { version: number; sql: string }[] = [
  {
    version: 1,
    sql: `
      CREATE TABLE IF NOT EXISTS eventos (
        nombre TEXT NOT NULL,
        ts INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS eventos_nombre ON eventos (nombre);
      CREATE INDEX IF NOT EXISTS eventos_ts ON eventos (ts);
    `,
  },
];

let db: DatabaseSync | null = null;

function versionDe(db: DatabaseSync): number {
  const fila = db.prepare("PRAGMA user_version").get() as
    | { user_version?: number }
    | undefined;
  return fila?.user_version ?? 0;
}

function migrar(conexion: DatabaseSync): void {
  const desde = versionDe(conexion);
  for (const paso of MIGRASIONES) {
    if (paso.version <= desde) continue;
    conexion.exec(paso.sql);
    conexion.exec(`PRAGMA user_version = ${paso.version}`);
  }

  /**
   * La comprobación de que el número y la lista están de acuerdo sale al
   * **abrir**, no al insertar, por lo mismo que en `lib/push.ts`: subir
   * `SCHEMA_VERSION` sin añadir el paso dejaría la base en la versión vieja para
   * siempre, sin error y con la columna nueva sin existir.
   */
  const queda = versionDe(conexion);
  if (queda !== SCHEMA_VERSION) {
    throw new Error(
      `metricas.db queda en la versión ${queda} y el código espera la ${SCHEMA_VERSION}: falta un paso en MIGRASIONES`
    );
  }
}

function getDb(): DatabaseSync {
  if (db) return db;

  mkdirSync(DB_DIR, { recursive: true });
  const conexion = new DatabaseSync(DB_PATH);

  try {
    conexion.exec("PRAGMA journal_mode = WAL");
    conexion.exec(`PRAGMA busy_timeout = ${BUSY_TIMEOUT_MS}`);
    migrar(conexion);
  } catch (err) {
    /**
     * La conexión se cierra y **no** se guarda si algo falla. Guardarla a medias
     * dejaría el singleton apuntando a una base sin migrar, y las siguientes
     * llamadas volverían a crearla: el error saldría una vez y el resto de la
     * vida del proceso escribiría contra un esquema que el código no reconoce.
     */
    try {
      conexion.close();
    } catch {
      // Si ni cerrar se puede, el proceso ya está peor.
    }
    throw err;
  }

  db = conexion;
  return db;
}

/**
 * Anota un evento.
 *
 * `ts` es `Date.now()` **de quien llama**, no del servidor, y eso es deliberado:
 * el reloj de un contenedor en Dokploy puede ir desviado, y un contador cuyo
 * orden depende del reloj de la máquina no sirve para nada. Pasa el
 * `capturadoEn` explícito desde el `route.ts` para que el reloj sea el del
 * navegador, que es el que experienced el usuario.
 */
export function anotar(nombre: Evento, capturadoEn: number = Date.now()): void {
  getDb()
    .prepare("INSERT INTO eventos (nombre, ts) VALUES (?, ?)")
    .run(nombre, capturadoEn);
}

/**
 * Los recuentos, agrupados por evento.
 *
 * El `GROUP BY` usa el índice de `nombre`, y el `MIN`/`MAX` de `ts` vienen del
 * índice de `ts`. Un solo recorrido de la tabla, que es lo que hace que esto se
 * pueda pedir en cada visita a una página de estado sin que la base crezca sin
 * control.
 */
export function resumen(): Resumen {
  const vacio = resumenVacio();
  const filas = getDb()
    .prepare(
      "SELECT nombre, COUNT(*) AS n, MIN(ts) AS primero, MAX(ts) AS ultimo FROM eventos GROUP BY nombre"
    )
    .all() as { nombre: string; n: number; primero: number; ultimo: number }[];

  let total = 0;
  let primera: number | null = null;
  let ultima: number | null = null;

  for (const fila of filas) {
    /**
     * Una fila con un nombre que no está en `EVENTOS` no se cuela en el resumen.
     *
     * Puede existir si `EVENTOS` perdió un nombre después de haberlo escrito: en
     * ese caso la tabla tiene la fila y el resumen callaría, que es peor que
     * contarla con un nombre raro. Ignorarla deja la fila solo, que es visible si
     * alguien mira la base, y no ensucia el número que se lee desde el panel.
     */
    // Los parentesis son necesarios: `in` liga más fuerte que `!`, asi que
    // `!fila.nombre in vacio.porEvento` seria `(!fila.nombre) in vacio.porEvento`,
    // que pregunta por la clave `false` y devuelve siempre falso.
    if (!fila.nombre || !(fila.nombre in vacio.porEvento)) continue;

    vacio.porEvento[fila.nombre as Evento] = fila.n;
    total += fila.n;
    if (primera === null || fila.primero < primera) primera = fila.primero;
    if (ultima === null || fila.ultimo > ultima) ultima = fila.ultimo;
  }

  vacio.total = total;
  vacio.primera = primera;
  vacio.ultima = ultima;
  return vacio;
}

/**
 * Borra las filas anteriores a `antes`, y devuelve cuántas se fueron.
 *
 * No hay nada que la llame todavía: está para que la poda se pueda hacer desde un
 * comando cuando la tabla crezca, y para que exista una forma de acotarla sin
 * reescribir `anotar`.
 */
export function podar(antes: number): number {
  const resultado = getDb()
    .prepare("DELETE FROM eventos WHERE ts < ?")
    .run(antes);
  return Number(resultado.changes ?? 0);
}

/** Los cinco nombres, para que quien llama no duplique la lista. */
export { EVENTOS };