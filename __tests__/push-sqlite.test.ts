import { DatabaseSync } from "node:sqlite";
import { spawn } from "node:child_process";
import { join } from "node:path";

import { dbDePrueba, limpiarDbsDePrueba, reutilizarDbDePrueba } from "./helpers-push";

/**
 * La base de `node:sqlite` contra el resto del mundo.
 *
 * `lib/push.ts` y `scripts/send-push.mjs` son dos procesos distintos sobre el
 * mismo fichero: el scheduler del proceso de Next y el cron de Dokploy. Medido en
 * esta máquina, sin nada puesto:
 *
 *   - `PRAGMA busy_timeout` → `{timeout: 0}`
 *   - `PRAGMA journal_mode` → `delete`
 *   - y con dos conexiones y un `BEGIN IMMEDIATE` en la primera, el `INSERT` de la
 *     segunda falla al instante con `SQLITE_BUSY (errcode 5)`.
 *
 * Eso es exactamente lo que pasaba entre el servidor y `send-push.mjs`, y el
 * `catch` vacío de `:77` lo traducía a «No hay base de datos de suscripciones
 * todavía» con código de salida 0: informaba de que no hay suscriptores cuando lo
 * que hay es un bloqueo, y no mandaba nada.
 *
 * Estos tests usan otro **proceso** para sujetar la base porque el punto es
 * justo ése: SQLite es síncrono y bloquea el event loop, así que un temporizador
 * en el mismo proceso no llegaría a soltar el lock nunca. Con `busy_timeout` la
 * escritura espera (672 ms medidos) y sale; sin él, revienta en 0 ms.
 */

/**
 * Sujeta la base en exclusiva desde otro proceso, y **resuelve cuando ya la tiene**.
 *
 * Otro proceso porque el punto es justo ése: SQLite es síncrono y bloquea el event
 * loop, así que un temporizador en este proceso no llegaría a soltar el lock
 * mientras la escritura lo espera.
 *
 * Dos veces se ha rompio esto y las dos por culpa de una carrera de relojes. La
 * primera versión usaba «dormir 1.500 ms en el hijo»; bajo carga el hijo perdía y no
 * había nada con lo que competir, así que la escritura salía en 0 ms y el test
 * fallaba por lo contrario. La segunda usaba «dormir 500 ms en el padre antes de
 * escribir», con el mismo resultado por el motivo opuesto: bajo carga el padre se
 * adelantaba al hijo.
 *
 * Ahora el hijo dice `listo` por stdout cuando `BEGIN EXCLUSIVE` ha tenido éxito, y
 * el padre espera esa línea. Ningún reloj: o el lock está puesto o el test no ha
 * empezado. Y se queda con el lock hasta que el padre lo mata, de modo que la
 * duración de la espera la mide el `busy_timeout` del código y no el test.
 */
function sujetar(pdb: string): Promise<() => void> {
  const hijo = spawn(
    process.execPath,
    [
      "-e",
      `const {DatabaseSync}=require("node:sqlite");` +
        `const d=new DatabaseSync(process.argv[1]);` +
        `d.exec("BEGIN EXCLUSIVE");` +
        `process.stdout.write("listo");` +
        // Red de seguridad para que un fallo del test no deje un proceso colgado.
        `setTimeout(()=>{try{d.exec("ROLLBACK")}catch{};d.close()},60000);`,
      pdb,
    ],
    { stdio: ["ignore", "pipe", "ignore"] }
  );

  return new Promise((resolve) => {
    hijo.stdout?.on("data", (c) => {
      if (String(c).includes("listo")) resolve(() => hijo.kill());
    });
  });
}

/** Los pragmas tal como los ve cualquiera que abra el fichero. */
function pragmasDe(pdb: string): Record<string, unknown> {
  const db = new DatabaseSync(pdb);
  try {
    return {
      journal_mode: (db.prepare("PRAGMA journal_mode").get() as { journal_mode?: string })
        .journal_mode,
      user_version: (db.prepare("PRAGMA user_version").get() as { user_version?: number })
        .user_version,
    };
  } finally {
    db.close();
  }
}

function pdbs(): string {
  // `reutilizarDbDePrueba`, no `dbDePrueba`: `pushLimpio()` ya ha creado el
  // directorio, y volver a pedir uno nuevo apuntaría a una base vacía distinta —que
  // no habría pasado nunca por `getDb()`— y todo lo de aquí leería `0` y `delete`.
  return join(reutilizarDbDePrueba(), "push.db");
}

/**
 * `lib/push` recién cargado sobre una base, con el fichero ya creado.
 *
 * La conexión se abre llamando a `listSubscriptions()`: `getDb()` es perezoso, así
 * que sin esa llamada el fichero no existiría todavía y el proceso que lo sujeta en
 * la prueba de contención no tendría nada que abrir.
 *
 * `mismaBase` es para el caso que parte de una base ya montada por el test —la
 * migración de una base hecha por la versión anterior—.
 */
async function pushLimpio({ mismaBase = false }: { mismaBase?: boolean } = {}) {
  if (mismaBase) reutilizarDbDePrueba();
  else dbDePrueba();
  jest.resetModules();
  jest.doMock("web-push", () => ({ __esModule: true, default: {} }));
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const mod = require("@/lib/push") as typeof import("@/lib/push");
  mod.listSubscriptions();
  return mod;
}

afterAll(() => {
  limpiarDbsDePrueba();
});

describe("la base no se queda bloqueada", () => {
  it("journal_mode es WAL, y no el `delete` de por defecto", async () => {
    // WAL es lo que permite que un lector no espere a un escritor. En `delete`, el
    // escritor toma un lock exclusivo y **cualquier** lector se come un
    // SQLITE_BUSY, que es como se cae el cron mientras el digest escribe.
    const push = await pushLimpio();
    push.addSubscription({
      endpoint: "https://push.example/a",
      keys: { p256dh: "p", auth: "a" },
      addedAt: 1,
    });

    expect(pragmasDe(pdbs()).journal_mode).toBe("wal");
  });

  it("espera al lock en vez de rendirse al instante, y luego falla diciendo por qué", async () => {
    // El caso medido. Con `busy_timeout = 0` la escritura falla en 0 ms con
    // `SQLITE_BUSY`; con el timeout espera los cinco segundos y solo entonces se
    // rinde. El margen que se mira es de dos órdenes de magnitud, así que esto no
    // es un test de tiempo: es la diferencia entre «no esperar» y «esperar».
    //
    // Y que al rendirse diga que era un lock y no cualquier otra cosa: es lo que
    // permite que `send-push.mjs` lo distinga de «no hay base».
    const push = await pushLimpio();
    const soltar = await sujetar(pdbs());
    try {
      const t0 = Date.now();

      let error: unknown = null;
      try {
        push.addSubscription({
          endpoint: "https://push.example/espera",
          keys: { p256dh: "p", auth: "a" },
          addedAt: 1,
        });
      } catch (e) {
        error = e;
      }
      const ms = Date.now() - t0;

      expect({ espero: ms >= 4_000, ms: ms < 20_000 }).toEqual({ espero: true, ms: true });
      expect({ errno: (error as { errcode?: number }).errcode }).toEqual({ errno: 5 });
      // Y nada se ha guardado a medias: la escritura que no pudo entrar no dejó fila.
      expect(push.listSubscriptions()).toEqual([]);
    } finally {
      soltar();
    }
  });
});

/**
 * El versionado de esquema, que faltaba.
 *
 * `CREATE TABLE IF NOT EXISTS` solo hace algo **la primera vez**. Sobre una base
 * que ya existe no cambia nada, así que añadir una columna a la siguiente versión
 * fallaría en runtime —con un `SQLITE_ERROR` en la primera escritura del día, sin
 * aviso en el arranque— y solo en las instalaciones que ya tuviesen datos. La
 * forma de no notarlo es tener una versión guardada en la propia base y una lista
 * de pasos que se apliquen de la que hay a la que se quiere.
 *
 * El número va a pelo en el test a propósito, como el `40 rutas` de
 * `__tests__/openapi.test.ts`: cuando entre la migración 2, este rojo dice qué
 * número hay que escribir y por qué.
 */
describe("el esquema tiene versión", () => {
  it("una base nueva nace en la versión 1", async () => {
    const push = await pushLimpio();
    push.listSubscriptions();

    expect(pragmasDe(pdbs()).user_version).toBe(1);
  });

  it("una base hecha por la versión anterior se sube, en vez de ignorarse", async () => {
    // Esta es la forma exacta de una base en producción: las tablas ya están, la
    // versión no está porque el código que la escribía no la escribía. Si la
    // migración solo mira `IF NOT EXISTS`, esto se queda en `0` para siempre y la
    // siguiente columna nueva revienta en la primera escritura.
    const dir = dbDePrueba();
    const pdb = join(dir, "push.db");
    const vieja = new DatabaseSync(pdb);
    vieja.exec(`
      CREATE TABLE subscriptions (
        endpoint TEXT PRIMARY KEY,
        p256dh TEXT NOT NULL,
        auth TEXT NOT NULL,
        added_at INTEGER NOT NULL
      );
      CREATE TABLE meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
    `);
    vieja.close();

    const push = await pushLimpio({ mismaBase: true });
    push.addSubscription({
      endpoint: "https://push.example/legacy",
      keys: { p256dh: "p", auth: "a" },
      addedAt: 1,
    });

    expect(pragmasDe(pdb).user_version).toBe(1);
    // Y los datos que ya estaban no se pierden por el camino.
    expect(push.listSubscriptions()).toHaveLength(1);
  });
});
