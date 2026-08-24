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

export function eventSlug(e: {
  title: string;
  date: string;
  link?: string;
}): string {
  const d = new Date(e.date);
  const datePart = isNaN(d.getTime())
    ? "sin-fecha"
    : `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
        d.getDate()
      ).padStart(2, "0")}`;
  const titlePart = slugify(e.title) || "evento";
  return `${titlePart}-${datePart}-${hashStr(
    `${e.title}|${e.date}|${e.link || ""}`
  )}`;
}
