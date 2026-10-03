import {
  dbDePrueba,
  errorDePush,
  limpiarDbsDePrueba,
  reutilizarDbDePrueba,
  suscripcion,
} from "./helpers-push";

/**
 * `lib/scheduler.ts`: cuándo se manda el digest, en qué hora y si se da por
 * enviado.
 *
 * Son dos decisiones con la misma forma de fallo —«se marca como hecho algo que
 * no se ha hecho»— y las dos cuestan un día entero de avisos.
 *
 * **Marcarlo siempre.** `sendToAll` usa `Promise.allSettled`, así que nunca
 * propaga un fallo por suscripción: devuelve `{sent: 0, failed: N}`. Con eso,
 * `markDigestSent()` se llamaba igual y la marca quedaba en `meta`, o sea que ese
 * día ya no se reintentaba ni cuando la caída de FCM era de treinta segundos. Y no
 * solo con FCM caído: `/api/push/subscribe` es pública y acepta filas basura, así
 * que `total` puede ser mayor que el número de gente a la que de verdad le llegó
 * algo.
 *
 * **La hora del contenedor.** `now.getHours()` es la hora local del proceso. En un
 * contenedor Node sin `TZ` eso es UTC, así que `PUSH_DIGEST_HOUR=9` disparaba a
 * las 11:00 en horario de verano. El log de arranque lo decía —«Europe/Madrid del
 * servidor»— y justo eso es lo que no estaba garantizado: la zona la ponía quien
 * desplegaba, no el código.
 */

/*
 * La forma del módulo está escrita a mano y no sacada de `typeof import`, a
 * propósito: con `typeof import` este fichero no compila contra el código viejo —
 * `tick` no existe todavía— y un error de compilación es un fallo más pobre que
 * un rojo que dice qué se esperaba.
 */
type Modulo = {
  tick: () => Promise<void>;
  startScheduler: () => void;
};
type Push = typeof import("@/lib/push");

/** Las 09:00 de Madrid en pleno horario de verano (CEST, UTC+2). */
const HORA_9_MADRID_EN_VERANO = "2026-07-15T07:00:00Z";

/**
 * `web-push` falso, el digest falseado y el módulo del scheduler recién cargado.
 *
 * `mismaBase` vuelve a apuntar a la base que ya hay en vez de crear otra: es lo que
 * necesita el caso del reintento, donde lo que se mira es la marca del día y la
 * suscripción tiene que seguir ahí de un `import` al siguiente.
 *
 * `fallaCon` decide qué suscripción se rompe, que es lo que separa «falló todo» de
 * «falló la mitad» y por tanto «no marcar» de «marcar».
 */
async function schedulerLimpio({
  mismaBase = false,
  fallaCon = () => null,
}: { mismaBase?: boolean; fallaCon?: (endpoint: string) => Error | null } = {}): Promise<{
  tick: Modulo["tick"];
  push: Push;
  enviado: string[];
}> {
  if (mismaBase) reutilizarDbDePrueba();
  else dbDePrueba();
  jest.resetModules();

  const enviado: string[] = [];
  jest.doMock("web-push", () => ({
    __esModule: true,
    default: {
      setVapidDetails: jest.fn(),
      sendNotification: jest.fn(async (sub: unknown) => {
        const endpoint = (sub as { endpoint: string }).endpoint;
        const fallo = fallaCon(endpoint);
        if (fallo) throw fallo;
        enviado.push(endpoint);
      }),
    },
  }));
  // El digest real scrapearía la agenda entera contra la red, y lo que se prueba
  // aquí no es su contenido.
  jest.doMock("@/lib/digest", () => ({
    buildDailyDigest: jest.fn(async () => ({ title: "digest", body: "cuerpo", url: "/" })),
  }));

  process.env.VAPID_PUBLIC_KEY = "public-key-de-prueba";
  process.env.VAPID_PRIVATE_KEY = "private-key-de-prueba";

  const push = (await import("@/lib/push")) as Push;
  const mod = (await import("@/lib/scheduler")) as unknown as Modulo;
  return { tick: mod.tick, push, enviado };
}

/** Cierra el reloj en un instante concreto y silencia los logs del scheduler. */
function aLas(iso: string): void {
  jest.useFakeTimers();
  jest.setSystemTime(new Date(iso));
  jest.spyOn(console, "log").mockImplementation(() => {});
  jest.spyOn(console, "error").mockImplementation(() => {});
}

const SUBS = (n: number) =>
  Array.from({ length: n }, (_, i) => suscripcion(`https://push.example/${i + 1}`));

afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
  delete process.env.VAPID_PUBLIC_KEY;
  delete process.env.VAPID_PRIVATE_KEY;
  delete process.env.PUSH_DIGEST_HOUR;
});

afterAll(() => {
  limpiarDbsDePrueba();
});

describe("el digest solo se marca si ha salido", () => {
  it("cuando nadie recibió nada, el día sigue pendiente", async () => {
    // El bug. `sendToAll` no lanza: cuenta. Con todo caído devuelve
    // `{sent: 0, failed: N, total: N}` y `markDigestSent()` se llamaba igual, así
    // que ese día se acababa: nadie recibía el digest y no había segundo intento.
    aLas(HORA_9_MADRID_EN_VERANO);
    const { tick, push } = await schedulerLimpio({ fallaCon: () => errorDePush(500) });
    for (const sub of SUBS(2)) push.addSubscription(sub);

    await tick();

    expect(push.shouldSendDailyDigest()).toBe(true);
  });

  it("y el reintento del día sí manda, porque la marca no está puesta", async () => {
    // Lo que se gana con lo de arriba: el tick siguiente vuelve a intentarlo. Sin
    // esto, el arreglo solo cambiaría un mensaje de log.
    aLas(HORA_9_MADRID_EN_VERANO);
    const caida = await schedulerLimpio({ fallaCon: () => errorDePush(500) });
    for (const sub of SUBS(1)) caida.push.addSubscription(sub);
    await caida.tick();
    expect(caida.push.shouldSendDailyDigest()).toBe(true);

    // Ahora el push service vuelve. La base es la misma —`reutilizarDbDePrueba`
    // deja `PUSH_DB_DIR` donde estaba—, así que la suscripción sigue ahí y lo que
    // se mira es la marca, no la lista.
    const { tick, push, enviado } = await schedulerLimpio({ mismaBase: true });

    await tick();

    expect({ enviados: enviado.length, pendiente: push.shouldSendDailyDigest() }).toEqual({
      enviados: 1,
      pendiente: false,
    });
  });

  it("con uno de dos entregado, el día sí se marca", async () => {
    // Un fallo parcial no debe reenviar el digest entero: la mitad de la gente ya
    // lo tiene y mandárselo otra vez es el ruido que hace que la gente apague las
    // notificaciones. Un 500 tampoco se poda, así que la fila sigue para mañana.
    aLas(HORA_9_MADRID_EN_VERANO);
    const { tick, push, enviado } = await schedulerLimpio({
      fallaCon: (endpoint) => (endpoint.endsWith("/2") ? errorDePush(500) : null),
    });
    for (const sub of SUBS(2)) push.addSubscription(sub);

    await tick();

    expect({ enviados: enviado.length, marcadas: push.shouldSendDailyDigest() }).toEqual({
      enviados: 1,
      marcadas: false,
    });
  });

  it("sin ninguna suscripción se marca, porque no hay a quién reintentar", async () => {
    // Distingue «no salió» de «no había nadie a quien mandárselo». Reintentar cada
    // diez minutos contra una lista vacía son 144 digest builds al día, cada uno
    // con su scrape de la agenda, y no puede mejorar: no hay a quién avisar.
    aLas(HORA_9_MADRID_EN_VERANO);
    const { tick, push } = await schedulerLimpio();

    await tick();

    expect(push.shouldSendDailyDigest()).toBe(false);
  });

  it("y avisa por consola, que un fallo silencioso es lo que se vino a arreglar", async () => {
    aLas(HORA_9_MADRID_EN_VERANO);
    const error = jest.spyOn(console, "error").mockImplementation(() => {});
    const { tick, push } = await schedulerLimpio({ fallaCon: () => errorDePush(500) });
    for (const sub of SUBS(1)) push.addSubscription(sub);

    await tick();

    const texto = error.mock.calls.map((c) => c.map(String).join(" ")).join("\n");
    expect(texto).toMatch(/0\/1|ninguno|no se ha enviado/i);
  });
});

/**
 * La hora del digest se decide en la zona configurada, no en la del proceso.
 *
 * **Medido, y es lo que hace estos tests posibles:** dentro de un test, cambiar
 * `process.env.TZ` **no** cambia la zona del proceso. `jest-environment-node` le da
 * a cada fichero una copia de `process.env`, así que la asignación se queda ahí y
 * `Intl.DateTimeFormat().resolvedOptions().timeZone` sigue diciendo
 * `Europe/Madrid`. Al revés que en Node pelado, donde sí cambia. Por eso aquí no
 * se intenta «poner el runner en UTC»: no se puede.
 *
 * Lo que sí se puede —y es la propiedad que de verdad importa— es poner una zona
 * **distinta** en `TZ` y comprobar que la decisión sale de ahí y no de
 * `getHours()`. Con el runner en Madrid, un `getHours()` da siempre la hora de
 * Madrid, así que un caso con `TZ=Asia/Tokyo` es discriminante en los dos
 * sentidos: el código viejo no manda el digest y el nuevo sí.
 *
 * Es la versión robusta del bug. La frágil —«el contenedor va en UTC y el digest
 * salía a las once»— no se puede reproducir aquí, y no es que no se pueda ver:
 * `getHours()` lee el reloj del proceso, que el repo ya tiene fijado en
 * `jest.config.ts`, así que un `getHours()` colado pasaría verde. Por eso el test
 * estructural de `__tests__/huso-deploy.test.ts` exige que no haya ninguno.
 */
describe("la hora del digest", () => {
  async function enZona<T>(zona: string | undefined, fn: () => Promise<T>): Promise<T> {
    const previa = process.env.TZ;
    if (zona === undefined) delete process.env.TZ;
    else process.env.TZ = zona;
    try {
      return await fn();
    } finally {
      if (previa === undefined) delete process.env.TZ;
      else process.env.TZ = previa;
    }
  }

  /** Las 09:00 de Madrid en pleno horario de verano. */
  const NUEVE_EN_MADRID = "2026-07-15T07:00:00Z";
  /** Las 09:00 del día siguiente en Madrid, que en Tokio son las 02:00. */
  const NUEVE_EN_TOKIO = "2026-07-16T00:00:00Z";

  it("sin nada puesto la zona es Europe/Madrid", async () => {
    jest.useFakeTimers();
    jest.spyOn(console, "log").mockImplementation(() => {});

    await enZona(undefined, async () => {
      const { tick, push, enviado } = await schedulerLimpio();
      push.addSubscription(suscripcion("https://push.example/1"));
      jest.setSystemTime(new Date(NUEVE_EN_MADRID));
      delete process.env.PUSH_DIGEST_HOUR;

      await tick();

      expect(enviado).toHaveLength(1);
    });
  });

  it("a las 8 de Madrid todavía no", async () => {
    jest.useFakeTimers();
    jest.spyOn(console, "log").mockImplementation(() => {});

    await enZona(undefined, async () => {
      const { tick, push, enviado } = await schedulerLimpio();
      push.addSubscription(suscripcion("https://push.example/1"));
      // Las 06:00Z son las 08:00 en Madrid.
      jest.setSystemTime(new Date("2026-07-15T06:00:00Z"));
      process.env.PUSH_DIGEST_HOUR = "9";

      await tick();

      expect(enviado).toEqual([]);
    });
  });

  it("con TZ=UTC no sale a las 9 de Madrid aunque Madrid ya sea las 9", async () => {
    // El caso que el bug original describía, del revés. Las 07:00Z son las 09:00 en
    // Madrid y las 07:00 en UTC: si el digest sale, es porque alguien está leyendo
    // el reloj del proceso en vez de la zona de `TZ`. Es también lo que pasaba sin
    // `TZ` en el contenedor, con la zona del proceso en UTC.
    jest.useFakeTimers();
    jest.spyOn(console, "log").mockImplementation(() => {});

    await enZona("UTC", async () => {
      const { tick, push, enviado } = await schedulerLimpio();
      push.addSubscription(suscripcion("https://push.example/1"));
      jest.setSystemTime(new Date(NUEVE_EN_MADRID));
      process.env.PUSH_DIGEST_HOUR = "9";

      await tick();

      expect(enviado).toEqual([]);
    });
  });

  it("con TZ=UTC sale a las 9 de UTC", async () => {
    // La otra mitad del de arriba, para que el caso anterior no se lea como «el
    // digest no sale nunca».
    jest.useFakeTimers();
    jest.spyOn(console, "log").mockImplementation(() => {});

    await enZona("UTC", async () => {
      const { tick, push, enviado } = await schedulerLimpio();
      push.addSubscription(suscripcion("https://push.example/1"));
      jest.setSystemTime(new Date("2026-07-15T09:00:00Z"));
      process.env.PUSH_DIGEST_HOUR = "9";

      await tick();

      expect(enviado).toHaveLength(1);
    });
  });

  it("una zona explícita en el entorno gana a Europe/Madrid", async () => {
    // Si alguien despliega para un público en otro huso, lo pone en `TZ` y el digest
    // sale a su hora. Por eso la zona se lee del entorno en vez de estar escrita a
    // fuego: a las 09:00 de Tokio en Madrid todavía son las 02:00, y un
    // `getHours()` no saldría nunca.
    jest.useFakeTimers();
    jest.spyOn(console, "log").mockImplementation(() => {});

    await enZona("Asia/Tokyo", async () => {
      const { tick, push, enviado } = await schedulerLimpio();
      push.addSubscription(suscripcion("https://push.example/1"));
      jest.setSystemTime(new Date(NUEVE_EN_TOKIO));
      process.env.PUSH_DIGEST_HOUR = "9";

      await tick();

      expect(enviado).toHaveLength(1);
    });
  });

  it("el log de arranque dice la zona que se va a usar de verdad", async () => {
    // Antes decía «(Europe/Madrid del servidor)», que es una afirmación sobre el
    // despliegue y no sobre el código: era justo lo que no estaba garantizado. La
    // línea se contrasta con la zona que lee la función, no con una constante.
    jest.useFakeTimers();
    const log = jest.spyOn(console, "log").mockImplementation(() => {});

    await enZona("Asia/Tokyo", async () => {
      const mod = (await import("@/lib/scheduler")) as unknown as Modulo;
      mod.startScheduler();
      jest.clearAllTimers();

      const linea = log.mock.calls
        .map((c) => String(c[0]))
        .find((t) => t.includes("scheduler activo"));

      expect(linea).toMatch(/Asia\/Tokyo/);
      expect(linea).not.toMatch(/del servidor/);
    });
  });
});
