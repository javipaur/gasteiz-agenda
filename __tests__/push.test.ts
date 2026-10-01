import {
  dbDePrueba,
  errorDePush,
  limpiarDbsDePrueba,
  reutilizarDbDePrueba,
  suscripcion,
} from "./helpers-push";

/**
 * Lo que hay aquí protege algo que no se puede recuperar: una suscripción a push
 * es el único vínculo entre una persona y este sitio. Si `sendToAll` poda una
 * que sigue viva, esa persona deja de recibir avisos y no hay forma de saber por
 * qué. Y si no poda una que ya no existe, la lista crece sola y cada envío se
 * retrasa por entradas muertas.
 *
 * `web-push` va mockeado entero; lo que se prueba es la decisión de qué hacer con
 * lo que devuelve, que es la parte con criterio.
 */
async function pushLimpio({ mismaBase = false }: { mismaBase?: boolean } = {}) {
  if (mismaBase) reutilizarDbDePrueba();
  else dbDePrueba();
  jest.resetModules();

  const enviado: { subscription: unknown; payload: string }[] = [];
  let fallo: (sub: unknown) => Error | null = () => null;

  jest.doMock("web-push", () => ({
    __esModule: true,
    default: {
      setVapidDetails: jest.fn(),
      sendNotification: jest.fn(async (sub: unknown, payload: string) => {
        if (fallo(sub)) throw fallo(sub);
        enviado.push({ subscription: sub, payload });
      }),
    },
  }));

  process.env.VAPID_PUBLIC_KEY = "public-key-de-prueba";
  process.env.VAPID_PRIVATE_KEY = "private-key-de-prueba";

  const modulo = await import("@/lib/push");
  return { ...modulo, enviado, fallarCon: (fn: (s: unknown) => Error | null) => (fallo = fn) };
}

describe("lib/push", () => {
  beforeEach(() => {
    jest.doMock("web-push", () => ({ __esModule: true, default: {} }));
  });

  afterEach(() => {
    delete process.env.VAPID_PUBLIC_KEY;
    delete process.env.VAPID_PRIVATE_KEY;
  });

  afterAll(() => {
    limpiarDbsDePrueba();
  });

  describe("suscripciones", () => {
    it("guarda y devuelve lo que se le pasa", async () => {
      const { addSubscription, listSubscriptions } = await pushLimpio();
      addSubscription(suscripcion("https://push.example/a"));

      expect(listSubscriptions()).toEqual([suscripcion("https://push.example/a")]);
    });

    it("volver a suscribir la misma ruta actualiza las claves y no duplica", async () => {
      // El alta repetida pasa por `ON CONFLICT DO UPDATE`, que es lo que evita
      // que la lista se llene de filas que apuntan al mismo endpoint.
      const { addSubscription, listSubscriptions } = await pushLimpio();
      addSubscription(suscripcion("https://push.example/a"));
      addSubscription({
        endpoint: "https://push.example/a",
        keys: { p256dh: "nuevo", auth: "nuevo-auth" },
        addedAt: 1_800_000_000_000,
      });

      const lista = listSubscriptions();
      expect(lista).toHaveLength(1);
      expect(lista[0].keys).toEqual({ p256dh: "nuevo", auth: "nuevo-auth" });
    });

    it("dar de baja quita la fila", async () => {
      const { addSubscription, removeSubscription, listSubscriptions } =
        await pushLimpio();
      addSubscription(suscripcion("https://push.example/a"));
      removeSubscription("https://push.example/a");

      expect(listSubscriptions()).toEqual([]);
    });
  });

  describe("sendToAll", () => {
    it("envía a todos y cuenta los envíos", async () => {
      const { addSubscription, sendToAll, enviado } = await pushLimpio();
      addSubscription(suscripcion("https://push.example/a"));
      addSubscription(suscripcion("https://push.example/b"));

      const resultado = await sendToAll({ title: "Hoy", body: "Hay cosas" });

      expect(resultado).toEqual({ sent: 2, failed: 0, pruned: 0, total: 2 });
      expect(enviado).toHaveLength(2);
      expect(JSON.parse(enviado[0].payload)).toEqual({ title: "Hoy", body: "Hay cosas" });
    });

    it("poda la suscripción que el push service da por muerta (404 y 410)", async () => {
      // 404 y 410 son las dos respuestas que significan "este endpoint ya no
      // existe". Quitarlas es lo que impide que la lista crezca sola.
      for (const statusCode of [404, 410]) {
        const { addSubscription, sendToAll, listSubscriptions, fallarCon } =
          await pushLimpio();
        addSubscription(suscripcion("https://push.example/viva"));
        addSubscription(suscripcion(`https://push.example/muerta-${statusCode}`));
        fallarCon((s) =>
          (s as { endpoint: string }).endpoint.includes("muerta")
            ? errorDePush(statusCode)
            : null
        );

        const resultado = await sendToAll({ title: "t", body: "b" });

        expect(resultado).toEqual({
          sent: 1,
          failed: 1,
          pruned: 1,
          total: 2,
        });
        expect(listSubscriptions().map((s) => s.endpoint)).toEqual([
          "https://push.example/viva",
        ]);
      }
    });

    it("NO poda un fallo que no sea 404 ni 410", async () => {
      // Aquí está el riesgo real: un 500 de Gmail... de un push service es un
      // fallo transitorio, y borrar la suscripción de esa persona porque el
      // servidor tuvo un mal día la deja sin avisos para siempre.
      const { addSubscription, sendToAll, listSubscriptions, fallarCon } =
        await pushLimpio();
      addSubscription(suscripcion("https://push.example/transitoria"));
      fallarCon(() => errorDePush(500));

      const resultado = await sendToAll({ title: "t", body: "b" });

      expect(resultado).toEqual({ sent: 0, failed: 1, pruned: 0, total: 1 });
      expect(listSubscriptions()).toHaveLength(1);
    });

    it("NO poda un fallo sin statusCode, que es lo que lanza un error de red", async () => {
      // `web-push` lanza un `TypeError` de red sin `statusCode` cuando no hay
      // conexión. Tratarlo como muerte sería vaciar la lista entera en un túnel.
      const { addSubscription, sendToAll, listSubscriptions, fallarCon } =
        await pushLimpio();
      addSubscription(suscripcion("https://push.example/sin-red"));
      fallarCon(() => errorDePush());

      const resultado = await sendToAll({ title: "t", body: "b" });

      expect(resultado.pruned).toBe(0);
      expect(listSubscriptions()).toHaveLength(1);
    });

    it("un fallo en una suscripción no impide enviar a las demás", async () => {
      const { addSubscription, sendToAll, enviado, fallarCon } = await pushLimpio();
      addSubscription(suscripcion("https://push.example/mala"));
      addSubscription(suscripcion("https://push.example/buena"));
      fallarCon((s) =>
        (s as { endpoint: string }).endpoint.includes("mala")
          ? errorDePush(500)
          : null
      );

      const resultado = await sendToAll({ title: "t", body: "b" });

      expect(resultado.sent).toBe(1);
      expect(enviado).toHaveLength(1);
    });

    it("sin suscripciones no llama al push service y no falla", async () => {
      const { sendToAll, enviado } = await pushLimpio();

      const resultado = await sendToAll({ title: "t", body: "b" });

      expect(resultado).toEqual({ sent: 0, failed: 0, pruned: 0, total: 0 });
      expect(enviado).toEqual([]);
    });

    it("falla claro si faltan las claves VAPID, en vez de enviar en silencio", async () => {
      delete process.env.VAPID_PUBLIC_KEY;
      delete process.env.VAPID_PRIVATE_KEY;
      const { sendToAll } = await pushLimpio();
      delete process.env.VAPID_PUBLIC_KEY;
      delete process.env.VAPID_PRIVATE_KEY;

      await expect(sendToAll({ title: "t", body: "b" })).rejects.toThrow(
        /VAPID_PUBLIC_KEY/
      );
    });
  });

  describe("digest diario", () => {
    it("solo se marca una vez al día, y la marca sobrevive a una recarga", async () => {
      // El `meta` está en la base, no en memoria, así que un reinicio del proceso
      // no puede reenviar el digest del mismo día a todo el mundo.
      const primera = await pushLimpio();
      expect(primera.shouldSendDailyDigest()).toBe(true);
      primera.markDigestSent();
      expect(primera.shouldSendDailyDigest()).toBe(false);

      const segunda = await pushLimpio({ mismaBase: true });
      expect(segunda.shouldSendDailyDigest()).toBe(false);
    });
  });
});