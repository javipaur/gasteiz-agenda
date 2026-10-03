import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

/**
 * El alta del newsletter tenía tres fallos que no se veían en la respuesta.
 *
 * Los tres son el mismo tipo de problema: la ruta contestaba `200` y «todo bien»
 * cuando lo que había pasado era lo contrario. Un buzón con dos filas activas
 * —una con cada capitalización— que solo se da de baja a medias; un alta
 * registrada cuyo correo de confirmación no salió y que se queda pendiente para
 * siempre sin que nadie lo sepa; y un mapa de rate limit donde cada clave creada
 * se queda en el heap del proceso para siempre.
 *
 * Se monta como `newsletter-confirm.test.ts`: `SUBSCRIBERS_PATH` a un tmpdir y
 * `jest.resetModules()` antes de cada caso, porque el módulo de la ruta tiene
 * estado —el mapa del limiter— que si no se heredarían entre tests y las
 * cuentas de intentos no empezarían de cero.
 */

type Db = typeof import("@/lib/db");
type Route = typeof import("@/app/api/newsletter/subscribe/route");

const previo = process.env.SUBSCRIBERS_PATH;

/**
 * `NODE_ENV` es de solo lectura en los tipos de `process.env`. El caso del
 * correo que no sale necesita ponerlo a `production` para que `lib/mail.ts` tome
 * el camino que toma en el despliegue real, así que se escribe con un cast en
 * vez de con `// @ts-expect-error` que alguien acabaría borrando.
 */
const entorno = process.env as Record<string, string | undefined>;

const sitioPrevio = process.env.NEXT_PUBLIC_SITE_URL;

let dir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "alta-newsletter-"));
  process.env.SUBSCRIBERS_PATH = join(dir, "suscriptores.json");
  jest.resetModules();
  // `lib/mail.ts` hace mock fuera de producción y escribe dos líneas por envío.
  // Con la avalancha del último test eso serían más de 1000.
  jest.spyOn(console, "log").mockImplementation(() => {});
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
  if (previo === undefined) delete process.env.SUBSCRIBERS_PATH;
  else process.env.SUBSCRIBERS_PATH = previo;
  delete process.env.EMAIL_USER;
  delete process.env.EMAIL_PASS;
  if (sitioPrevio === undefined) delete entorno.NEXT_PUBLIC_SITE_URL;
  else entorno.NEXT_PUBLIC_SITE_URL = sitioPrevio;
  entorno.NODE_ENV = "test";
});

/**
 * Deja el entorno como un despliegue bien configurado, para que un test pueda
 * provocar **un** fallo y no dos.
 *
 * Hace falta desde que `lib/email.ts` lanza en producción si falta
 * `NEXT_PUBLIC_SITE_URL`: sin esto, el test de "el SMTP no contesta" arranca en
 * producción sin la variable y revienta con el error de `siteUrl()` antes de
 * llegar al SMTP —un 500 en vez del 502 que quiere comprobar— y pasa a no estar
 * probando lo que dice probar. Los dos fallos por separado tienen sus propios
 * tests, en `__tests__/site-url.test.ts`.
 */
function despliegueConfigurado(): void {
  entorno.NEXT_PUBLIC_SITE_URL = "https://gasteizclick.javierpalacio.es";
}

function db(): Db {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require("@/lib/db") as Db;
}

function post(): Route["POST"] {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return (require("@/app/api/newsletter/subscribe/route") as Route).POST;
}

/**
 * Un POST de formulario de verdad: con `startedAt` ya pasado para que no lo
 * tome por un bot que rellenó el campo en cero segundos, y sin `website` para no
 * caer en el honeypot.
 */
function pedir(email: string, ip = "192.0.2.1"): Request {
  return new Request("https://gasteizclick.test/api/newsletter/subscribe", {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": ip },
    body: JSON.stringify({ email, startedAt: Date.now() - 10_000 }),
  });
}

async function cuerpo(res: Response): Promise<Record<string, unknown>> {
  return (await res.json()) as Record<string, unknown>;
}

/**
 * Tarea 1 — dos filas para un buzón.
 *
 * `addSubscriber` busca con `s.email === email`, o sea comparación exacta. Sin
 * normalizar, `Gasteiz.Click@ejemplo.test` y `gasteiz.click@ejemplo.test` son
 * dos suscriptores: dos filas, dos tokens de baja, y `removeSubscriber` —que
 * busca por token— solo apaga una. Quien se da de baja sigue recibiendo la
 * agenda, que es justo lo que el enlace de baja tenía que impedir.
 */
describe("el alta no parte el buzón en dos", () => {
  it("un buzón ya guardado con otra capitalización no se duplica", async () => {
    const { addSubscriber, getAllSubscribers } = db();
    // La fila que hay hoy en el fichero de producción, escrita antes de que
    // existiera la normalización.
    const { token } = addSubscriber("Gasteiz.Click@ejemplo.test");

    const res = await post()(pedir("gasteiz.click@ejemplo.test"));

    expect(res.status).toBe(200);
    const filas = getAllSubscribers();
    // El fallo viejo: dos filas, dos tokens, y la baja solo apaga una.
    expect(filas).toHaveLength(1);
    // Y no se toca la fila que ya estaba: es la que lleva el enlace de baja de la
    // última newsletter que recibió esa persona, y ese token no se inventar otro
    // en una ruta.
    expect(filas[0].email).toBe("Gasteiz.Click@ejemplo.test");
    expect(filas[0].token).toBe(token);
  });

  it("un buzón nuevo se guarda ya normalizado", async () => {
    // La mitad que no tiene fila previa. Sin ella, el arreglo de arriba podría
    // estar pasando por el motivo equivocado: el caso interesante es el buzón que
    // ya estaba en el fichero con la capitalización antigua.
    const res = await post()(pedir("Nuevo.Usuario@Ejemplo.Test"));

    expect(res.status).toBe(200);
    expect(db().getAllSubscribers().map((s) => s.email)).toEqual([
      "nuevo.usuario@ejemplo.test",
    ]);
  });

  it("la misma persona puede volver a suscribirse con otra capitalización", async () => {
    // El recorrido entero, y no solo el `status`: alta, confirmación y lista de
    // envío. Con esto se ve que las dos filas del principio serían un bug de
    // verdad —la activa y la que se da de baja— y no dos filas inertes.
    const { addSubscriber, confirmSubscriber, getActiveSubscribers } = db();
    const { token } = addSubscriber("Gasteiz.Click@ejemplo.test");
    confirmSubscriber(token);

    const res = await post()(pedir("GASTEIZ.CLICK@ejemplo.test"));

    expect(res.status).toBe(200);
    expect(getActiveSubscribers()).toHaveLength(1);
    expect(db().getAllSubscribers()).toHaveLength(1);
  });
});

/**
 * Tarea 2 — el resultado del correo de confirmación.
 *
 * El alta escribe la fila y deja al suscriptor en `active: false`: lo único que
 * lo activa es abrir el correo. Así que un correo que no sale no es un detalle
 * menor, es el alta entera sin su segunda mitad. Y como la fila queda pendiente
 * y nadie vuelve a mirar, el único sitio donde el fallo se ve es la respuesta.
 */
describe("el resultado del correo de confirmación decide la respuesta", () => {
  it("si el correo no sale, no se dice que se ha enviado", async () => {
    // El camino que de verdad se da en un despliegue mal configurado: en
    // producción, `lib/mail.ts` devuelve `ok: false` en vez de fingir. Antes esa
    // respuesta se ignoraba y la ruta contestaba 200 «revisa tu correo».
    entorno.NODE_ENV = "production";
    despliegueConfigurado();
    delete process.env.EMAIL_USER;
    delete process.env.EMAIL_PASS;
    const consola = jest.spyOn(console, "error").mockImplementation(() => {});

    const res = await post()(pedir("alguien@ejemplo.test"));

    // Un 502 y no un 500: lo que se ha caído es el SMTP que tiene delante, no la
    // ruta. Y no un 200 con otro mensaje, porque el 200 es lo que hace que el
    // fallo no exista para el cliente y para cualquier monitor.
    expect(res.status).toBe(502);
    const cuerpoRes = await cuerpo(res);
    expect(cuerpoRes.ok).toBeUndefined();
    expect(cuerpoRes.error).toMatch(/confirmación/i);
    // El fallo queda escrito en el log del servidor, que es donde se busca cuando
    // alguien dice que nunca le llegó nada.
    expect(consola).toHaveBeenCalledWith(expect.stringContaining("alguien@ejemplo.test"));

    // Y la fila se queda, porque es lo que hace que el reintento recupere: no se
    // borra el interés de alguien solo porque el SMTP estaba caído.
    expect(db().getAllSubscribers()).toHaveLength(1);

    // Con el SMTP otra vez en marcha, el mismo formulario reenvía el enlace en
    // vez de crear una fila nueva, y a quien suscribe le basta con volver a
    // escribir su correo.
    entorno.NODE_ENV = "test";
    const reintento = await post()(pedir("alguien@ejemplo.test"));

    expect(reintento.status).toBe(200);
    expect(await cuerpo(reintento)).toMatchObject({
      message: expect.stringMatching(/reenviado/i),
    });
    expect(db().getAllSubscribers()).toHaveLength(1);
  });
});

/**
 * Tarea 3 — el mapa del limiter no se vacía nunca.
 *
 * El limiter del middleware tiene `cleanupRateLimit()`; este no. Cada clave
 * `${ip}|${email}` que se crea se queda en el mapa para siempre con su array de
 * sellos, y el mapa vive en el módulo, así que solo muere con el proceso. Un bot
 * que rote 100 000 correos distintos deja 100 000 entradas en el heap.
 *
 * Lo que se comprueba aquí es la **expulsión**, que es la parte observable: la
 * limpieza por intervalo no se puede distinguir desde fuera, porque el filtro por
 * ventana de `isRateLimited` ya descarta los sellos viejos de una clave sin
 * borrarla. Lo que sí se nota es qué clave se ha ido del mapa.
 */
describe("las claves del rate limit no se acumulan para siempre", () => {
  it(
    "una avalancha de buzones expulsa las claves más antiguas en vez de crecer sin límite",
    async () => {
      const alta = post();
      const ip = "192.0.2.1";

      // Seis intentos al mismo buzón: el sexto se come el límite de cinco por
      // buzón. Es la clave más antigua del mapa y la que va a ser expulsada.
      for (let intento = 0; intento < 5; intento++) {
        expect((await alta(pedir("bot@ejemplo.test", ip))).status).toBe(200);
      }
      expect((await alta(pedir("bot@ejemplo.test", ip))).status).toBe(429);

      // La avalancha. El número sale del tope de claves de la ruta: hay que
      // pasar de 1000 para que la expulsión llegue a ocurrir, y cada petición
      // deja dos claves —IP y buzón— porque todas usan una IP distinta, así que
      // 501 bastan para llegar a 1002. Si alguien sube el tope, esto se pone rojo
      // en vez de quedarse sin comprobar nada: avisa de que la constante y el
      // test han dejado de cuadrar.
      for (let i = 0; i < 501; i++) {
        await alta(pedir(`rotada${i}@ejemplo.test`, `198.51.100.${i + 1}`));
      }

      // Antes esto seguía siendo un 429 para siempre: la clave estaba en el mapa
      // con sus cinco sellos y no había nada que la sacara. Ahora la clave más
      // antigua ya no está, así que el buzón cuenta desde cero.
      expect((await alta(pedir("bot@ejemplo.test", ip))).status).toBe(200);
    },
    120_000
  );
});