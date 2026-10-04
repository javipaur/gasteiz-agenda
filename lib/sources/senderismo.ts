import * as cheerio from "cheerio";

const BASE_URL = "https://www.cm-gazteiz.com";
const URL = `${BASE_URL}/actividades/`;

export type Actividad = {
  title: string;
  date: string;
  link: string;
  image: string;
  category: "excursiones";
  location: string;
};

let cache: Actividad[] | null = null;
let lastFetch = 0;
const CACHE_TTL = 1000 * 60 * 60 * 24;

/**
 * `dd/mm/yyyy` o una fecha que V8 entienda, a ISO. **Sin fecha de reserva.**
 *
 * Antes los tres caminos de fallo devolvían `new Date()`: una salida de senderismo
 * sin fecha, o con una fecha que este parser no reconoce, salía en la agenda el día
 * del scrape y desaparecía en la siguiente pasada de la caché. Un día inventado
 * además se cuela en el slug, así que `/evento/[slug]` daba 404 por un evento que
 * la home acababa de pintar. Es la norma del proyecto —"una fuente sin fecha no
 * entra en el registro"— y el filtro de `scrapeSenderismo` la aplica.
 */
function parseFechaISO(fecha?: string): string {
  if (!fecha) return "";
  try {
    const parts = fecha.split("/").map(Number);
    if (parts.length === 3) {
      const [d, m, y] = parts;
      const fechaIso = new Date(y, m - 1, d);
      return isNaN(fechaIso.getTime()) ? "" : fechaIso.toISOString();
    }
    const d = new Date(fecha);
    return isNaN(d.getTime()) ? "" : d.toISOString();
  } catch {
    return "";
  }
}

export async function scrapeSenderismo(): Promise<Actividad[]> {
  const now = Date.now();
  if (cache && now - lastFetch < CACHE_TTL) {
    return cache;
  }

  const resp = await fetch(URL, {
    headers: { "User-Agent": "Mozilla/5.0" },
    // El plazo no es decoración: `lib/agenda.ts:90` espera a las 28 fuentes con
    // `Promise.allSettled`, y eso solo vuelve cuando han vuelto todas. Un sitio que
    // acepta la conexión y no contesta se la lleva por delante, y con ella la home,
    // `/agenda` y `/api/v1/events`.
    signal: AbortSignal.timeout(20000),
  });
  if (!resp.ok) {
    if (cache) return cache;
    return [];
  }

  const html = await resp.text();
  const $ = cheerio.load(html);

  const actividades: Actividad[] = [];

  $("article").each((_, el) => {
    const $el = $(el);
    const title = $el.find(".title-text a").text().trim() || "Sin título";
    if (!title) return;

    const linkRaw = $el.find(".title-text a").attr("href") || "";
    const link = linkRaw.startsWith("http") ? linkRaw : `${BASE_URL}${linkRaw}`;
    const dateRaw = $el.find(".meta-calander").attr("title") || $el.find(".meta-time").text().trim();
    const date = parseFechaISO(dateRaw);

    let image = $el.find("figure.hover-img img").attr("src") || "";
    if (image && !image.startsWith("http")) image = `${BASE_URL}${image.startsWith("/") ? "" : "/"}${image}`;
    if (!image) image = "https://via.placeholder.com/400x300.png?text=Evento";

    actividades.push({
      title,
      date,
      link,
      image,
      category: "excursiones",
      location: "Gazteiz",
    });
  });

  // El filtro va **antes** del orden porque el orden compara `new Date(a.date)`, y
  // una fecha vacía da `NaN`, que no ordena nada. Sin esto, una salida sin fecha se
  // queda donde le deje el `sort` estable.
  const conFecha = actividades.filter((a) => a.title && a.date);
  conFecha.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  cache = conFecha;
  lastFetch = now;

  return conFecha;
}
