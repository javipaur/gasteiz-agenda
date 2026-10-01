/**
 * Lo que se prueba aquí es una decisión, no una integración: qué hace `sendMail`
 * cuando no hay SMTP.
 *
 * La regla es deliberada y fácil de deshacer por accidente: **en producción,
 * falta de credenciales es un error, no un mock**. Un mock devolvería `ok: true`,
 * el script de la newsletter lo sumaría como enviado, y nadie se enteraría de
 * que la semana entera no llegó a nadie. Fuera de producción el mock sí es lo
 * cómodo, porque en local no hay SMTP y bloquear el desarrollo sería un absurdo.
 *
 * Por eso el entorno se lee dentro de `sendMail` y no al importar el módulo: si
 * se leyera arriba, la primera llamada de un proceso fijaría el comportamiento
 * para siempre y este caso sería intestable sin apaños.
 */
describe("lib/mail", () => {
  const ORIGINAL_ENV = process.env.NODE_ENV;
  const ORIGINAL_USER = process.env.EMAIL_USER;
  const ORIGINAL_PASS = process.env.EMAIL_PASS;

  /**
   * `NODE_ENV` es de solo lectura en los tipos de `process.env`, y con razón a
   * medias: es lo que Next y Jest definen. Los tests necesitan cambiarlo para
   * poder mirar los dos lados de la regla del mock, así que se escribe con un
   * cast en vez de spreads que solo sirven para callar al compilador.
   */
  const entorno = process.env as Record<string, string | undefined>;
  const fijaEntorno = (clave: string, valor: string | undefined) => {
    if (valor === undefined) delete process.env[clave];
    else entorno[clave] = valor;
  };

  let enviado: Record<string, unknown>[] = [];

  beforeEach(() => {
    jest.resetModules();
    enviado = [];
    jest.doMock("nodemailer", () => ({
      __esModule: true,
      default: {
        createTransport: jest.fn(() => ({
          sendMail: jest.fn(async (args: Record<string, unknown>) => {
            enviado.push(args);
          }),
        })),
      },
    }));
  });

  afterEach(() => {
    fijaEntorno("NODE_ENV", ORIGINAL_ENV);
    fijaEntorno("EMAIL_USER", ORIGINAL_USER);
    fijaEntorno("EMAIL_PASS", ORIGINAL_PASS);
  });

  async function sinCredenciales(nodeEnv: string) {
    fijaEntorno("NODE_ENV", nodeEnv);
    delete process.env.EMAIL_USER;
    delete process.env.EMAIL_PASS;
    jest.resetModules();
    return import("@/lib/mail");
  }

  it("en producción, sin credenciales, falla en vez de fingir que ha enviado", async () => {
    const { sendMail } = await sinCredenciales("production");
    const consola = jest.spyOn(console, "error").mockImplementation(() => {});

    const resultado = await sendMail({ to: "a@b.c", subject: "Hola", html: "<p>hola</p>" });

    expect(resultado.ok).toBe(false);
    // El mensaje tiene que decir qué falta, que es lo que le sirve a quien
    // mira el log del despliegue a las tres de la mañana.
    expect((resultado as { error: string }).error).toMatch(/EMAIL_USER/);
    // Y con el destinatario, que si no en un newsletter de mil personas no se
    // sabe a cuál se intentaba enviar.
    expect(consola).toHaveBeenCalledWith(expect.stringContaining("a@b.c"));
  });

  it("en producción, con solo EMAIL_USER y sin PASS, también falla", async () => {
    fijaEntorno("NODE_ENV", "production");
    fijaEntorno("EMAIL_USER", "bot@example.com");
    delete process.env.EMAIL_PASS;
    jest.resetModules();
    jest.spyOn(console, "error").mockImplementation(() => {});
    const { sendMail } = await import("@/lib/mail");

    const resultado = await sendMail({ to: "a@b.c", subject: "s", html: "h" });

    expect(resultado.ok).toBe(false);
  });

  it("fuera de producción, sin credenciales, hace mock y lo dice", async () => {
    const { sendMail } = await sinCredenciales("development");
    jest.spyOn(console, "log").mockImplementation(() => {});

    const resultado = await sendMail({ to: "a@b.c", subject: "Hola", html: "<p>hola</p>" });

    // `mock: true` es la diferencia con un envío de verdad, y quien lo llama
    // puede distinguirlo sin leer logs.
    expect(resultado).toEqual({ ok: true, mock: true });
  });

  it("con credenciales, envía de verdad y sale sin `mock`", async () => {
    fijaEntorno("NODE_ENV", "production");
    fijaEntorno("EMAIL_USER", "bot@example.com");
    fijaEntorno("EMAIL_PASS", "secreto");
    jest.resetModules();
    const { sendMail } = await import("@/lib/mail");

    const resultado = await sendMail({
      to: "a@b.c",
      subject: "Hola",
      html: "<p>hola</p>",
      text: "hola",
    });

    expect(resultado).toEqual({ ok: true });
    expect(enviado).toHaveLength(1);
    expect(enviado[0]).toMatchObject({
      from: "Gasteiz Click <bot@example.com>",
      to: "a@b.c",
      subject: "Hola",
      html: "<p>hola</p>",
      text: "hola",
    });
  });

  it("un rechazo del SMTP sale como fallo, no como excepción", async () => {
    // Si `sendMail` tirara, el llamador del newsletter lo vería como una promesa
    // rechazada y el `try` del bucle lo contaría como un fallo más. Lo que
    // importa es que el resultado lo diga, para que el script salga con código 1.
    fijaEntorno("NODE_ENV", "production");
    fijaEntorno("EMAIL_USER", "bot@example.com");
    fijaEntorno("EMAIL_PASS", "secreto");
    jest.resetModules();
    jest.doMock("nodemailer", () => ({
      __esModule: true,
      default: {
        createTransport: () => ({
          sendMail: async () => {
            throw new Error("535 Authentication failed");
          },
        }),
      },
    }));
    jest.spyOn(console, "error").mockImplementation(() => {});
    const { sendMail } = await import("@/lib/mail");

    const resultado = await sendMail({ to: "a@b.c", subject: "s", html: "h" });

    expect(resultado).toEqual({ ok: false, error: "535 Authentication failed" });
  });

  it("cada llamada vuelve a mirar el entorno, no la primera de todas", async () => {
    // El fallo que se está vigilando: con el entorno leído al importar, este caso
    // sería imposible y el mock de desarrollo se filtraría a producción.
    const { sendMail } = await sinCredenciales("development");
    jest.spyOn(console, "log").mockImplementation(() => {});
    jest.spyOn(console, "error").mockImplementation(() => {});

    expect(await sendMail({ to: "a@b.c", subject: "s", html: "h" })).toEqual({
      ok: true,
      mock: true,
    });

    fijaEntorno("NODE_ENV", "production");
    const resultado = await sendMail({ to: "a@b.c", subject: "s", html: "h" });

    expect(resultado.ok).toBe(false);
  });
});
