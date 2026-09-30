import * as cheerio from "cheerio";

/**
 * Kora Green City, experiencias de sostenibilidad y bienestar que se ofrecen
 * en Vitoria.
 *
 * Como Civitatis, no entra en el registro del agregador: lo que publica son
 * sesiones recurrentes ("Martes de 19:15h a 20:15h", "Domingos de 10:00h") sin
 * fecha, y `normalizeRaw` descarta lo que no la tiene. Se expone como endpoint
 * propio conservando el horario tal cual lo da la web, en lugar de inventar una
 * fecha de evento.
 *
 * Tampoco necesita Puppeteer: `.card-experience` viene en el HTML inicial.
 */

const BASE_URL = "https://koraliving.com";
const URL = `${BASE_URL}/greencity/es/experiencias-locales/conscious-green-experiences/`;
const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

export type KoraExperiencia = {
  name: string;
  description: string;
  image: string;
  link: string;
  reservation: string;
  schedule: string;
  price: string;
  language: string;
};

const CACHE_TTL = 1000 * 60 * 60 * 12;

let cache: KoraExperiencia[] | null = null;
let lastFetch = 0;

/** Vacia la cache del modulo. La usan los tests y para forzar un re scrape. */
export function invalidateKora(): void {
  cache = null;
  lastFetch = 0;
}

const clean = (value?: string | null): string =>
  (value || "").replace(/\s+/g, " ").trim();

/**
 * El `src` de la imagen es `/assets/images/blank.png`, un placeholder; la real
 * va en `data-src` como lista de tamaños separada por comas. Se coge la
 * primera, que es la mayor y ya trae sufijo de ancho.
 */
function pickImage(dataSrc?: string | null): string {
  const first = clean(dataSrc).split(",")[0];
  return first || "";
}

const absolute = (href?: string | null): string => {
  if (!href) return "";
  return href.startsWith("http") ? href : `${BASE_URL}${href.startsWith("/") ? "" : "/"}${href}`;
};

export async function scrapeKoraExperiencias(): Promise<KoraExperiencia[]> {
  const now = Date.now();
  if (cache && now - lastFetch < CACHE_TTL) return cache;

  try {
    const resp = await fetch(URL, {
      headers: { "User-Agent": USER_AGENT, "Accept-Language": "es-ES,es;q=0.9" },
    });
    if (!resp.ok) {
      console.error(`[kora] HTTP ${resp.status}, se devuelve la cache`);
      return cache || [];
    }

    const $ = cheerio.load(await resp.text());
    const experiencias: KoraExperiencia[] = [];

    $(".card-experience").each((_, el) => {
      const $el = $(el);

      const name = clean($el.find(".title.font-style-card-title-small").first().text());
      if (!name) return;

      const link = absolute($el.find(".image a.font-style-link").first().attr("href"));
      if (!link) return;

      // Los tres iconos son horario, precio e idioma, en ese orden.
      const icons = $el.find(".icons div span");
      const icon = (index: number) => clean(icons.eq(index).text());

      experiencias.push({
        name,
        description: clean($el.find(".description.font-style-card-body").first().text()),
        image: pickImage($el.find(".image figure img").first().attr("data-src")),
        link,
        reservation: absolute($el.find("a.button.--light").first().attr("href")),
        schedule: icon(0),
        price: icon(1),
        language: icon(2),
      });
    });

    if (experiencias.length === 0) {
      console.warn("[kora] no se encontraron tarjetas, se conserva la cache");
      return cache || [];
    }

    cache = experiencias;
    lastFetch = now;
    return experiencias;
  } catch (error) {
    console.error("[kora] fallo el scrape", error);
    return cache || [];
  }
}
