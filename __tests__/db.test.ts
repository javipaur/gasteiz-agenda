import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

/**
 * `data/subscribers.json` fuera de git, y la ruta configurable.
 *
 * El fichero estaba versionado con ocho entradas y sus tokens de baja. Las ocho
 * son de prueba —`test@`, `rl1..rl6@`, `repeat@`—, así que no había datos
 * personales reales, y eso es lo que lo hacía tolerable. Lo que no lo es es que
 * `lib/db.ts:61` da de baja a quien tenga el token: con el fichero en un repo
 * público, cualquiera que leyera el historial —o el fichero— se llevaba la lista
 * de correos de los suscriptores de verdad en cuanto hubiera alguno, porque el
 * formato del alta no cambia.
 *
 * Este fichero se queda en el disco para que la app arranque en local —de eso
 * trata `ensureFichero`— pero no se versionea. La reescritura del historial la
 * hace quien mantenga el repo; aquí solo se prepara el terreno.
 */

const ROOT = resolve(__dirname, "..");
const RELATIVO = "data/subscribers.json";

type Db = typeof import("@/lib/db");

function cargarDb(): Db {
  jest.resetModules();
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require("@/lib/db") as Db;
}

function git(args: string[]): { codigo: number; salida: string } {
  try {
    const salida = execFileSync("git", args, {
      cwd: ROOT,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    return { codigo: 0, salida };
  } catch (e) {
    const err = e as { status: number; stdout: string };
    return { codigo: err.status, salida: err.stdout ?? "" };
  }
}

let dir: string;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "suscriptores-"));
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe("la ruta del fichero de suscriptores", () => {
  const previo = process.env.SUBSCRIBERS_PATH;
  afterEach(() => {
    if (previo === undefined) delete process.env.SUBSCRIBERS_PATH;
    else process.env.SUBSCRIBERS_PATH = previo;
  });

  it("usa SUBSCRIBERS_PATH cuando está definida", () => {
    const destino = join(dir, "en-volumen.json");
    process.env.SUBSCRIBERS_PATH = destino;

    const { addSubscriber } = cargarDb();
    addSubscriber("hola@ejemplo.test");

    expect(existsSync(destino)).toBe(true);
    const guardado = JSON.parse(readFileSync(destino, "utf8"));
    expect(guardado).toHaveLength(1);
    expect(guardado[0].email).toBe("hola@ejemplo.test");
  });

  it("sin la variable, cae en `data/subscribers.json` del directorio de trabajo", () => {
    delete process.env.SUBSCRIBERS_PATH;
    const cwd = process.cwd();
    process.chdir(dir);
    try {
      const { addSubscriber } = cargarDb();
      addSubscriber("hola@ejemplo.test");
      expect(existsSync(join(dir, RELATIVO))).toBe(true);
    } finally {
      process.chdir(cwd);
    }
  });

  it("crea el directorio y el fichero si no existen, para que la app arranque en local", () => {
    // El alta es lo único que se ejecuta en producción, así que es aquí donde se
    // decide si un despliegue sin volumen se rompe al escribir o solo pierde
    // datos. Un `mkdir` que no existe convertía el primer alta en un ENOENT.
    const destino = join(dir, "nuevo", "anidado", "suscriptores.json");
    process.env.SUBSCRIBERS_PATH = destino;
    expect(existsSync(join(dir, "nuevo"))).toBe(false);

    const { addSubscriber, getAllSubscribers } = cargarDb();
    addSubscriber("hola@ejemplo.test");

    expect(existsSync(destino)).toBe(true);
    // `getAllSubscribers` y no `getActiveSubscribers`: este test va de dónde se
    // escribe, no de si la suscripción está activa. Con la doble confirmación un
    // alta recién hecha está pendiente, así que `getActiveSubscribers` saldría
    // vacío y el test no distinguiría «no se escribió» de «se escribió
    // pendiente».
    expect(getAllSubscribers().map((s) => s.email)).toEqual(["hola@ejemplo.test"]);
  });

  it("un fichero corrupto no borra a los que ya había: se queda vacío", () => {
    // `readSubscribers` ya tenía un `catch` que devuelve `[]`. El detalle que
    // importa es que no lanza: una alta sobre un `subscribers.json` a medias no
    // puede tumbar el endpoint de suscripción.
    const destino = join(dir, "roto.json");
    writeFileSync(destino, "{ esto no es json", "utf-8");
    process.env.SUBSCRIBERS_PATH = destino;

    const { addSubscriber, getAllSubscribers } = cargarDb();
    expect(getAllSubscribers()).toEqual([]);
    expect(() => addSubscriber("hola@ejemplo.test")).not.toThrow();
    expect(getAllSubscribers()).toHaveLength(1);
  });
});

describe("data/subscribers.json y git", () => {
  it("está en .gitignore", () => {
    // `git check-ignore` es el que dice la verdad: un patrón puede parecer que
    // cubre el fichero y no cubrirlo, y un `.gitignore` equivocado no da error
    // en ningún sitio.
    const r = git(["check-ignore", "-q", RELATIVO]);
    expect({ fichero: RELATIVO, ignorado: r.codigo === 0 }).toEqual({
      fichero: RELATIVO,
      ignorado: true,
    });
  });

  it("no está versionado", () => {
    const r = git(["ls-files", "--error-unmatch", RELATIVO]);
    expect({ fichero: RELATIVO, versionado: r.codigo === 0 }).toEqual({
      fichero: RELATIVO,
      versionado: false,
    });
  });

  it("existe en disco y está vacío, para no tener que pedirlo en el primer arranque", () => {
    const destino = join(ROOT, RELATIVO);
    expect({ existe: existsSync(destino) }).toEqual({ existe: true });
    expect(JSON.parse(readFileSync(destino, "utf-8"))).toEqual([]);
  });

  it("`.data/`, que es el otro sitio donde se escribe, sigue ignorado", () => {
    // Lo de `push.db` es el mismo problema y ya estaba resuelto. Se comprueba
    // para que nadie lo deshaga de paso con este cambio.
    const r = git(["check-ignore", "-q", ".data/push.db"]);
    expect({ ignorado: r.codigo === 0 }).toEqual({ ignorado: true });
  });

  it("el resto de `data/` no está ignorado, porque ahí viven datos del proyecto", () => {
    // `data/` lleva siete ficheros versionados —las rutas de turismo, la
    // gastronomía, los partidos, el fixture de curados— y añadir `data/` al
    // `.gitignore` los dejaba tapados. No rompía nada ese día, porque git no
    // reporta como ignorado un fichero que ya está trackeado; lo que hacía era
    // dejar la bomba armada para el siguiente fichero de datos que alguien
    // quisiera meter ahí: `git add` lo rechazaba en silencio y hacía falta
    // `git add -f` para saber por qué.
    //
    // Se comprueba con un fichero nuevo, no con los ya trackeados, porque es
    // justo el caso nuevo el que fallaba.
    const versionados = git(["ls-files", "data/"]).salida
      .split(/\r?\n/)
      .filter(Boolean);
    expect(versionados.length).toBeGreaterThan(0);

    const laIgnored: string[] = [];
    for (const relativo of versionados) {
      // `git check-ignore` solo responde sobre ficheros no trackeados, así que
      // se pregunta por el patrón directamente con `check-ignore --no-index`.
      const r = git(["check-ignore", "--no-index", "-q", relativo]);
      if (r.codigo === 0) laIgnored.push(relativo);
    }
    expect(laIgnored).toEqual([]);
  });

  it("un fichero nuevo dentro de `data/` se puede añadir sin `--force`", () => {
    // La forma de mirar lo mismo desde el otro lado: se pide a git si ignoraría
    // un fichero que todavía no existe, que es exactamente la pregunta que se
    // hace uno al añadir un dato nuevo.
    const nuevo = "data/turismo/rutas-nuevas.json";
    const r = git(["check-ignore", "--no-index", "-q", nuevo]);
    expect({ fichero: nuevo, ignorado: r.codigo === 0 }).toEqual({
      fichero: nuevo,
      ignorado: false,
    });
  });
});
