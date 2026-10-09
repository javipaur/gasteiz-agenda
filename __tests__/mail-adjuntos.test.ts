/**
 * `sendMail` learndo a llevar adjuntos.
 *
 * Nodemailer los soporta y el tipo no los declaraba, así que no había forma de mandarlos
 * sin salirse de la función. **Es el único cambio en código compartido de todo el plan**,
 * y por eso tiene su propio test: lo que se rompe aquí se rompe en el newsletter también.
 */
const sendMailNodemailer = jest.fn().mockResolvedValue({ messageId: "x" });

jest.mock("nodemailer", () => ({
  __esModule: true,
  default: {
    createTransport: () => ({ sendMail: (...a: unknown[]) => sendMailNodemailer(...a) }),
  },
}));

/**
 * Aplica un entorno temporal y lo restaura.
 *
 * **Borra las claves cuyo valor es `undefined`, y no las asigna.** `Object.assign(process.env,
 * { EMAIL_USER: undefined })` deja la variable como la cadena `"undefined"`, que es
 * truthy: el transporte se construiría con una contraseña falsa y el envío "tendría
 * éxito". Es la clase de fallo que hace que un test de seguridad parezca verde.
 */
function conEntorno<T>(cambios: Record<string, string | undefined>, hacer: () => T): T {
  const previo = { ...process.env };
  for (const [k, v] of Object.entries(cambios)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
  try {
    return hacer();
  } finally {
    for (const k of Object.keys(process.env)) delete process.env[k];
    Object.assign(process.env, previo);
  }
}

describe("sendMail con adjuntos", () => {
  beforeEach(() => {
    sendMailNodemailer.mockClear();
    // El transporte se cachea en el módulo y la caché no se invalida entre pruebas: sin
    // estas dos variables, la primera que corre decidiría para todas. Es la razón por
    // la que `lib/mail.ts` lee el entorno en la llamada y no en el import.
    process.env.EMAIL_USER = "cuenta@ejemplo.test";
    process.env.EMAIL_PASS = "clave";
  });

  afterEach(() => {
    delete process.env.EMAIL_USER;
    delete process.env.EMAIL_PASS;
  });

  it("reenvía los adjuntos a nodemailer sin tocarlos", async () => {
    const { sendMail } = await import("@/lib/mail");
    const content = Buffer.from("png falso");

    const res = await sendMail({
      to: "yo@ejemplo.test",
      subject: "Finde",
      html: "<p>hola</p>",
      attachments: [
        { filename: "01-portada.png", content, contentDisposition: "inline", cid: "promo-01" },
        { filename: "01-portada.png", content, contentDisposition: "attachment" },
      ],
    });

    expect(res.ok).toBe(true);
    expect(sendMailNodemailer).toHaveBeenCalledTimes(1);
    const enviado = sendMailNodemailer.mock.calls[0][0] as {
      attachments: Array<Record<string, unknown>>;
    };
    expect(enviado.attachments).toHaveLength(2);
    expect(enviado.attachments[0]).toEqual({
      filename: "01-portada.png",
      content,
      contentDisposition: "inline",
      cid: "promo-01",
    });
  });

  it("sin adjuntos, el envío es exactamente el de antes", async () => {
    // Si esto cambia, se ha roto el newsletter en silencio: sigue funcionando y ya no
    // lleva nada raro, que es peor.
    const { sendMail } = await import("@/lib/mail");

    await sendMail({ to: "yo@ejemplo.test", subject: "Finde", html: "<p>hola</p>" });

    const enviado = sendMailNodemailer.mock.calls[0][0] as Record<string, unknown>;
    expect(enviado.attachments).toBeUndefined();
  });

  it("sigue fallando explícito en producción sin credenciales, con adjuntos o sin ellos", async () => {
    // La regla no cambia por añadir un campo: un mock devolvería `ok: true` y el cron
    // daría el paquete por enviado sin que nadie lo recibiera.
    const { sendMail } = await import("@/lib/mail");

    const res = await conEntorno(
      { EMAIL_USER: undefined, EMAIL_PASS: undefined, NODE_ENV: "production" },
      () =>
        sendMail({
          to: "yo@ejemplo.test",
          subject: "Finde",
          html: "<p>hola</p>",
          attachments: [
            { filename: "01.png", content: Buffer.from("x"), contentDisposition: "attachment" },
          ],
        })
    );

    expect(res.ok).toBe(false);
  });
});