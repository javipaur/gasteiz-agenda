import * as cheerio from "cheerio";

/**
 * Civitatis, catalogo de tours y actividades en Vitoria-Gasteiz.
 *
 * No entra en el registro de fuentes del agregador, y es deliberado: Civitatis
 * vende actividades *recurrentes* ("Free tour por Vitoria", "Visita guiada por
 * la Catedral Nueva") sin fecha concreta, y `normalizeRaw` descarta lo que no
 * tiene fecha valida. Registrarla obligaria a inventar una, que es peor que no
 * tenerla. Por eso vive como endpoint propio y la consume `/turismo`.
 *
 * Tampoco necesita Puppeteer: las tarjetas vienen en el HTML inicial.
 */

const BASE_URL = "https://www.civitatis.com";
const URL = `${BASE_URL}/es/vitoria/`;
const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

export type CivitatisTour = {
  name: string;
  description: string;
  link: string;
  image: string;
  duration: string;
  language: string;
  price: string;
  rating: number | null;
  reviews: number | null;
  travelers: string;
  categories: string;
};

const CACHE_TTL = 1000 * 60 * 60 * 12;

let cache: CivitatisTour[] | null = null;
let lastFetch = 0;

/** Vacia la cache del modulo. La usan los tests y para forzar un re scrape. */
export function invalidateCivitatis(): void {
  cache = null;
  lastFetch = 0;
}

const clean = (value?: string | null): string =>
  (value || "").replace(/\s+/g, " ").trim();

/** "9,5\n...\n/ 10" -> 9.5. Civitatis usa coma decimal en todo el sitio. */
function parseRating(raw?: string | null): number | null {
  const m = clean(raw).match(/(\d+)[.,](\d+)/);
  if (!m) return null;
  const value = Number(`${m[1]}.${m[2]}`);
  return Number.isFinite(value) ? value : null;
}

/** "15.644\n...\nopiniones" -> 15644 */
function parseReviews(raw?: string | null): number | null {
  const m = clean(raw).match(/[\d.,]+/);
  if (!m) return null;
  const digits = m[0].replace(/\./g, "");
  const value = Number(digits);
  return Number.isFinite(value) ? value : null;
}

const absolute = (href: string): string =>
  href.startsWith("http") ? href : `${BASE_URL}${href.startsWith("/") ? "" : "/"}${href}`;

export async function scrapeCivitatisTours(): Promise<CivitatisTour[]> {
  const now = Date.now();
  if (cache && now - lastFetch < CACHE_TTL) return cache;

  try {
    const resp = await fetch(URL, {
      headers: { "User-Agent": USER_AGENT, "Accept-Language": "es-ES,es;q=0.9" },
    });
    if (!resp.ok) {
      console.error(`[civitatis] HTTP ${resp.status}, se devuelve la cache`);
      return cache || [];
    }

    const $ = cheerio.load(await resp.text());
    const tours: CivitatisTour[] = [];

    $(".o-search-list__item").each((_, el) => {
      const $el = $(el);

      const name = clean($el.find(".comfort-card__title").first().text());
      if (!name) return;

      // El `src` de la imagen es un gif de 1px en base64 y el `srcset` llega
      // vacio: la URL real va en `data-src`.
      const image = $el.find("img").first().attr("data-src") || "";

      const href = $el.find("a._activity-link").first().attr("href");
      if (!href) return;

      tours.push({
        name,
        description: clean($el.find(".comfort-card__text").first().text()),
        link: absolute(href),
        image,
        duration: clean($el.find("._duration").first().text()),
        language: clean($el.find("._lang").first().text()),
        price: clean($el.find(".comfort-card__price__text").first().text()),
        rating: parseRating($el.find(".m-rating--text").first().text()),
        reviews: parseReviews($el.find(".text--rating-total").first().text()),
        travelers: clean($el.find(".comfort-card__traveler-count._full").first().text()),
        // `data-categories` cuelga del <article class="comfort-card"> interior,
        // no del elemento que envuelve la tarjeta.
        categories: $el.find("article.comfort-card").first().attr("data-categories") || "",
      });
    });

    if (tours.length === 0) {
      console.warn("[civitatis] no se encontraron tarjetas, se conserva la cache");
      return cache || [];
    }

    cache = tours;
    lastFetch = now;
    return tours;
  } catch (error) {
    console.error("[civitatis] fallo el scrape", error);
    return cache || [];
  }
}
