const RESEND_API_KEY = process.env.RESEND_API_KEY;
const FROM_EMAIL = process.env.FROM_EMAIL || "newsletter@gasteizagenda.com";
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

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
                  ? `<img src="${e.image}" alt="${e.title}" width="80" height="60" style="border-radius:8px;object-fit:cover;width:80px;height:60px;" />`
                  : `<div style="width:80px;height:60px;background:#c8ddd2;border-radius:8px;display:flex;align-items:center;justify-content:center;color:#2d4a3e;font-weight:bold;font-size:20px;">${e.title.charAt(0)}</div>`
              }
            </td>
            <td valign="top">
              <a href="${e.link || "#"}" target="_blank" style="color:#1b3326;text-decoration:none;font-weight:600;font-size:14px;line-height:1.3;">${e.title}</a>
              <p style="margin:4px 0 0;font-size:12px;color:#5a5a5a;">
                ${formatDate(e.date)} ${e.location ? `· ${e.location}` : ""}
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
              <a href="${SITE_URL}" style="display:inline-block;background:#c44c3c;color:#ffffff;text-decoration:none;padding:12px 32px;border-radius:12px;font-weight:600;font-size:14px;">Ver más eventos</a>
            </td>
          </tr>
          <tr>
            <td style="padding:16px 32px;text-align:center;border-top:1px solid #e8e0d4;">
              <p style="margin:0;font-size:11px;color:#9a9a9a;">
                Si no quieres recibir más emails,
                <a href="${unsubscribeUrl}" style="color:#c44c3c;text-decoration:underline;">darse de baja</a>.
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
  if (!RESEND_API_KEY) {
    console.log("[email] No RESEND_API_KEY set. Would send email to", to);
    console.log("[email] Subject:", subject);
    return { ok: true, mock: true };
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: FROM_EMAIL,
      to,
      subject,
      html,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    console.error("[email] Failed to send:", err);
    return { ok: false, error: err };
  }

  return { ok: true };
}

export async function sendWeeklyNewsletter(
  eventos: Evento[],
  to: string,
  unsubscribeToken: string
) {
  const unsubscribeUrl = `${SITE_URL}/api/newsletter/unsubscribe?token=${unsubscribeToken}`;
  const html = buildWeeklyHtml(eventos, unsubscribeUrl);
  return sendEmail(
    to,
    "Tu agenda semanal en Vitoria-Gasteiz",
    html
  );
}

export async function sendConfirmationEmail(to: string, token: string) {
  const subscribeUrl = `${SITE_URL}/api/newsletter/confirm?token=${token}`;
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
              <a href="${subscribeUrl}" style="display:inline-block;background:#c44c3c;color:#ffffff;text-decoration:none;padding:12px 32px;border-radius:12px;font-weight:600;font-size:14px;">Confirmar suscripción</a>
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
