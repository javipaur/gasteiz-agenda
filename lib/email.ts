import { sendMail } from "./mail";

/**
 * La URL base del sitio, y por qué falla en vez de adivinar.
 *
 * Antes era `process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"` leída
 * **en el import**, que son dos fallos distintos:
 *
 * - El valor de reserva es `localhost`. La variable no está en `.env`, ni en
 *   `.env.local`, ni en ningún `.env.example` —este repo no tenía ninguno— y
 *   `README.md:43` la lista como requerida. Si Dokploy no la tiene, los enlaces de
 *   confirmación y de baja del newsletter apuntan a `localhost:3000`: el alta
 *   responde `200`, el correo sale, y el enlace no lleva a ninguna parte. La doble
 *   opt-in se cumple y no se puede completar nunca, en silencio, y no hay forma de
 *   enterarse salvo por un suscriptor quejándose semanas después.
 * - Leerla en el import la fijaba para todo el proceso. Es el mismo defecto que
 *   ya se corrigió en `lib/mail.ts` con las credenciales de SMTP.
 *
 * En producción, que la URL sea válida no es una garantía: es un requisito. Si
 * falta, el enlace que sale mal no lo detecta quien lo manda —que es un cron— sino
 * quien lo pulsa. Así que aquí se lanza, con el nombre de la variable, en vez de
 * enviar un correo con un enlace que no lleva a ningún sitio.
 */
function siteUrl(): string {
  const configurada = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (configurada) return configurada.replace(/\/+$/, "");

  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "Falta NEXT_PUBLIC_SITE_URL: los enlaces de confirmación y de baja del " +
        "newsletter se construirían contra localhost y no llevarían a ninguna parte. " +
        "La doble confirmación no se podría completar y no habría forma de notarlo."
    );
  }

  return "http://localhost:3000";
}

/**
 * Escapa para interpolar en HTML.
 *
 * Hace falta porque aqui el HTML se construye a mano, y eso quita la
 * proteccion que en el resto del proyecto da React por defecto. Los textos
 * vienen de las 28 fuentes que se raspan: `raw.title` solo pasa por `.trim()` en
 * `normalizeRaw`, asi que un titulo con `"><img src=x onerror=...>` llegaba tal
 * cual al buzon de todos los suscriptores. Con cliente que ejecuta JS era XSS
 * contra el suscriptor; sin el, inyeccion de enlace e imagen para phishing.
 *
 * `'` tambien se escapa aunque los atributos del repo usen comillas dobles:
 * un valor con `&#39;` no rompe nada y asi el helper sirve para los dos casos.
 */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Una URL que se pone en un `href` o un `src` sin permitir esquemas ejecutables.
 *
 * Escapar el HTML no basta para `href`: `javascript:alert(1)` no lleva ningun
 * caracter que `escapeHtml` toque, y asi que un `link` con ese esquema llegaria
 * como un enlace vivo dentro del correo. `normalizeRaw` solo exige que la
 * *imagen* empiece por `http`; el `link` no tiene ninguna comprobacion.
 */
function safeUrl(value: string | undefined, fallback = "#"): string {
  if (!value) return fallback;
  const trimmed = value.trim();
  if (/^(https?:|mailto:)/i.test(trimmed)) return escapeHtml(trimmed);
  return fallback;
}

type Evento = {
  title: string;
  date: string;
  image?: string;
  location?: string;
  link?: string;
};

function formatDate(d: string) {
  return new Date(d).toLocaleDateString("es-ES", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function buildWeeklyHtml(eventos: Evento[], unsubscribeUrl: string): string {
  const items = eventos
    .slice(0, 15)
    .map(
      (e) => `
    <tr>
      <td style="padding:12px 0;border-bottom:1px solid #e8e0d4;">
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td width="80" valign="top" style="padding-right:12px;">
              ${
                e.image
                  ? `<img src="${safeUrl(e.image, "")}" alt="${escapeHtml(e.title)}" width="80" height="60" style="border-radius:8px;object-fit:cover;width:80px;height:60px;" />`
                  : `<div style="width:80px;height:60px;background:#c8ddd2;border-radius:8px;display:flex;align-items:center;justify-content:center;color:#2d4a3e;font-weight:bold;font-size:20px;">${escapeHtml(e.title.charAt(0))}</div>`
              }
            </td>
            <td valign="top">
              <a href="${safeUrl(e.link)}" target="_blank" rel="noopener noreferrer" style="color:#1b3326;text-decoration:none;font-weight:600;font-size:14px;line-height:1.3;">${escapeHtml(e.title)}</a>
              <p style="margin:4px 0 0;font-size:12px;color:#5a5a5a;">
                ${formatDate(e.date)} ${e.location ? `· ${escapeHtml(e.location)}` : ""}
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>`
    )
    .join("");

  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"/></head>
<body style="margin:0;padding:0;background:#f5f0e8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0">
    <tr>
      <td align="center" style="padding:40px 16px;">
        <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;">
          <tr>
            <td style="background:#2d4a3e;padding:32px;text-align:center;">
              <h1 style="color:#ffffff;margin:0;font-size:24px;font-weight:700;">Agenda Gasteiz</h1>
              <p style="color:#c8ddd2;margin:8px 0 0;font-size:14px;">Eventos de la semana en Vitoria-Gasteiz</p>
            </td>
          </tr>
          <tr>
            <td style="padding:24px 32px;">
              <table width="100%" cellpadding="0" cellspacing="0">
                ${items}
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:16px 32px 32px;text-align:center;">
              <a href="${safeUrl(siteUrl())}" style="display:inline-block;background:#c44c3c;color:#ffffff;text-decoration:none;padding:12px 32px;border-radius:12px;font-weight:600;font-size:14px;">Ver más eventos</a>
            </td>
          </tr>
          <tr>
            <td style="padding:16px 32px;text-align:center;border-top:1px solid #e8e0d4;">
              <p style="margin:0;font-size:11px;color:#9a9a9a;">
                Si no quieres recibir más emails,
                <a href="${safeUrl(unsubscribeUrl)}" style="color:#c44c3c;text-decoration:underline;">darse de baja</a>.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export async function sendEmail(to: string, subject: string, html: string) {
  return sendMail({ to, subject, html });
}

export async function sendWeeklyNewsletter(
  eventos: Evento[],
  to: string,
  unsubscribeToken: string
) {
  const unsubscribeUrl = `${siteUrl()}/api/newsletter/unsubscribe?token=${unsubscribeToken}`;
  const html = buildWeeklyHtml(eventos, unsubscribeUrl);
  return sendEmail(
    to,
    "Tu agenda semanal en Vitoria-Gasteiz",
    html
  );
}

export async function sendConfirmationEmail(to: string, token: string) {
  const subscribeUrl = `${siteUrl()}/api/newsletter/confirm?token=${token}`;
  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"/></head>
<body style="margin:0;padding:0;background:#f5f0e8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0">
    <tr>
      <td align="center" style="padding:40px 16px;">
        <table width="480" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;">
          <tr>
            <td style="background:#2d4a3e;padding:32px;text-align:center;">
              <h1 style="color:#ffffff;margin:0;font-size:20px;">¡Casi listo!</h1>
            </td>
          </tr>
          <tr>
            <td style="padding:32px;text-align:center;">
              <p style="margin:0 0 16px;color:#1a1a1a;font-size:14px;line-height:1.5;">
                Confirma tu suscripción para recibir cada semana los eventos de Vitoria-Gasteiz.
              </p>
              <a href="${safeUrl(subscribeUrl)}" style="display:inline-block;background:#c44c3c;color:#ffffff;text-decoration:none;padding:12px 32px;border-radius:12px;font-weight:600;font-size:14px;">Confirmar suscripción</a>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
  return sendEmail(to, "Confirma tu suscripción · Agenda Gasteiz", html);
}
