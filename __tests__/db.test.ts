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

    const { addSubscriber, getActiveSubscribers } = cargarDb();
    addSubscriber("hola@ejemplo.test");

    expect(existsSync(destino)).toBe(true);
    expect(getActiveSubscribers().map((s) => s.email)).toEqual(["hola@ejemplo.test"]);
  });

  it("un fichero corrupto no borra a los que ya había: se queda vacío", () => {
    // `readSubscribers` ya tenía un `catch` que devuelve `[]`. El detalle que
    // importa es que no lanza: una alta sobre un `subscribers.json` a medias no
    // puede tumbar el endpoint de suscripción.
    const destino = join(dir, "roto.json");
    writeFileSync(destino, "{ esto no es json", "utf-8");
    process.env.SUBSCRIBERS_PATH = destino;

    const { addSubscriber, getActiveSubscribers } = cargarDb();
    expect(getActiveSubscribers()).toEqual([]);
    expect(() => addSubscriber("hola@ejemplo.test")).not.toThrow();
    expect(getActiveSubscribers()).toHaveLength(1);
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
});
