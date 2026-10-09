import nodemailer from "nodemailer";
import type { Transporter } from "nodemailer";

let cached: Transporter | null = null;

/**
 * El transporte se cachea, pero **no** la decisión de si hay credenciales.
 *
 * Se leía `EMAIL_USER`/`EMAIL_PASS` en el import y se resolvía una sola vez con
 * `cachedResolved`, así que la primera llamada de un proceso decidía para
 * siempre: probar el camino de "en producción no hay credenciales" exigía
 * reiniciar el módulo y tocar el entorno entre casos. Leyendo el entorno dentro de
 * la función, el mismo caso se prueba sin apaños, y el transporte —que sí es
 * caro de construir— se sigue reusando.
 */
function getTransporter(): Transporter | null {
  const user = process.env.EMAIL_USER;
  const pass = process.env.EMAIL_PASS;
  if (!user || !pass) return null;
  if (cached) return cached;
  cached = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 465,
    secure: true,
    auth: {
      user,
      pass,
    },
  });
  return cached;
}

/**
 * Un adjunto del correo.
 *
 * **Los mismos campos que nodemailer, sin transformar.** Las imágenes del paquete
 * viajan dos veces —una `inline` con `cid` y otra `attachment`— porque no hay un
 * camino único entre clientes de correo: el que funciona en Gmail no es el que
 * funciona en el cliente por defecto de iOS. Duplicarlas son 1–3 MB, y el límite de
 * Gmail son 25 MB.
 */
export type Adjunto = {
  filename: string;
  content: Buffer;
  contentDisposition: "inline" | "attachment";
  /** Solo para `inline`: el `src="cid:..."` del HTML apunta aquí. */
  cid?: string;
};

export type SendMailOptions = {
  to: string;
  subject: string;
  html: string;
  text?: string;
  attachments?: Adjunto[];
};

export type SendMailResult =
  | { ok: true; mock?: boolean }
  | { ok: false; error: string };

/**
 * `NODE_ENV` se lee en la llamada y no al cargar el módulo, por el mismo motivo
 * que las credenciales: leerlo arriba fijaba la respuesta del mock para siempre
 * y hacía el camino de producción intestable.
 */
export async function sendMail({
  to,
  subject,
  html,
  text,
  attachments,
}: SendMailOptions): Promise<SendMailResult> {
  const user = process.env.EMAIL_USER;
  const transporter = getTransporter();

  if (!transporter || !user) {
    // En produccion el mock seria un fallo silencioso: el newsletter parece
    // enviado y no llega a nadie. Fuera de produccion es comodo para desarrollo.
    if (process.env.NODE_ENV === "production") {
      const error =
        "Faltan EMAIL_USER/EMAIL_PASS: no se puede enviar correo en produccion";
      console.error(`[mail] ${error} (destinatario: ${to})`);
      return { ok: false, error };
    }

    console.log("[mail] Sin credenciales EMAIL_USER/EMAIL_PASS. Mock de envío a", to);
    console.log("[mail] Subject:", subject);
    return { ok: true, mock: true };
  }

  try {
    await transporter.sendMail({
      from: `Gasteiz Click <${user}>`,
      to,
      subject,
      html,
      text: text || undefined,
      // Se pasa tal cual, o el `cid` de la imagen en línea no llega al HTML y el
      // correo sale con los huecos donde iban las fotos.
      attachments: attachments || undefined,
    });
    return { ok: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[mail] Failed to send:", message);
    return { ok: false, error: message };
  }
}