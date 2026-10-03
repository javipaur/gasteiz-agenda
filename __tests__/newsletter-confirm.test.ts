import { mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
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

/**
 * El mensaje del error, o la palabra clave si la llamada no lanzó.
 *
 * Hace falta porque lo que se compara es *qué* falla, no que falle: un `{}` y un
 * `42` dan el mismo tipo de mensaje, y lo que distingue el caso bueno del malo es
 * que el fichero quede byte a byte como estaba.
 */
function captur(fn: () => unknown): string {
  try {
    fn();
    return "NO LANZÓ";
  } catch (e) {
    return e instanceof Error ? e.message : String(e);
  }
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

  /**
   * El hueco que dejó la suite verde con el flujo roto.
   *
   * El test de arriba comprobaba la mitad del asunto —que el alta por sí sola no
   * reactiva— y se quedaba ahí. Nadie llamaba a `confirmSubscriber` después de
   * re-suscribirse, que es justo el paso siguiente del flujo y el que fallaba:
   *
   *   alta1        -> {token:T, active:false}
   *   confirmar(T) -> true
   *   baja         -> true
   *   alta2        -> {token:T, active:false}
   *   confirmar(T) -> false   <-- siempre
   *
   * La fila guardaba `confirmedAt` escrito, ningún camino lo borraba —`addSubscriber`
   * devolvía la fila sin escribir, `removeSubscriber` no lo tocaba— y el guard de
   * `confirmSubscriber` se negaba a entrar. El endpoint le decía a la persona
   * «te hemos reenviado el email de confirmación», pulsaba el enlace y aterrizaba
   * en `?newsletter=invalid-token`, que ninguna página lee. Suscriptor bloqueado
   * para siempre.
   */
  it("quien se da de baja y vuelve a suscribirse puede volver a confirmar", () => {
    const { addSubscriber, confirmSubscriber, removeSubscriber, getActiveSubscribers } = db();
    const { token } = addSubscriber("vuelve@ejemplo.test");
    confirmSubscriber(token);
    removeSubscriber(token);
    expect(getActiveSubscribers()).toEqual([]);

    const reAlta = addSubscriber("vuelve@ejemplo.test");
    expect(reAlta).toEqual({ token, exists: true, active: false });
    // El alta sola no basta: sigue en la lista de envío sin confirmar.
    expect(getActiveSubscribers()).toEqual([]);

    // Y aquí es donde se quedaba atascado.
    expect(confirmSubscriber(reAlta.token)).toBe(true);
    expect(getActiveSubscribers().map((s) => s.email)).toEqual(["vuelve@ejemplo.test"]);
  });

  it("el enlace que recibe la persona al re-suscribirse confirma de verdad", async () => {
    // Lo mismo, pero por el endpoint, que es por donde llega el enlace. Antes
    // esto devolvía `?newsletter=invalid-token` y, como ninguna página lee
    // `?newsletter=`, el fallo era invisible.
    const { addSubscriber, confirmSubscriber, removeSubscriber, getActiveSubscribers } = db();
    const { token } = addSubscriber("vuelve@ejemplo.test");
    confirmSubscriber(token);
    removeSubscriber(token);
    addSubscriber("vuelve@ejemplo.test");

    const res = await ruta()(pedir(`/api/newsletter/confirm?token=${token}`));

    expect(destinoDe(res)).toBe("/?newsletter=confirmed");
    expect(getActiveSubscribers()).toHaveLength(1);
  });

  it("reinscribirse no borra la fecha del primer alta", () => {
    // `subscribedAt` es cuándo se pidió el alta por primera vez. Sobrescribirlo
    // en cada re-alta perdería el histórico sin ganar nada: nadie lo lee, pero
    // cuando alguien empiece a leerlo, lo que encuentre tiene que ser cierto.
    const { addSubscriber, confirmSubscriber, removeSubscriber, getAllSubscribers } = db();
    const { token } = addSubscriber("vuelve@ejemplo.test");
    confirmSubscriber(token);
    const primera = getAllSubscribers()[0].subscribedAt;
    removeSubscriber(token);

    addSubscriber("vuelve@ejemplo.test");

    expect(getAllSubscribers()[0].subscribedAt).toBe(primera);
  });

  it("el enlace viejo no revive a quien NO vuelve a suscribirse", () => {
    // El guard de `confirmedAt` sigue teniendo un trabajo: sin una re-alta que
    // lo borre, un enlace de confirmación que quede en una bandeja antigua no
    // puede devolver a la lista a quien pidió salir. Es el caso para el que se
    // escribió, y el arreglo de arriba no lo toca.
    const { addSubscriber, confirmSubscriber, removeSubscriber, getActiveSubscribers } = db();
    const { token } = addSubscriber("se-vale@ejemplo.test");
    confirmSubscriber(token);
    removeSubscriber(token);

    expect(confirmSubscriber(token)).toBe(false);
    expect(getActiveSubscribers()).toEqual([]);
  });

  it("re-suscribirse dos veces sigue funcionando, y sin dejar filas sueltas", () => {
    const { addSubscriber, confirmSubscriber, removeSubscriber, getAllSubscribers, getActiveSubscribers } =
      db();
    for (let vuelta = 0; vuelta < 3; vuelta++) {
      const { token } = addSubscriber("varias@ejemplo.test");
      expect(confirmSubscriber(token)).toBe(true);
      expect(getActiveSubscribers().map((s) => s.email)).toEqual(["varias@ejemplo.test"]);
      removeSubscriber(token);
      expect(getActiveSubscribers()).toEqual([]);
    }
    expect(getAllSubscribers()).toHaveLength(1);
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

/**
 * Las filas escritas antes de que existiera `confirmedAt`.
 *
 * `confirmedAt` es opcional y `undefined` es falsy, así que el guard de
 * `confirmSubscriber` —`if (found.confirmedAt && !found.active)`— no se disparaba
 * con una fila antigua. Una suscripción que se había dado de baja antes de esta
 * fase volvía a la lista de envío con su enlace de confirmación, que puede
 * seguir en una bandeja de entrada.
 *
 * El informe de la fase pasada lo llamó tolerable «porque no quedan filas», y
 * eso era cierto del fichero del repo —que quedó vacío— pero no del de
 * producción: si Dokploy tiene volumen persistente, ahí siguen las filas de la
 * fase anterior al doble opt-in, escritas con el formato de entonces.
 */
describe("las filas que no tienen `confirmedAt`", () => {
  /** Escribe el fichero a mano, saltándose `addSubscriber`, como estaba antes. */
  function sembrarLegacy(filas: unknown[]) {
    writeFileSync(destino, JSON.stringify(filas, null, 2), "utf-8");
  }

  const ALTA_VIEJA = "2026-01-02T00:00:00.000Z";

  it("una fila dada de baja antes de la fase no revive con un enlace viejo", () => {
    sembrarLegacy([
      {
        email: "vieja@ejemplo.test",
        subscribedAt: ALTA_VIEJA,
        active: false,
        token: "tok-baja",
      },
    ]);

    // Antes de la migración: `true`, y la persona volvía a recibir la agenda
    // sin haberlo pedido. Reproducido contra el código real.
    expect(db().confirmSubscriber("tok-baja")).toBe(false);
    expect(db().getActiveSubscribers()).toEqual([]);
  });

  it("la migración les da `confirmedAt` = `subscribedAt`, que era lo que significaban", () => {
    // Con el alta automática de antes, subscriptarse ya era confirmar. Poner
    // `subscribedAt` es la única lectura fiel de lo que pasó, y es lo que hace
    // que el guard de `confirmSubscriber` pueda decidir.
    sembrarLegacy([
      { email: "baja@ejemplo.test", subscribedAt: ALTA_VIEJA, active: false, token: "tok-baja" },
      { email: "alta@ejemplo.test", subscribedAt: ALTA_VIEJA, active: true, token: "tok-alta" },
    ]);

    db().getAllSubscribers();

    const guardada = JSON.parse(readFileSync(destino, "utf-8")) as { confirmedAt: string }[];
    expect(guardada.map((f) => f.confirmedAt)).toEqual([ALTA_VIEJA, ALTA_VIEJA]);
  });

  it("migrar es idempotente: leerlo todo otra vez no vuelve a escribir", () => {
    sembrarLegacy([
      { email: "baja@ejemplo.test", subscribedAt: ALTA_VIEJA, active: false, token: "tok-baja" },
    ]);

    db().getAllSubscribers();
    const primera = readFileSync(destino, "utf-8");
    const mtimePrimera = statSync(destino).mtimeMs;

    db().getAllSubscribers();
    db().getAllSubscribers();

    // Si la migración escribiera en cada lectura, un despliegue con lista de
    // suscriptores escribiría el fichero en cada request que lo leyera.
    expect(readFileSync(destino, "utf-8")).toBe(primera);
    expect(statSync(destino).mtimeMs).toBe(mtimePrimera);
  });

  it("una fila antigua que sigue activa se puede confirmar, y de paso queda sellada", () => {
    // El caso normal: está activa, o sea que la migración le da `confirmedAt` y
    // el guard ya no la molesta. Confirmarla es idempotente, como siempre.
    sembrarLegacy([
      { email: "alta@ejemplo.test", subscribedAt: ALTA_VIEJA, active: true, token: "tok-alta" },
    ]);

    expect(db().confirmSubscriber("tok-alta")).toBe(true);
    expect(db().getActiveSubscribers().map((s) => s.email)).toEqual(["alta@ejemplo.test"]);

    const guardada = JSON.parse(readFileSync(destino, "utf-8")) as {
      confirmedAt: string;
      subscribedAt: string;
    }[];
    expect(guardada[0].confirmedAt).toBe(guardada[0].subscribedAt);
  });

  it("un fichero que es JSON válido pero no es una lista se niega a borrarse", () => {
    // Una escritura a medias puede dejar un `{}`, un `null` o un `42` en el
    // fichero. El `Array.isArray` ya no es opcional desde que la migración tiene
    // que recorrer el valor, pero la decisión cambió: antes esos contenidos se
    // leían como lista vacía, y como `addSubscriber` hace `push` + sobrescribir,
    // unaalta posterior **borraba el fichero entero** sin decir nada. Ahora lanzan,
    // porque leer `[]` es exactamente la indistinción que causaba la pérdida.
    for (const contenido of ["{}", "null", '"un texto"', "42"]) {
      writeFileSync(destino, contenido, "utf-8");
      const { getAllSubscribers, addSubscriber } = db();
      expect(captur(() => getAllSubscribers())).toContain("en vez de una lista");
      expect(captur(() => addSubscriber("nueva@ejemplo.test"))).toContain(
        "en vez de una lista"
      );
      // Y el fichero sigue con lo que tenía, que es lo que había que preservar.
      expect(readFileSync(destino, "utf-8")).toBe(contenido);
    }
  });

  it("las filas nuevas no se tocan: `confirmedAt: null` sigue siendo `null`", () => {
    // La migración solo rellena lo que falta. Si rellenara también los `null`,
    // una suscripción recién creada y pendiente de confirmar pasaría a estar
    // «ya confirmada» en el fichero, y el guard la rechazaría.
    const { addSubscriber, getAllSubscribers } = db();
    addSubscriber("nueva@ejemplo.test");

    getAllSubscribers();
    getAllSubscribers();

    const guardada = JSON.parse(readFileSync(destino, "utf-8")) as {
      confirmedAt: string | null;
    }[];
    expect(guardada[0].confirmedAt).toBeNull();
  });
});
