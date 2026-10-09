import { escapeHtml } from "./email";
import type { PaquetePromo } from "./promo";

/**
 * El correo del paquete: asunto y cuerpo.
 *
 * **El HTML se construye a mano y por eso escapa.** En el resto del proyecto React
 * escapa por debajo; aquí no hay nada que lo haga. Los títulos vienen de 28 sitios sin
 * esquema —`raw.title` solo pasa por `.trim()` en `normalizeRaw`—, así que sin
 * `escapeHtml` un título con `"><img src=x onerror=...>` llega al buzón de quien publica.
 * Con cliente que ejecuta JS sería XSS; sin él, inyección de enlace.
 */
const e = escapeHtml;

/** `10 oct` a partir de un `YYYY-MM-DD`. Local, por el mismo motivo que el resto. */
function diaMes(ymd: string): string {
  const d = new Date(`${ymd}T12:00:00`);
  const meses = [
    "ene", "feb", "mar", "abr", "may", "jun",
    "jul", "ago", "sep", "oct", "nov", "dic",
  ];
  return `${d.getDate()} ${meses[d.getMonth()]}`;
}

/**
 * El asunto dice la ventana y el número, porque el número es la pregunta que se hace
 * al abrir el correo.
 */
export function asuntoDelCorreo(desde: string, hasta: string, total: number): string {
  const ventana = desde === hasta ? diaMes(desde) : `${diaMes(desde)}–${diaMes(hasta)}`;
  const etiqueta = desde === hasta ? "Hoy" : "Finde";
  return `${etiqueta} ${ventana} · ${total} ${total === 1 ? "plan" : "planes"}`;
}

/**
 * El cuerpo, con las imágenes en línea por `cid`.
 *
 * **El `cid` tiene que coincidir con el campo `cid` del adjunto** de nodemailer, y es
 * lo que hace que el cliente baje la imagen de ahí en vez de ir a una URL. No es una
 * imagen por URL: es una imagen adjunta que además se muestra.
 *
 * El bloque del pie va en `<pre>` con `white-space: pre-wrap` a propósito. Un `<div>` con
 * saltos de línea es un texto que se copia con el formato por medio, y lo que se copia
 * aquí es lo que va a Instagram.
 */
export function htmlDelCorreo(paquete: PaquetePromo, titulos: string[]): string {
  const slides = ["Portada", ...titulos]
    .map(
      (titulo, i) => `
        <tr><td style="padding:0 0 28px 0">
          <img src="cid:promo-${indice(i)}" width="540" alt="${e(titulo)}"
               style="width:100%;max-width:540px;display:block;border-radius:14px;border:1px solid #e7e5e4" />
          <p style="margin:10px 0 0;font:600 13px/1.4 -apple-system,Segoe UI,Roboto,sans-serif;color:#57534e">
            ${indice(i)} · ${e(titulo)}
          </p>
        </td></tr>`
    )
    .join("");

  return `<!doctype html>
<html lang="es">
<body style="margin:0;padding:0;background:#faf9f5">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#faf9f5">
  <tr><td align="center" style="padding:32px 16px">
    <table role="presentation" width="540" cellpadding="0" cellspacing="0"
           style="width:540px;max-width:100%">

      <tr><td style="padding:0 0 8px 0;font:700 12px/1.4 -apple-system,Segoe UI,Roboto,sans-serif;
                     letter-spacing:0.14em;color:#a16207">
        GASTEIZ CLICK · PUBLICAR A MANO
      </td></tr>

      <tr><td style="padding:0 0 20px 0;font:400 15px/1.6 -apple-system,Segoe UI,Roboto,sans-serif;color:#57534e">
        Las imágenes van numeradas. Súbelas a Instagram en ese orden: la <strong>01</strong> es
        la portada y las siguientes, una por diapositiva.
      </td></tr>

      ${slides}

      <tr><td style="padding:4px 0 0 0">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
               style="background:#fff;border:1px solid #e7e5e4;border-radius:14px">
          <tr><td style="padding:18px 20px">
            <p style="margin:0 0 10px;font:700 13px/1.4 -apple-system,Segoe UI,Roboto,sans-serif;color:#1c1917">
              Texto del pie — cópialo tal cual
            </p>
            <pre style="margin:0;white-space:pre-wrap;font:400 14px/1.7 -apple-system,Segoe UI,Roboto,sans-serif;color:#292524">${e(paquete.texto)}</pre>
          </td></tr>
        </table>
      </td></tr>

      <tr><td style="padding:20px 0 0 0;font:400 13px/1.6 -apple-system,Segoe UI,Roboto,sans-serif;color:#57534e">
        Enlace del post:<br />
        <a href="${e(paquete.enlace)}" style="color:#b91c1c;word-break:break-all">${e(paquete.enlace)}</a>
      </td></tr>

      <tr><td style="padding:28px 0 0 0;font:400 12px/1.5 -apple-system,Segoe UI,Roboto,sans-serif;color:#a8a29e">
        Generado por el sitio, sin tocar ninguna credencial de ninguna red social.
        Publicar es manual y es una decisión editorial.
      </td></tr>

    </table>
  </td></tr>
</table>
</body>
</html>`;
}

/** `01`, `02`, … El ancho fijo es lo que mantiene el orden legible de un vistazo. */
function indice(i: number): string {
  return String(i + 1).padStart(2, "0");
}