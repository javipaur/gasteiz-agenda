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
