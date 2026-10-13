/**
 * Un correo suelto con el post de presentación, sin el carrusel.
 *
 * Uso: PROMO_PARA=... npx tsx scripts/enviar-presentacion.ts
 *
 * **Por qué es un script y no un modo del de siempre.** `scripts/enviar-promo.ts` manda
 * el paquete del día, y ese paquete depende de la salud del agregado, de la puerta del
 * mínimo y de la ventana del calendario: en un martes, o con una fuente caída, no sale
 * nada. La presentación no depende de nada de eso —es un texto y una imagen que no
 * caducan—, así que atarla a las puertas del paquete dejaría sin poder publicar medio
 * contenido que sí está listo.
 *
 * **No es parte del cron.** El envío diario es `promo:send`; este es para cuando toca
 * presentar, que es una decisión editorial, no una fecha del calendario.
 */
import { escapeHtml } from "../lib/email";

async function main(): Promise<void> {
  const para = process.env.PROMO_PARA?.trim();
  if (!para) {
    console.error("[presentacion] Falta PROMO_PARA.");
    process.exitCode = 1;
    return;
  }

  // El `.env` se carga aquí por lo mismo que en `enviar-promo.ts`, y en el mismo orden
  // que usa Next: un script suelto con `tsx` no pasa por `loadEnvConfig`.
  const { config } = await import("dotenv");
  config({ path: ".env.local", override: false, quiet: true });
  config({ path: ".env", override: false, quiet: true });

  const { sendMail } = await import("../lib/mail");
  const { URL_PRESENTACION, TEXTO_PRESENTACION, ENLACE_PRESENTACION } =
    await import("../lib/promo");

  console.log(`[presentacion] Bajando ${URL_PRESENTACION}`);
  const res = await fetch(URL_PRESENTACION);
  if (!res.ok) {
    throw new Error(`No se pudo descargar la presentación: HTTP ${res.status}`);
  }
  const content = Buffer.from(await res.arrayBuffer());
  console.log(`[presentacion] ${content.length} bytes`);

  const e = escapeHtml;

  const html = `<!doctype html>
<html lang="es">
<body style="margin:0;padding:0;background:#faf9f5">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#faf9f5">
  <tr><td align="center" style="padding:32px 16px">
    <table role="presentation" width="540" cellpadding="0" cellspacing="0"
           style="width:540px;max-width:100%">

      <tr><td style="padding:0 0 8px 0;font:700 12px/1.4 -apple-system,Segoe UI,Roboto,sans-serif;
                     letter-spacing:0.14em;color:#a16207">
        GASTEIZ CLICK · POST DE PRESENTACIÓN
      </td></tr>

      <tr><td style="padding:0 0 20px 0;font:400 15px/1.6 -apple-system,Segoe UI,Roboto,sans-serif;color:#57534e">
        Este es el post de presentación de la cuenta, con su pie de foto para copiar. Va
        suelto, sin el carrusel del día: son dos publicaciones distintas.
      </td></tr>

      <tr><td style="padding:0 0 14px 0">
        <img src="cid:presentacion" width="540" alt="Presentación de Gasteiz Click"
             style="width:100%;max-width:540px;display:block;border-radius:14px;border:1px solid #e7e5e4" />
      </td></tr>

      <tr><td style="padding:0 0 28px 0">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
               style="background:#fff;border:1px solid #e7e5e4;border-radius:14px">
          <tr><td style="padding:18px 20px">
            <p style="margin:0 0 10px;font:700 13px/1.4 -apple-system,Segoe UI,Roboto,sans-serif;color:#1c1917">
              Pie de foto — cópialo tal cual
            </p>
            <pre style="margin:0;white-space:pre-wrap;font:400 14px/1.7 -apple-system,Segoe UI,Roboto,sans-serif;color:#292524">${e(TEXTO_PRESENTACION)}</pre>
          </td></tr>
        </table>
      </td></tr>

      <tr><td style="padding:0 0 28px 0;font:400 13px/1.6 -apple-system,Segoe UI,Roboto,sans-serif;color:#57534e">
        Enlace:<br />
        <a href="${e(ENLACE_PRESENTACION)}" style="color:#b91c1c;word-break:break-all">${e(ENLACE_PRESENTACION)}</a>
      </td></tr>

    </table>
  </td></tr>
</table>
</body>
</html>`;

  const resultado = await sendMail({
    to: para,
    subject: "Gasteiz Click · post de presentación",
    html,
    text: `${TEXTO_PRESENTACION}\n\n${ENLACE_PRESENTACION}`,
    attachments: [
      {
        filename: "presentacion.png",
        content,
        contentDisposition: "inline",
        cid: "presentacion",
      },
      { filename: "presentacion.png", content, contentDisposition: "attachment" },
    ],
  });

  if (!resultado.ok) {
    console.error(`[presentacion] No se pudo mandar: ${resultado.error}`);
    process.exitCode = 1;
    return;
  }

  console.log(`[presentacion] Mandado a ${para}.`);
}

void main().catch((error) => {
  console.error("[presentacion] Fallo grave:", error);
  process.exitCode = 1;
});