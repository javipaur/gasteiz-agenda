/**
 * `NEXT_PUBLIC_SITE_URL` no puede faltar en producción, y no había forma de
 * enterarse.
 *
 * No estaba en `.env`, ni en `.env.local`, ni en un `.env.example` —que este repo
 * no tenía—, y `README.md:43` la listaba como requerida. El valor de reserva era
 * `http://localhost:3000`, así que un despliegue sin la variable construía los
 * enlaces de confirmación y de baja del newsletter contra `localhost`: el alta
 * respondía `200`, el correo salía, y el enlace no llevaba a ninguna parte. La
 * doble opt-in se cumplía y no se podía completar, en silencio.
 *
 * Estos tests fijan las dos mitades, porque fallan por motivos distintos:
 *
 * - **En producción, sin la variable, se lanza.** Es lo que convierte un
 *   despliegue mal configurado en un error de arranque visible en vez de en un
 *   correo roto que nadie lee hasta que un suscriptor se queja.
 * - **Fuera de producción, la ausencia es normal** y cae a `localhost`. Si el
 *   primer test contaminara al segundo, developing sin configurar nada —que es
 *   lo cómodo— dejaría de funcionar.
 */

import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

type Email = typeof import("@/lib/email");

const ROOT = resolve(__dirname, "..");

const ORIGINAL_ENV = process.env.NODE_ENV;
const ORIGINAL_SITE_URL = process.env.NEXT_PUBLIC_SITE_URL;

const entorno = process.env as Record<string, string | undefined>;
const fijaSitio = (valor: string | undefined) => {
  if (valor === undefined) delete entorno.NEXT_PUBLIC_SITE_URL;
  else entorno.NEXT_PUBLIC_SITE_URL = valor;
};

function cargar(): Email {
  jest.resetModules();
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require("@/lib/email") as Email;
}

afterEach(() => {
  jest.restoreAllMocks();
  // `NODE_ENV` es de solo lectura en los tipos, y con razón: es lo que Next y Jest
  // definen. Por eso el borrado va por el cast y no por `process.env`.
  if (ORIGINAL_ENV === undefined) delete entorno.NODE_ENV;
  else entorno.NODE_ENV = ORIGINAL_ENV;
  fijaSitio(ORIGINAL_SITE_URL);
});

describe("la URL base del sitio", () => {
  it("en producción, sin NEXT_PUBLIC_SITE_URL, lanza en vez de mandar un enlace roto", async () => {
    entorno.NODE_ENV = "production";
    fijaSitio(undefined);
    jest.spyOn(console, "log").mockImplementation(() => {});
    jest.spyOn(console, "error").mockImplementation(() => {});

    const { sendWeeklyNewsletter } = cargar();

    // El error tiene que decir QUÉ variable falta, no solo que algo falló: quien
    // lo lea es quien puede arreglarlo, y está en un cron a las nueve.
    await expect(
      sendWeeklyNewsletter([], "alguien@example.com", "tok")
    ).rejects.toThrow(/NEXT_PUBLIC_SITE_URL/);
  });

  it("también lanza con la confirmación", async () => {
    // Las dos rutas leen la misma variable, y si solo se arreglara una, el alta
    // seguiría funcionando y el correo de confirmación seguiría roto.
    entorno.NODE_ENV = "production";
    fijaSitio(undefined);
    jest.spyOn(console, "log").mockImplementation(() => {});
    jest.spyOn(console, "error").mockImplementation(() => {});

    const { sendConfirmationEmail } = cargar();

    await expect(sendConfirmationEmail("alguien@example.com", "tok")).rejects.toThrow(
      /NEXT_PUBLIC_SITE_URL/
    );
  });

  it("con la variable puesta, los enlaces se construyen contra ella", async () => {
    entorno.NODE_ENV = "production";
    fijaSitio("https://gasteizclick.javierpalacio.es");
    jest.spyOn(console, "log").mockImplementation(() => {});

    const enviado: { html: string } = { html: "" };
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    jest.doMock("@/lib/mail", () => ({
      sendMail: jest.fn(async (o: { html: string }) => {
        enviado.html = o.html;
        return { ok: true };
      }),
    }));
    jest.resetModules();
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { sendWeeklyNewsletter } = require("@/lib/email") as Email;

    await sendWeeklyNewsletter([], "alguien@example.com", "tok-123");

    expect(enviado.html).toContain(
      "https://gasteizclick.javierpalacio.es/api/newsletter/unsubscribe?token=tok-123"
    );
  });

  it("la barra final se quita, para no crear URLs con doble barra", async () => {
    entorno.NODE_ENV = "production";
    fijaSitio("https://gasteizclick.javierpalacio.es/");
    jest.spyOn(console, "log").mockImplementation(() => {});

    const enviado: { html: string } = { html: "" };
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    jest.doMock("@/lib/mail", () => ({
      sendMail: jest.fn(async (o: { html: string }) => {
        enviado.html = o.html;
        return { ok: true };
      }),
    }));
    jest.resetModules();
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { sendWeeklyNewsletter } = require("@/lib/email") as Email;

    await sendWeeklyNewsletter([], "alguien@example.com", "tok-123");

    expect(enviado.html).toContain("/api/newsletter/unsubscribe?token=tok-123");
    expect(enviado.html).not.toContain("es//api");
  });

  it("fuera de producción, la ausencia es normal", async () => {
    entorno.NODE_ENV = "test";
    fijaSitio(undefined);
    jest.spyOn(console, "log").mockImplementation(() => {});

    const { sendWeeklyNewsletter } = cargar();

    // Developing sin configurar nada tiene que funcionar; si este test
    // contaminara al de arriba, nadie podría trabajar en local.
    await expect(
      sendWeeklyNewsletter([], "alguien@example.com", "tok")
    ).resolves.toBeDefined();
  });
});

describe("la plantilla de entorno", () => {
  let dir: string;
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "plantilla-"));
  });
  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("existe", () => {
    // Sin ella, la forma de descubrir que falta `NEXT_PUBLIC_SITE_URL` es leer
    // el README, y el README no es lo que se mira al montar un despliegue.
    expect(existsSync(join(ROOT, ".env.example"))).toBe(true);
  });

  it("`.env` está ignorado y `.env.example` no, porque la plantilla se versiona", () => {
    // Al revés de lo que parece lo natural, y por eso este test mide las tres: `.env*`
    // se come también `.env.example`, así que sin la excepción `!.env.example`
    // del `.gitignore` la plantilla no se versiona — y un fichero que nadie
    // recibe al clonar no puede cumplir su función, que es la de decir qué
    // variables existen. Fijar lo contrario fijaría el error.
    const ignorado = (relativo: string) => {
      try {
        execFileSync("git", ["check-ignore", "-q", relativo], {
          cwd: ROOT,
          stdio: "ignore",
        });
        return true;
      } catch {
        return false;
      }
    };

    expect({
      env: ignorado(".env"),
      envLocal: ignorado(".env.local"),
      plantilla: ignorado(".env.example"),
    }).toEqual({ env: true, envLocal: true, plantilla: false });
  });

  it("menciona cada variable que el código lee del entorno", () => {
    // La plantilla se pudre: se añade una variable al código y nadie se acuerda de
    // la plantilla, y el siguiente despliegue en otra máquina no la tiene. El
    // test la ata al código.
    const plantilla = readFileSync(join(ROOT, ".env.example"), "utf-8");

    const leidas = [
      "API_KEY",
      "NEXT_PUBLIC_SITE_URL",
      "VAPID_PUBLIC_KEY",
      "VAPID_PRIVATE_KEY",
      "NEXT_PUBLIC_VAPID_PUBLIC_KEY",
      "ENABLE_PUSH_SCHEDULER",
      "PUSH_DIGEST_HOUR",
      "EMAIL_USER",
      "EMAIL_PASS",
      "MEC_TOKEN",
      "SUBSCRIBERS_PATH",
      "PUSH_DB_DIR",
    ];

    const faltan = leidas.filter((v) => !plantilla.includes(v));
    expect({ faltan }).toEqual({ faltan: [] });
  });

  it("no contiene ningún secreto con valor", () => {
    // Las plantillas se copian. Una clave o un token que se quedan pegados ahí
    // acaban en el repositorio de quien la copie, y `NEXT_PUBLIC_SITE_URL` esta
    // además incrustada en el bundle de la app móvil aunque nada se versione.
    //
    // Solo se miran las variables cuyo nombre delata un secreto.
    // `ENABLE_PUSH_SCHEDULER=0`, `PUSH_DIGEST_HOUR=9` y `AXIOM_DATASET` sí llevan
    // valor, y es lo que deben: son configuración de un despliegue, no una
    // credencial — y `AXIOM_DATASET` está además en `nixpacks.toml` en claro.
    const plantilla = readFileSync(join(ROOT, ".env.example"), "utf-8");
    const conValor = plantilla
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => {
        const igual = l.match(/^([A-Z0-9_]+)=(.+)$/);
        if (!igual) return false;
        const [, nombre, valor] = igual;
        const pareceSecreto =
          /KEY|SECRET|TOKEN|PASS|EMAIL_USER/.test(nombre) && !/PUBLIC/.test(nombre);
        return pareceSecreto && !/^[0-9]+$/.test(valor);
      });

    expect({ conValor }).toEqual({ conValor: [] });
  });
});