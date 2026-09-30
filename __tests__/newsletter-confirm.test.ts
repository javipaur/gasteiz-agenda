import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

/**
 * La confirmación del newsletter deja de ser decorativa.
 *
 * `app/api/newsletter/confirm/route.ts` devolvía el mismo 200 —y la misma
 * redirección a `?newsletter=confirmed`— para cualquier cadena, porque el
 * suscriptor ya nacía `active: true` en el alta y no quedaba nada que
 * confirmar. Es decir: el enlace de confirmación que se mandaba por correo no
 * confirmaba nada, y escribir una dirección en el formulario bastaba para
 * empezar a recibir la agenda semanal de Vitoria.
 *
 * La decisión es la doble confirmación de toda la vida: el alta deja al
 * suscriptor pendiente y el enlace lo activa. Las otras dos opciones eran
 * mantener el alta directa y que el enlace solo comprobara que el token existe
 * —entonces el correo de confirmación y el «revisa tu correo para confirmar la
 * suscripción» que ya devuelve el endpoint serían mentira— o borrar el enlace,
 * que además rompe los correos que ya se han enviado.
 */

type Db = typeof import("@/lib/db");

let dir: string;
let destino: string;
const previo = process.env.SUBSCRIBERS_PATH;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "confirmacion-"));
  destino = join(dir, "suscriptores.json");
  process.env.SUBSCRIBERS_PATH = destino;
  jest.resetModules();
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
  if (previo === undefined) delete process.env.SUBSCRIBERS_PATH;
  else process.env.SUBSCRIBERS_PATH = previo;
});

function db(): Db {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require("@/lib/db") as Db;
}

type Route = typeof import("@/app/api/newsletter/confirm/route");

function ruta(): Route["GET"] {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return (require("@/app/api/newsletter/confirm/route") as Route).GET;
}

function pedir(url: string): Request {
  return new Request(`https://gasteizclick.test${url}`);
}

/** A dónde manda la redirección, sin la base. */
function destinoDe(res: Response): string {
  const location = res.headers.get("location");
  if (!location) throw new Error("La respuesta no redirige");
  return new URL(location).pathname + new URL(location).search;
}

describe("el alta", () => {
  it("deja al suscriptor pendiente, no activo", () => {
    const { addSubscriber, getActiveSubscribers, getAllSubscribers } = db();

    addSubscriber("nuevo@ejemplo.test");

    expect(getActiveSubscribers()).toEqual([]);
    expect(getAllSubscribers().map((s) => s.active)).toEqual([false]);
  });

  it("reutiliza la entrada si el correo ya estaba, sin duplicar", () => {
    const { addSubscriber, getAllSubscribers } = db();
    const primero = addSubscriber("nuevo@ejemplo.test");
    const segundo = addSubscriber("nuevo@ejemplo.test");

    expect(getAllSubscribers()).toHaveLength(1);
    expect(segundo).toEqual({ token: primero.token, exists: true, active: false });
  });

  it("dice si el correo ya estaba activo, para que el mensaje no mienta", () => {
    // Con el alta directa, «ya estás suscrito» era cierto siempre que el correo
    // estaba en la lista. Con la doble confirmación hay un tercer caso —se dio
    // de baja y vuelve— y ahí la frase sería falsa: sigue en la lista, pero
    // inactivo y esperando otro correo.
    const { addSubscriber, confirmSubscriber, removeSubscriber } = db();
    const { token } = addSubscriber("nuevo@ejemplo.test");
    confirmSubscriber(token);
    expect(addSubscriber("nuevo@ejemplo.test")).toEqual({
      token,
      exists: true,
      active: true,
    });

    removeSubscriber(token);
    expect(addSubscriber("nuevo@ejemplo.test")).toEqual({
      token,
      exists: true,
      active: false,
    });
  });

  it("reinscribirse no reactiva a quien se había dado de baja", () => {
    // Si lo activara, el alta volvería a ser suficiente por sí sola y la
    // confirmación seguiría sin significar nada. Quien pidió la baja tiene que
    // volver a pedirla.
    const { addSubscriber, confirmSubscriber, removeSubscriber, getActiveSubscribers, getAllSubscribers } =
      db();
    const { token } = addSubscriber("nuevo@ejemplo.test");
    confirmSubscriber(token);
    removeSubscriber(token);
    expect(getActiveSubscribers()).toEqual([]);

    addSubscriber("nuevo@ejemplo.test");

    expect(getActiveSubscribers()).toEqual([]);
    expect(getAllSubscribers().map((s) => s.active)).toEqual([false]);
  });
});

describe("confirmar", () => {
  it("con el token correcto activa al suscriptor", () => {
    const { addSubscriber, confirmSubscriber, getActiveSubscribers } = db();
    const { token } = addSubscriber("nuevo@ejemplo.test");

    expect(confirmSubscriber(token)).toBe(true);
    expect(getActiveSubscribers().map((s) => s.email)).toEqual(["nuevo@ejemplo.test"]);
  });

  it("con un token que no existe no activa a nadie", () => {
    const { addSubscriber, confirmSubscriber, getActiveSubscribers } = db();
    addSubscriber("nuevo@ejemplo.test");

    expect(confirmSubscriber("inventado")).toBe(false);
    expect(getActiveSubscribers()).toEqual([]);
  });

  it("es idempotente: confirmar dos veces el mismo token no rompe nada", () => {
    // El enlace vive en el correo de la gente, y el correo vive en el historial
    // de la bandeja de entrada: volver a pulsarlo tiene que ser inocuo.
    const { addSubscriber, confirmSubscriber, getAllSubscribers } = db();
    const { token } = addSubscriber("nuevo@ejemplo.test");

    expect(confirmSubscriber(token)).toBe(true);
    expect(confirmSubscriber(token)).toBe(true);
    expect(getAllSubscribers()).toHaveLength(1);
  });

  it("no acepta ni una cadena vacía ni un token parecida", () => {
    const { addSubscriber, confirmSubscriber, getActiveSubscribers } = db();
    const { token } = addSubscriber("nuevo@ejemplo.test");

    // Ni con mayúsculas: el token es un UUID en minúsculas y la comparación es
    // exacta, así que no hay forma de acertar por aproximación.
    for (const intento of [
      "",
      "   ",
      token.slice(0, -1),
      token.toUpperCase(),
      "00000000-0000-0000-0000-000000000000",
    ]) {
      expect({ intento, aceptado: confirmSubscriber(intento) }).toEqual({ intento, aceptado: false });
    }
    expect(getActiveSubscribers()).toEqual([]);
  });

  it("el token se genera con uuid y no con algo adivinable", () => {
    const { addSubscriber } = db();
    const { token } = addSubscriber("nuevo@ejemplo.test");
    expect(token).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
  });
});

describe("darse de baja", () => {
  it("desactiva, y no borra: la entrada se queda con el token", () => {
    // Borrar la fila haría que un segundo intento de alta generase un token
    // distinto y que el enlace de baja antiguo dejara de poder usarse — o peor,
    // que volviera a encontrar a alguien si el UUID se repitiera.
    const { addSubscriber, confirmSubscriber, removeSubscriber, getAllSubscribers } = db();
    const { token } = addSubscriber("nuevo@ejemplo.test");
    confirmSubscriber(token);

    expect(removeSubscriber(token)).toBe(true);
    expect(getAllSubscribers()).toHaveLength(1);
    expect(getAllSubscribers()[0].active).toBe(false);
  });

  it("con un token que no existe no toca a nadie", () => {
    const { addSubscriber, confirmSubscriber, removeSubscriber, getActiveSubscribers } = db();
    const { token } = addSubscriber("nuevo@ejemplo.test");
    confirmSubscriber(token);

    expect(removeSubscriber("inventado")).toBe(false);
    expect(getActiveSubscribers()).toHaveLength(1);
  });
});

describe("GET /api/newsletter/confirm", () => {
  it("con el token correcto manda a confirmado", async () => {
    const { token } = db().addSubscriber("nuevo@ejemplo.test");

    const res = await ruta()(pedir(`/api/newsletter/confirm?token=${token}`));

    expect(destinoDe(res)).toBe("/?newsletter=confirmed");
    expect(db().getActiveSubscribers()).toHaveLength(1);
  });

  it("con un token inventado no manda a confirmado", async () => {
    // Este es el test que muerde. Antes devolvía exactamente la misma
    // redirección para cualquier cadena, así que el enlace no distinguía un
    // token válido de uno escrito a mano.
    const res = await ruta()(pedir("/api/newsletter/confirm?token=inventado"));

    expect(destinoDe(res)).not.toContain("confirmed");
    expect(db().getActiveSubscribers()).toEqual([]);
  });

  it("sin token no manda a confirmado tampoco", async () => {
    const res = await ruta()(pedir("/api/newsletter/confirm"));

    expect(destinoDe(res)).not.toContain("confirmed");
  });

  it("un token en mayúsculas no confirma", async () => {
    const { token } = db().addSubscriber("nuevo@ejemplo.test");

    const res = await ruta()(pedir(`/api/newsletter/confirm?token=${token.toUpperCase()}`));

    expect(destinoDe(res)).not.toContain("confirmed");
    expect(db().getActiveSubscribers()).toEqual([]);
  });

  it("el token de otro suscriptor no activa al primero", async () => {
    const { addSubscriber } = db();
    const { token: deA } = addSubscriber("a@ejemplo.test");
    addSubscriber("b@ejemplo.test");

    const res = await ruta()(pedir(`/api/newsletter/confirm?token=${deA}`));

    expect(destinoDe(res)).toBe("/?newsletter=confirmed");
    expect(db().getActiveSubscribers().map((s) => s.email)).toEqual(["a@ejemplo.test"]);
  });

  it("volver a pulsar el enlace tras darse de baja no lo resucita", async () => {
    // El enlace de baja y el de confirmación son el mismo token. Con la
    // suscripción anulada, confirmar tiene que volver a ponerla pendiente, no
    // activa: si no, un correo antiguo bastaría para volver a traer a alguien a
    // la lista.
    const { token } = db().addSubscriber("nuevo@ejemplo.test");
    const get = ruta();
    const res = await get(pedir(`/api/newsletter/confirm?token=${token}`));
    // 307, no 200: `NextResponse.redirect` usa 307 por defecto y es lo que
    // quiere el navegador. Se fija para que un cambio a 200 —que se come el
    // método en algunos clientes— no pase inadvertido.
    expect(res.status).toBe(307);
    expect(db().getActiveSubscribers()).toHaveLength(1);

    db().removeSubscriber(token);
    expect(db().getActiveSubscribers()).toEqual([]);

    // Confirmar sobre una entrada anulada la deja pendiente otra vez, que es lo
    // coherente con «el alta sola no basta».
    expect(db().confirmSubscriber(token)).toBe(false);
    expect(db().getActiveSubscribers()).toEqual([]);
  });
});
