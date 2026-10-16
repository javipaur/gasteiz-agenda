import {
  dbDePrueba,
  errorDePush,
  limpiarDbsDePrueba,
  reutilizarDbDePrueba,
  suscripcion,
} from "./helpers-push";
import type { SchedulerOpciones } from "@/lib/scheduler";
import {
  dbDePrueba as metricasDePrueba,
  limpiarDbsDePrueba as limpiarMetricas,
} from "./helpers-metricas";

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
  tick: (opciones?: SchedulerOpciones) => Promise<void>;
  /*
   * La firma **de verdad** y no la de antes de las banderas. Este `as unknown as`
   * es lo que hace peligroso mantenerla a mano: un tipo declarado aquí que ya no
   * coincide con el módulo compila igual, y el fallo sale cuando alguien llama con
   * un argumento que el código no espera. Es el mismo motif que el alias de
   * `anotarEvento` en `doctor.ts`, del revés.
   */
  startScheduler: (opciones?: SchedulerOpciones) => void;
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

  /*
   * Y una base de métricas aparte, que antes no había.
   *
   * `dbDePrueba()` de `helpers-push` solo aísla `PUSH_DB_DIR`. Como `tick()` se
   * llama sin argumentos en casi todos los casos, `opciones.metricas` sale del
   * default —`true`— y `podarSiToca()` escribía su marca `poda_hecha_el` en
   * **`.data/metricas.db`, la de verdad**. Comprobado: el fichero tenía
   * `2026-07-16`, tres meses de fecha, puesta por el reloj falso de `aLas()`.
   *
   * No es cosmético. Esa marca es la que hace que la poda no se repita 144 veces
   * al día, así que un test suite que la escribe puede dejar **sin podar un día
   * entero** de la base real. Y lo hace sin un solo error: es exactamente el modo
   * de fallo que este repo lleva corrigiendo desde el principio —el que no da
   * error, da silencio—.
   *
   * O sea: un test que desactiva una salvaguarda de producción. Por eso va aquí y
   * no en un fichero aparte: el que llama a `tick()` tiene que ver el aislamiento.
   */
  metricasDePrueba();

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
  limpiarMetricas();
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
describe("las dos puertas del scheduler", () => {
  /*
   * Esta pareja es la que fija el arreglo, y se apoya en una propiedad del store
   * que hace la prueba barata: `podarSiToca()` devuelve `null` cuando el día ya
   * está marcado, así que preguntar por `null` después de un `tick()` es preguntar
   * "¿ha pasado por la poda?". No hace falta ni espiar ni mocker nada, y lo que se
   * mira es el efecto y no una llamada.
   *
   * El test anterior a este solo miraba el texto del log, y ese texto se arma en
   * `startScheduler` desde `opciones` **antes** de que `tick` mire ninguna bandera.
   * Poniendo `if (opciones.metricas && opciones.push)` —que es literalmente el bug
   * que se arregló, la poda colgando del push— todo seguía verde.
   */
  const HOY = "2026-07-16T09:00:00Z";

  it("la poda corre aunque el push esté apagado", async () => {
    aLas(HOY);
    const { tick } = await schedulerLimpio();

    await tick({ push: false, metricas: true });

    // Misma base, mismo reloj: si `tick` no hubiera podado, esto devolvería un
    // número y habría marcado el día por su cuenta.
    const store = await import("@/lib/metricas-store");
    expect(store.podarSiToca(400)).toBeNull();
  });

  it("con las métricas apagadas no se poda, y no se marca el día", async () => {
    aLas(HOY);
    const { tick } = await schedulerLimpio();

    await tick({ push: false, metricas: false });

    // Y el espejo del anterior: un `0` significa que nadie había marcado el día, o
    // sea que `tick` no pasó por la poda. Si el `if` se comiera la marca, esto
    // daría `null` y el fallo sería invisible.
    const store = await import("@/lib/metricas-store");
    expect(store.podarSiToca(400)).toBe(0);
  });

  it("la poda corre con las dos puertas abiertas", async () => {
    aLas(HOY);
    const { tick } = await schedulerLimpio();

    await tick({ push: true, metricas: true });

    const store = await import("@/lib/metricas-store");
    expect(store.podarSiToca(400)).toBeNull();
  });
});

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
        .find((t) => t.includes("[scheduler] activo"));

      expect(linea).toMatch(/Asia\/Tokyo/);
      expect(linea).not.toMatch(/del servidor/);
    });
  });

  it("el log de arranque dice qué partes han quedado encendidas", async () => {
    /*
     * La razón por la que el mensaje se reescribió para llevar las dos partes.
     *
     * Con el texto viejo, un despliegue con `ENABLE_PUSH_SCHEDULER` apagado y la
     * poda de métricas activa imprimía una línea que hablaba solo del digest, y
     * quien la leyera concluiría que no había nada corriendo. El número de la línea
     * es el primer log que se mira cuando algo no cuadra, así que tiene que
     * describir lo que hace, no lo que hizo la última vez que se escribió.
     */
    jest.useFakeTimers();
    const log = jest.spyOn(console, "log").mockImplementation(() => {});

    await enZona("Europe/Madrid", async () => {
      const mod = (await import("@/lib/scheduler")) as unknown as Modulo;
      mod.startScheduler({ push: false, metricas: true });
      jest.clearAllTimers();
    });

    const linea = log.mock.calls
      .map((c) => String(c[0]))
      .find((t) => t.includes("[scheduler] activo"));

    // Sin push, la línea **no** puede prometer un digest, y tiene que decir que la
    // poda está: ese par es el que hace imposible leer "no hay nada corriendo".
    expect(linea).toMatch(/sin digest/);
    expect(linea).toMatch(/poda de métricas/);
  });
});
