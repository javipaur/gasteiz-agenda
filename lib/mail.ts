import nodemailer from "nodemailer";
import type { Transporter } from "nodemailer";

const EMAIL_USER = process.env.EMAIL_USER;
const EMAIL_PASS = process.env.EMAIL_PASS;

let cached: Transporter | null = null;
let cachedResolved = false;

function getTransporter(): Transporter | null {
  if (cachedResolved) return cached;
  cachedResolved = true;
  if (!EMAIL_USER || !EMAIL_PASS) return null;
  cached = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 465,
    secure: true,
    auth: {
      user: EMAIL_USER,
      pass: EMAIL_PASS,
    },
  });
  return cached;
}

export type SendMailOptions = {
  to: string;
  subject: string;
  html: string;
  text?: string;
};

export type SendMailResult =
  | { ok: true; mock?: boolean }
  | { ok: false; error: string };

const IS_PRODUCTION = process.env.NODE_ENV === "production";

export async function sendMail({
  to,
  subject,
  html,
  text,
}: SendMailOptions): Promise<SendMailResult> {
  const transporter = getTransporter();

  if (!transporter || !EMAIL_USER) {
    // En produccion el mock seria un fallo silencioso: el newsletter parece
    // enviado y no llega a nadie. Fuera de produccion es comodo para desarrollo.
    if (IS_PRODUCTION) {
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
      from: `Gasteiz Click <${EMAIL_USER}>`,
      to,
      subject,
      html,
      text: text || undefined,
    });
    return { ok: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[mail] Failed to send:", message);
    return { ok: false, error: message };
  }
}