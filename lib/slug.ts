export function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
    .replace(/-+$/g, "");
}

function hashStr(input: string): string {
  let h = 5381;
  for (let i = 0; i < input.length; i++) {
    h = ((h << 5) + h + input.charCodeAt(i)) | 0;
  }
  return Math.abs(h).toString(36).slice(0, 6);
}

/**
 * La fecha de un evento tal y como la ve el usuario: su día local, no el día UTC
 * de la cadena. Vive aquí y no duplicada porque `eventSlug` y la clave de dedupe
 * de `lib/agenda.ts` tienen que concordar siempre; si cada una normalizara por su
 * cuenta, un mismo evento deduplicaría en Dokploy y no en local.
 */
export function localDateKey(date: string): string {
  const d = new Date(date);
  if (isNaN(d.getTime())) return "sin-fecha";
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

export function eventSlug(e: {
  title: string;
  date: string;
  link?: string;
}): string {
  const datePart = localDateKey(e.date);
  const titlePart = slugify(e.title) || "evento";
  return `${titlePart}-${datePart}-${hashStr(
    `${e.title}|${e.date}|${e.link || ""}`
  )}`;
}

/**
 * El enlace de un evento tal y como lo ve la agenda, sin duplicar sus reglas.
 *
 * Sale separada de `agendaSlug` porque `normalizeRaw` necesita el enlace para el
 * campo `link` del evento, y si calculara el slug con una expresión y el
 * enlace con otra, un cambio en una dejaría al otra diciendo una cosa y el slug
 * otra. Compartiendo esta función, las dos cosas no pueden separarse.
 */
export function agendaLink(raw: { link?: string; url?: string }): string {
  return raw.link && raw.link !== "#"
    ? raw.link
    : raw.url && raw.url !== "#"
      ? raw.url
      : "";
}

/**
 * El slug de un evento tal y como lo ve la agenda, sin duplicar sus reglas.
 *
 * `normalizeRaw` hace trim del título y trata `#` como enlace vacío. Cualquier
 * otro sitio que necesite el slug de un evento crudo —la migración de
 * favoritos, las tarjetas de La Blanca, su JSON-LD— debe pasar por aquí. Si cada
 * uno normalizara por su cuenta, un mismo evento resolvería en un sitio y no en
 * otro según un espacio de más, y el síntoma sería un 404 sin explicación.
 *
 * El recorte no es cosmético y no se nota en la URL: `eventSlug` hashea el
 * título **crudo**, así que la parte legible del slug sale idéntica con y sin
 * `trim` y lo único que se mueve son los 6 caracteres del hash. Por eso
 * precisamente hacía falta centralizarlo: un fallo aquí no se ve en un `diff` de
 * enlaces, se ve en un 404.
 */
export function agendaSlug(raw: {
  title?: string;
  date?: string;
  link?: string;
  url?: string;
}): string {
  const title = (raw.title || "").trim();
  return eventSlug({ title, date: raw.date || "", link: agendaLink(raw) });
}
