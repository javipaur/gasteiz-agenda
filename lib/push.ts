import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "fs";
import path from "path";
import webpush from "web-push";

export type StoredSubscription = {
  endpoint: string;
  keys: { p256dh: string; auth: string };
  addedAt: number;
};

export type PushPayload = {
  title: string;
  body: string;
  url?: string;
};

const DB_DIR = process.env.PUSH_DB_DIR || path.join(process.cwd(), ".data");
const DB_PATH = path.join(DB_DIR, "push.db");

let db: DatabaseSync | null = null;

/**
 * Cuánto espera una escritura a que otra conexión suelte el lock.
 *
 * Medido en esta máquina, sin nada puesto: `PRAGMA busy_timeout` sale
 * `{timeout: 0}`, y con dos conexiones y un `BEGIN IMMEDIATE` en la primera el
 * `INSERT` de la segunda falla **al instante** con `SQLITE_BUSY (errcode 5)`. Cero
 * margen, cero espera: no es un fallo transitorio, es un no.
 *
 * Y el par que sufre ese «no» es real: este proceso escribe `meta` cuando marca el
 * digest, y `scripts/send-push.mjs` abre el mismo fichero desde el cron de Dokploy.
 * Sin espera, el que llega segundo pierde, y el que perdía era el script.
 *
 * Cinco segundos: es un fichero local y las escrituras son de cuatro filas, así que
 * cualquier lock que dure más es un proceso colgado, no una operación lenta.
 */
const BUSY_TIMEOUT_MS = 5_000;

/**
 * La versión del esquema, guardada **en la propia base** (`PRAGMA user_version`).
 *
 * `CREATE TABLE IF NOT EXISTS` solo sirve la primera vez. Sobre una base que ya
 * existe no hace nada, así que la siguiente columna nueva se encontraría con una
 * tabla a la que le falta, y el fallo saldría en runtime —en la primera escritura
 * del día, sin nada en el arranque— y solo en las instalaciones que ya tuviesen
 * datos. Es el peor sitio posible para enterarse.
 *
 * Con la versión guardada, ampliar el esquema es añadir un paso a `MIGRASIONES` y
 * subir el número. `PRAGMA user_version` es un entero de cabecera, así que el
 * UPDATE es atómico y no necesita su propia tabla: un proceso que muera a mitad de
 * una migración deja la versión en el número viejo y vuelve a intentarla.
 */
const SCHEMA_VERSION = 1;

/**
 * De la versión que hay a la que se quiere. Solo hacia arriba y en orden.
 *
 * El paso 1 es el que trae el esquema actual; los siguientes son `ALTER TABLE`, que
 * es la operación que sobre una tabla existente no se puede expresar con
 * `CREATE TABLE IF NOT EXISTS`.
 */
const MIGRASIONES: readonly { version: number; sql: string }[] = [
  {
    version: 1,
    sql: `
      CREATE TABLE IF NOT EXISTS subscriptions (
        endpoint TEXT PRIMARY KEY,
        p256dh TEXT NOT NULL,
        auth TEXT NOT NULL,
        added_at INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS meta (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );
    `,
  },
];

function versionDe(db: DatabaseSync): number {
  const fila = db.prepare("PRAGMA user_version").get() as { user_version?: number } | undefined;
  return fila?.user_version ?? 0;
}

function migrar(db: DatabaseSync): void {
  const desde = versionDe(db);
  for (const paso of MIGRASIONES) {
    if (paso.version <= desde) continue;
    db.exec(paso.sql);
    db.exec(`PRAGMA user_version = ${paso.version}`);
  }

  /*
   * El número y la lista tienen que estar de acuerdo, y el que lo comprueba es el
   * código y no una revisión: subir `SCHEMA_VERSION` sin añadir el paso dejaría la
   * base en la versión vieja para siempre, sin error y sin la columna nueva. Aquí
   * sale un error al abrir, que es donde todavía no ha pasado nada.
   */
  const queda = versionDe(db);
  if (queda !== SCHEMA_VERSION) {
    throw new Error(
      `push.db queda en la versión ${queda} y el código espera la ${SCHEMA_VERSION}: falta un paso en MIGRASIONES`
    );
  }
}

function getDb(): DatabaseSync {
  if (db) return db;

  mkdirSync(DB_DIR, { recursive: true });
  const conexión = new DatabaseSync(DB_PATH);

  try {
    /*
     * `journal_mode = WAL`, y no por rendimiento sino porque `delete` —el modo por
     * defecto— hace que el escritor tome un lock **exclusivo**: mientras el digest
     * escribe, cualquier lector se come un SQLITE_BUSY, y el que lee en ese momento
     * es `scripts/send-push.mjs` desde el cron. WAL separa los dos.
     *
     * Es una propiedad del fichero, no de la conexión, así que se escribe una vez y
     * la ven todas las demás.
     */
    conexión.exec("PRAGMA journal_mode = WAL");

    // Y `busy_timeout` es lo contrario: por conexión, así que el otro proceso tiene
    // que ponerlo también. `scripts/send-push.mjs` lo hace en las suyas.
    conexión.exec(`PRAGMA busy_timeout = ${BUSY_TIMEOUT_MS}`);

    migrar(conexión);
  } catch (err) {
    /*
     * La conexión se cierra y **no** se guarda en `db` si algo falla.
     *
     * Guardarla a medias dejaría el singleton apuntando a una base a la que no se le
     * ha aplicado la migración, y las siguientes llamadas no volverían a intentarlo:
     * el error saldría una vez y el resto de la vida del proceso trabajaría contra un
     * esquema que el código no reconoce. Cerrar además suelta el lock, que es lo que
     * hay que hacer con una conexión que no se va a usar.
     */
    try {
      conexión.close();
    } catch {
      // Si ni cerrar se puede, el proceso ya está peor: que se lo lleve el error.
    }
    throw err;
  }

  db = conexión;
  return db;
}

function getWebPush() {
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!publicKey || !privateKey) {
    throw new Error("Faltan VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY");
  }
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://gasteizclick.javierpalacio.es";
  webpush.setVapidDetails(`mailto:admin@${new URL(siteUrl).hostname}`, publicKey, privateKey);
  return webpush;
}

export function addSubscription(sub: StoredSubscription): void {
  getDb()
    .prepare(
      `INSERT INTO subscriptions (endpoint, p256dh, auth, added_at)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(endpoint) DO UPDATE SET p256dh = excluded.p256dh, auth = excluded.auth`
    )
    .run(sub.endpoint, sub.keys.p256dh, sub.keys.auth, sub.addedAt);
}

export function removeSubscription(endpoint: string): void {
  getDb().prepare("DELETE FROM subscriptions WHERE endpoint = ?").run(endpoint);
}

export function listSubscriptions(): StoredSubscription[] {
  return getDb()
    .prepare("SELECT endpoint, p256dh, auth, added_at FROM subscriptions")
    .all()
    .map((row) => ({
      endpoint: row.endpoint as string,
      keys: { p256dh: row.p256dh as string, auth: row.auth as string },
      addedAt: row.added_at as number,
    }));
}

function getMeta(key: string): string | null {
  const row = getDb().prepare("SELECT value FROM meta WHERE key = ?").get(key);
  return row ? (row.value as string) : null;
}

function setMeta(key: string, value: string): void {
  getDb()
    .prepare(
      `INSERT INTO meta (key, value) VALUES (?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value`
    )
    .run(key, value);
}

export type SendResult = {
  sent: number;
  failed: number;
  pruned: number;
  total: number;
};

export async function sendToAll(payload: PushPayload): Promise<SendResult> {
  const push = getWebPush();
  const subs = listSubscriptions();
  let sent = 0;
  let failed = 0;
  let pruned = 0;

  await Promise.allSettled(
    subs.map(async (sub) => {
      try {
        await push.sendNotification(sub, JSON.stringify(payload));
        sent++;
      } catch (err) {
        failed++;
        const status = (err as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) {
          removeSubscription(sub.endpoint);
          pruned++;
        }
      }
    })
  );

  return { sent, failed, pruned, total: subs.length };
}

export function localDateStr(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

export function shouldSendDailyDigest(): boolean {
  return getMeta("digest_sent_on") !== localDateStr();
}

export function markDigestSent(): void {
  setMeta("digest_sent_on", localDateStr());
}
