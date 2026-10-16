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
  /*
   * Aquí el log es lo **único** que queda, y por eso no es opcional.
   *
   * Cuando hay caché, este camino devuelve datos y el scraper parece haber
   * funcionado: la agenda trae las salidas al aire de la última vez y nadie ve un
   * hueco. Cuando no la hay, devuelve `[]`, que es indistinguible de "esta semana
   * no hay ninguna salida".
   *
   * O sea que los dos fallos se ven igual desde fuera, y el primero de los dos es
   * el que miente. Con `senderismo` siendo la fuente de 24 h y sin una sola línea de
   * `console` en el fichero, una caída larga se lee como "no había nada que
   * organizar" durante semanas. El aviso dice además si se sirvió caché vieja,
   * porque son dos problemas distintos con dos alcances distintos: sin caché es
   * una caída, y con caché es un dato caducado que hay que mirar.
   */
  if (!resp.ok) {
    if (cache) {
      console.error(
        `[senderismo] ${resp.status} ${resp.statusText}: se sirve la caché de hace ${Math.round((Date.now() - lastFetch) / 60000)} min, que puede no ser la agenda vigente`
      );
      return cache;
    }
    console.error(`[senderismo] ${resp.status} ${resp.statusText} y no hay caché: la agenda sale vacía`);
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
