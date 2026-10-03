import { spawn } from "node:child_process";
import { createServer, type Server } from "node:http";
import { mkdtempSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";

/**
 * `scripts/send-push.mjs` se prueba como lo que es: un programa.
 *
 * Es un `.mjs` a propósito —no lo carga ts-jest, y no debería, porque es lo que
 * ejecuta el cron de Dokploy tal cual—, así que el test lo lanza con `node` contra
 * un servidor HTTP de mentira. Todo lo demás sería un test de la lógica, no del
 * programa: lo que importa aquí es el **código de salida** y lo que dice, porque
 * un cron solo mira eso.
 *
 * Los dos fallos que se cubren son el mismo error de partida —«no he comprobado
 * lo que ha pasado»— en dos sitios distintos:
 *
 *  1. El `fetch` a `/api/push/send` no miraba `res.ok`. Con `API_KEY` ausente o
 *     equivocado la respuesta es `{"error":"Unauthorized…"}`, se imprimía como si
 *     fuera el digest y `main()` resolvía con éxito: el cron creía haber
 *     notificado a nadie. `scripts/send-newsletter.ts:88-90` ya hacía esto bien.
 *
 *  2. El `catch` vacío de la apertura de la base traducía **cualquier** fallo a
 *     «No hay base de datos de suscripciones todavía». Un `SQLITE_BUSY` —el
 *     servidor escribiendo a la vez— salía como si no hubiera una base, y encima
 *     con código 0.
 */

const SCRIPT = resolve(__dirname, "..", "scripts", "send-push.mjs");

type Resultado = { codigo: number | null; salida: string };

/**
 * Lanza el script y espera a que termine.
 *
 * **Asíncrono a propósito, y no `spawnSync`.** El servidor HTTP de este fichero
 * vive en el proceso de Jest, así que un `spawnSync` bloquearía el event loop
 * justo mientras el script le habla: el hijo esperaría una respuesta que no puede
 * llegar y los dos se quedarían colgados hasta el timeout. Con `spawn` el loop
 * sigue vivo y el servidor contesta.
 */
function lanzar(
  args: string[],
  env: Record<string, string>,
  cwd: string
): Promise<Resultado> {
  return new Promise((resolve) => {
    const hijo = spawn(process.execPath, [SCRIPT, ...args], {
      cwd,
      env: { ...process.env, ...env },
    });
    let salida = "";
    hijo.stdout?.on("data", (c) => (salida += c));
    hijo.stderr?.on("data", (c) => (salida += c));
    hijo.on("close", (codigo) => resolve({ codigo, salida }));
  });
}

/**
 * Sujeta `pdb` en exclusiva desde otro proceso, y resuelve cuando ya la tiene.
 *
 * Otro proceso porque `node:sqlite` es síncrono: un temporizador en este no podría
 * soltar el lock mientras el script lo espera. Y sin reloj porque un reloj es una
 * carrera —la primera versión del caso usaba «ocho segundos de espera» y fallaba
 * con el runner saturado: o el script llegaba después de que el lock se soltara, o
 * el `busy_timeout` de cinco segundos expiraba con la base ya libre—. El hijo
 * avisa por stdout cuando `BEGIN EXCLUSIVE` ha tenido éxito y no lo suelta hasta
 * que este proceso lo mata, así que el único reloj que corre es el del código.
 */
function sujetar(pdb: string): Promise<() => void> {
  const hijo = spawn(
    process.execPath,
    [
      "-e",
      `const {DatabaseSync}=require("node:sqlite");` +
        `const d=new DatabaseSync(process.argv[1]);d.exec("BEGIN EXCLUSIVE");` +
        `process.stdout.write("listo");` +
        // Red de seguridad para que un fallo del test no deje un proceso colgando.
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

/** Un directorio limpio, porque `loadEnv()` lee `.env` del directorio actual. */
function cwdLimpio(): string {
  const dir = mkdtempSync(join(tmpdir(), "send-push-"));
  dirs.push(dir);
  return dir;
}

const dirs: string[] = [];

afterAll(() => {
  for (const dir of dirs) {
    try {
      rmSync(dir, { recursive: true, force: true, maxRetries: 3, retryDelay: 50 });
    } catch {
      // Sigue abierto. El temp del sistema se encarga.
    }
  }
});

/** Un servidor que contesta lo que se le diga, y recuerda qué le pidieron. */
async function servidor(
  responder: (req: { method: string; url: string }, cuerpo: string) => { estado: number; cuerpo: string }
): Promise<{ url: string; cerradas: number; parar: () => Promise<void> }> {
  let cerradas = 0;
  const s: Server = createServer((req, res) => {
    let cuerpo = "";
    req.on("data", (c) => (cuerpo += c));
    req.on("end", () => {
      cerradas++;
      const { estado, cuerpo: respuesta } = responder(
        { method: req.method ?? "", url: req.url ?? "" },
        cuerpo
      );
      res.writeHead(estado, { "content-type": "application/json" });
      res.end(respuesta);
    });
  });
  await new Promise<void>((r) => s.listen(0, "127.0.0.1", r));
  const puerto = (s.address() as { port: number }).port;
  return {
    url: `http://127.0.0.1:${puerto}`,
    get cerradas() {
      return cerradas;
    },
    parar: () => new Promise<void>((r) => s.close(() => r())),
  };
}

/**
 * Un directorio con la base ya creada, como la que monta el volumen persistente.
 *
 * `node:sqlite` no crea los directorios intermedios, así que el `mkdirSync` es
 * parte del montaje y no decoración: sin él el error sería «unable to open
 * database file» y el test mediría lo que no quiere medir.
 */
function baseVacia(): { dbdir: string; pdb: string } {
  const dir = cwdLimpio();
  const dbdir = join(dir, "datos");
  mkdirSync(dbdir, { recursive: true });
  const pdb = join(dbdir, "push.db");
  const db = new DatabaseSync(pdb);
  db.exec(
    "CREATE TABLE subscriptions (endpoint TEXT PRIMARY KEY, p256dh TEXT, auth TEXT, added_at INTEGER)"
  );
  db.close();
  return { dbdir, pdb };
}

const CLAVES = {
  VAPID_PUBLIC_KEY: "public-key-de-prueba",
  VAPID_PRIVATE_KEY: "private-key-de-prueba",
};

describe("send-push.mjs --digest mira lo que le responde el servidor", () => {
  it("con un 401 sale con código distinto de cero y no imprime el digest", async () => {
    // El caso que importa: `API_KEY` mal puesta en Dokploy. La respuesta del
    // middleware es `{"error":"Unauthorized – …"}`, que antes se imprimía con el
    // prefijo `digest:` y salía con código 0. El cron lo daba por bueno y no
    // reintentaba hasta el día siguiente.
    const s = await servidor(() => ({
      estado: 401,
      cuerpo: JSON.stringify({ error: "Unauthorized – provide a valid x-api-key header" }),
    }));
    try {
      const r = await lanzar(
        ["--digest"],
        { ...CLAVES, API_KEY: "equivocada", NEXT_PUBLIC_SITE_URL: s.url },
        cwdLimpio()
      );

      expect({ codigo: r.codigo }).toEqual({ codigo: 1 });
      // Y que no se finja: el cuerpo del error no puede salir como si fuera el
      // resumen del día.
      expect(r.salida).not.toMatch(/digest:\s*\{/);
      expect(r.salida).toMatch(/401|Unauthorized/i);
    } finally {
      await s.parar();
    }
  });

  it("con un 503 del despliegue mal configurado también falla", async () => {
    // Sin `API_KEY` en el servidor el middleware cierra con 503 y lo dice en el
    // cuerpo. Es el otro caso que un cron se tragaba.
    const s = await servidor(() => ({
      estado: 503,
      cuerpo: JSON.stringify({ error: "Service misconfigured – API_KEY is not set" }),
    }));
    try {
      const r = await lanzar(
        ["--digest"],
        { ...CLAVES, API_KEY: "", NEXT_PUBLIC_SITE_URL: s.url },
        cwdLimpio()
      );

      expect({ codigo: r.codigo }).toEqual({ codigo: 1 });
      expect(r.salida).toMatch(/503|API_KEY/);
    } finally {
      await s.parar();
    }
  });

  it("con un 200 sale con código 0 e imprime el digest", async () => {
    // La mitad complementaria: si `res.ok` se comprobara mal, el camino bueno se
    // rompe y el cron empieza a fallar cuando todo va bien.
    const s = await servidor(() => ({
      estado: 200,
      cuerpo: JSON.stringify({ ok: true, sent: 3, total: 3 }),
    }));
    try {
      const r = await lanzar(
        ["--digest"],
        { ...CLAVES, API_KEY: "la-buena", NEXT_PUBLIC_SITE_URL: s.url },
        cwdLimpio()
      );

      expect({ codigo: r.codigo }).toEqual({ codigo: 0 });
      expect(r.salida).toMatch(/digest:.*"sent":3/);
    } finally {
      await s.parar();
    }
  });
});

describe("send-push.mjs distingue un bloqueo de que no haya base", () => {
  it("una base sujeta por otro proceso se dice bloqueo, y sale con código 1", async () => {
    // El bug medido. El `catch` vacío convertía `SQLITE_BUSY (errcode 5)` en
    // «No hay base de datos de suscripciones todavía», con código 0: quien lo leía
    // se enteraba de que no hay suscriptores cuando lo que había era el servidor
    // escribiendo el digest en ese mismo fichero.
    const dir = cwdLimpio();
    const { dbdir, pdb } = baseVacia();

    // El lock lo pone `sujetar`, que espera a tenerlo de verdad en vez de confiar en
    // un temporizador. El caso tarda lo que tarde el `busy_timeout` del script: unos
    // cinco segundos de espera antes de que el `SELECT` se rinda.
    const soltar = await sujetar(pdb);
    try {
      const r = await lanzar(
        ["--title", "Hola", "--body", "Mundo"],
        { ...CLAVES, PUSH_DB_DIR: dbdir, NEXT_PUBLIC_SITE_URL: "https://ejemplo.test" },
        dir
      );

      expect({ codigo: r.codigo }).toEqual({ codigo: 1 });
      expect(r.salida).toMatch(/bloque/i);
      // Y no puede haber salido el «no hay base», que es la mentira.
      expect(r.salida).not.toMatch(/No hay base de datos/i);
    } finally {
      soltar();
    }
  });

  it("una base que no existe sigue siendo «no hay base», y sale con código 0", async () => {
    // La otra mitad: el arreglo no puede convertir un alta nueva en un error de
    // despliegue. Sin base no hay nada que mandar, y eso no es un fallo del cron.
    const dir = cwdLimpio();

    const r = await lanzar(
      ["--title", "Hola", "--body", "Mundo"],
      { ...CLAVES, PUSH_DB_DIR: join(dir, "no-existe"), NEXT_PUBLIC_SITE_URL: "https://ejemplo.test" },
      dir
    );

    expect({ codigo: r.codigo }).toEqual({ codigo: 0 });
    expect(r.salida).toMatch(/No hay base de datos/i);
  });

  it("una base vacía dice que no hay suscripciones, no que no hay base", async () => {
    // Las dos cosas son verdad y se distinguen por la palabra: la primera vez que
    // se despliega hay base y no hay nadie, y el mensaje tiene que decir eso.
    const dir = cwdLimpio();
    const { dbdir } = baseVacia();

    const r = await lanzar(
      ["--title", "Hola", "--body", "Mundo"],
      { ...CLAVES, PUSH_DB_DIR: dbdir, NEXT_PUBLIC_SITE_URL: "https://ejemplo.test" },
      dir
    );

    expect(r.salida).toMatch(/No hay suscripciones/i);
    expect(r.salida).not.toMatch(/No hay base de datos/i);
  });
});
