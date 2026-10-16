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

const SCHEMA_VERSION = 3;

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
  {
    // La tabla que dice si la poda de hoy ya está hecha. Es el mismo patrón que
    // `meta` en `lib/push.ts` con `digest_sent_on`: el scheduler corre cada diez
    // minutos, y sin este marcador la poda se ejecutaría 144 veces al día.
    version: 2,
    sql: `
      CREATE TABLE IF NOT EXISTS meta (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );
    `,
  },
  {
    // La ruta donde pasó el evento. Sin esto el contador decía "40 visitas" y no
    // decía dónde, que es la mitad del trabajo de un embudo.
    //
    // `ALTER TABLE ... ADD COLUMN` y no una tabla nueva, porque las filas que ya
    // hay no se pueden volver a escribir: se quedan con la columna a `NULL`, que es
    // lo mismo que "no se sabía", y `porRuta()` lo cuenta aparte en vez de
    // inventarle un destino.
    version: 3,
    sql: `
      ALTER TABLE eventos ADD COLUMN ruta TEXT;
      CREATE INDEX IF NOT EXISTS eventos_ruta ON eventos (nombre, ruta);
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
export function anotar(
  nombre: Evento,
  capturadoEn: number = Date.now(),
  ruta?: string
): void {
  getDb()
    .prepare("INSERT INTO eventos (nombre, ts, ruta) VALUES (?, ?, ?)")
    .run(nombre, capturadoEn, ruta ?? null);
}

/**
 * Las visitas agrupadas por ruta, y el resto de eventos aparte.
 *
 * Esto es un embudo sin third parties: dice dónde se abre el sitio, cuántas
 * visitas hubo en cada página y qué pasó con la instalación. Lo que **no** hace
 * es juntar sesiones distintas, porque eso necesitaría un identificador que
 * sobrevive entre visitas, y ese identificador es una cookie.
 *
 * El agrupado es por `(nombre, ruta)` y el índice de `ruta` es compuesto por
 * `nombre`, así que el `GROUP BY` no repasa la tabla entera.
 */
export function porRuta(): {
  visitasPorRuta: Record<string, number>;
  instalacionPorRuta: Record<string, number>;
  sinRuta: number;
} {
  const filas = getDb()
    .prepare(
      `SELECT nombre, ruta, COUNT(*) AS n
       FROM eventos
       WHERE ruta IS NOT NULL
       GROUP BY nombre, ruta`
    )
    .all() as { nombre: string; ruta: string; n: number }[];

  const visitasPorRuta: Record<string, number> = {};
  const instalacionPorRuta: Record<string, number> = {};
  let sinRuta = 0;

  for (const fila of filas) {
    if (fila.nombre === "visita") {
      visitasPorRuta[fila.ruta] = (visitasPorRuta[fila.ruta] ?? 0) + fila.n;
    } else if (fila.nombre === "instalada") {
      instalacionPorRuta[fila.ruta] = (instalacionPorRuta[fila.ruta] ?? 0) + fila.n;
    }
  }

  /*
   * Las filas sin ruta son las anteriores a la migración 3, más las de los
   * eventos que no la mandan (los del embudo de instalación, que pueden venir de
   * `/instalar` o del banner de la home indistintamente).
   *
   * Se cuentan y se dicen en voz alta en vez de repartirse por la ruta principal:
   * inventarles un destino haría que `/` pareciera más visitada de lo que es, y
   * ese es justo el número que se usa para decidir.
   */
  const sinRutaFila = getDb()
    .prepare("SELECT COUNT(*) AS n FROM eventos WHERE ruta IS NULL")
    .get() as { n: number };
  sinRuta = sinRutaFila.n;

  return { visitasPorRuta, instalacionPorRuta, sinRuta };
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
/**
 * La inversa exacta de `anotar`: borra **esa** fila y ninguna más.
 *
 * Existe porque `podar()` no puede servir para deshacer una escritura de prueba, y
 * su tentación es peligrosa. `podar(antes)` corta por tiempo, así que para quitar
 * una fila de `ts = t` hay dos opciones y las dos están mal:
 *
 * - `podar(t - 1)` no la quita, porque `t < t - 1` es falso. La fila se queda
 *   para siempre, que es lo que hacía `doctor` antes de existir esta función: una
 *   visita de más por cada vez que se ejecutaba.
 * - `podar(t + 1)` sí la quita, y de paso **borra la tabla entera**, porque toda
 *   visita real es más nueva que la marca de prueba. Un chequeo que se lleva por
 *   delante los datos para no dejar ruido no es un chequeo.
 *
 * Por eso esto no corta por tiempo sino por identidad: los tres valores que se
 * escribieron, con `IS` y no `=` porque en SQLite `ruta = NULL` nunca es cierto y
 * una comparación mal puesta deja la fila justo cuando más falta hace quitarla.
 *
 * Devuelve cuántas se fueron. Un `0` es una respuesta legítima —nadie escribió esa
 * fila, o alguien la podó antes— y no un error: quien llama necesita saber si su
 * prueba se limpió, no si la base está bien.
 */
export function desanotar(nombre: Evento, ts: number, ruta?: string): number {
  const resultado = getDb()
    .prepare("DELETE FROM eventos WHERE nombre = ? AND ts = ? AND ruta IS ?")
    .run(nombre, ts, ruta ?? null);
  return Number(resultado.changes ?? 0);
}

export function podar(antes: number): number {
  const resultado = getDb()
    .prepare("DELETE FROM eventos WHERE ts < ?")
    .run(antes);
  return Number(resultado.changes ?? 0);
}

const CLAVE_PODA = "poda_hecha_el";

function leerMeta(clave: string): string | null {
  const fila = getDb()
    .prepare("SELECT value FROM meta WHERE key = ?")
    .get(clave) as { value?: string } | undefined;
  return fila?.value ?? null;
}

/**
 * La poda, pero **una vez al día** y solo si toca.
 *
 * Existe porque `podar()` sin más no sirve en el sitio donde tendría que vivir: el
 * scheduler de `lib/scheduler.ts` corre un tick cada diez minutos, así que llamarla
 * desde ahí sin más la ejecutaría 144 veces al día para borrar cero filas las 143
 * últimas. Es el mismo problema que resolvió `digest_sent_on` para el digest.
 *
 * El día se calcula con `Intl` en la zona del proceso, no con `toISOString()`, por
 * el mismo motivo escrito en `lib/scheduler.ts`: `toISOString()` es UTC, y en un
 * contenedor sin `TZ` eso cae a la medianoche UTC, con lo que la poda se
 * adelantaría una tarde en horario de verano. Con la zona explícita, "hoy" es hoy a las nueve de la mañana y
 * a las tres de la tarde.
 *
 * Devuelve cuántas filas se fueron, o `null` si no tocaba. El `null` no es un
 * error: es la respuesta normal de 143 de las 144 llamadas al día.
 */
export function podarSiToca(dias: number, ahora: number = Date.now()): number | null {
  const dia = diaEnZona(ahora);
  if (leerMeta(CLAVE_PODA) === dia) return null;

  const borradas = podar(ahora - dias * 24 * 60 * 60 * 1000);
  getDb()
    .prepare("INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value")
    .run(CLAVE_PODA, dia);
  return borradas;
}

/**
 * El día de calendario en `Europe/Madrid`.
 *
 * Va en su propia función y no en línea por dos razones: `podarSiToca` tiene que
 * poder probarse con un `ahora` fijo, y un `toISOString().slice(0, 10)` escondido en
 * una línea es justo el tipo de cosa que se relee mal dentro de seis meses.
 */
function diaEnZona(ahora: number): string {
  const zona = process.env.TZ?.trim() || "Europe/Madrid";
  try {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: zona,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date(ahora));
  } catch {
    // Una `TZ` mal escrita no puede dejar la poda sin hacer para siempre: cae a
    // la zona por defecto, que es la que la imagen define.
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: "Europe/Madrid",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date(ahora));
  }
}

/** Los cinco nombres, para que quien llama no duplique la lista. */
export { EVENTOS };