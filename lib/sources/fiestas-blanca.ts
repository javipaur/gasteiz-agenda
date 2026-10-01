import * as cheerio from "cheerio";

import { fetchMunicipalCalendar } from "./municipal";
import { blancaEditionYear } from "../blanca";

const CALENDARIO_ID = 513;

/**
 * El año no está cableado aquí, y esa es la decisión.
 *
 * Una edición se identifica por las fechas que devuelve `calendariosID=513`, que
 * vienen con su año en `fechaInicio`. Fijar un rango de julio y agosto, como hacía
 * este scraper, no sale más corto: es una petición menos hoy y un scraper muerto
 * el día que termine la edición, porque el rango se quedaría en el año pasado. Con
 * el año leído de los datos, el rango por defecto de `fetchMunicipalCalendar` (de
 * hoy a hoy más un año) cubre la edición que sea.
 */

export type FiestaBlanca = {
  id: string;
  title: string;
  date: string;
  dateEnd: string;
  timeStart: string;
  timeEnd: string;
  location: string;
  url: string;
  image: string;
  target: string;
  dayWeek: string;
  cancelled: boolean;
  category: string;
};

let cache: FiestaBlanca[] | null = null;
let lastFetch = 0;
const CACHE_TTL = 1000 * 60 * 60 * 6;

function parseDate(fecha: string): string {
  if (!fecha || fecha.length !== 8) return "";
  return `${fecha.slice(0, 4)}-${fecha.slice(4, 6)}-${fecha.slice(6, 8)}`;
}

function extractImage(event: any): string {
  const base = "https://www.vitoria-gasteiz.org";
  if (event.imagen) return `${base}${event.imagen}`;
  if (event.picture) {
    const srcset = event.picture.match(/srcset='([^']+)'/);
    if (srcset) return srcset[1];
    const src = event.picture.match(/src="([^"]+)"/);
    if (src) return src[1];
  }
  return "";
}

function mapEvent(raw: any): FiestaBlanca {
  return {
    id: raw.url || `${raw.titulo}-${raw.fechaInicio}`,
    title: raw.titulo || "",
    date: parseDate(raw.fechaInicio),
    dateEnd: parseDate(raw.fechaFin),
    timeStart: raw.horaInicio || "",
    timeEnd: raw.horaFin || "",
    location: raw.localizacion || "",
    url: raw.url || "",
    image: extractImage(raw),
    target: raw.destinatario || "",
    dayWeek: raw.dayWeek || "",
    cancelled: raw.isCancelado || false,
    category: "",
  };
}

function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

interface GasteizHoyEvent {
  title: string;
  date: string;
  categories: string[];
}

const MONTH_MAP: Record<string, string> = {
  enero: "01",
  febrero: "02",
  marzo: "03",
  abril: "04",
  mayo: "05",
  junio: "06",
  julio: "07",
  agosto: "08",
  septiembre: "09",
  octubre: "10",
  noviembre: "11",
  diciembre: "12",
};

/**
 * La página del año que sea. Antes era una constante con el año dentro; ahora lo
 * recibe quien llama, que es quien ya lo ha leído de las fechas del calendario.
 */
function gasteizHoyUrl(year: number): string {
  return `https://www.gasteizhoy.com/la-blanca-${year}-fiestas-de-vitoria/`;
}

/**
 * Un artículo de la página de GasteizHoy solo trae día y mes, así que el año lo
 * pone quien llama. Antes venía hardcodeado en la línea de arriba y una edición
 * nueva no casaba con ningún evento: el título normalizado y la fecha no llegaban
 * a ser la misma clave, y la categoría se perdía en silencio.
 */
async function fetchGasteizHoyPage(
  page: number,
  year: number
): Promise<{ events: GasteizHoyEvent[]; hasNext: boolean }> {
  const base = gasteizHoyUrl(year);
  const url = page === 1 ? base : `${base}page/${page}/`;

  const res = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36",
    },
    signal: AbortSignal.timeout(30000),
  });

  if (!res.ok) return { events: [], hasNext: false };

  const html = await res.text();
  const $ = cheerio.load(html);
  const events: GasteizHoyEvent[] = [];

  $("article.mec-event-article").each((_, article) => {
    const titleEl = $(article).find("h3.mec-toggle-title");
    const title = titleEl
      .clone()
      .children()
      .remove()
      .end()
      .text()
      .trim();

    const dateDay = $(article)
      .find("span.event-d.mec-color")
      .text()
      .trim();
    const dateMonth = $(article)
      .find("span.mec-event-month")
      .text()
      .trim()
      .toLowerCase();
    const monthNum = MONTH_MAP[dateMonth] || "01";
    const date = `${year}-${monthNum}-${dateDay.padStart(2, "0")}`;

    const categories: string[] = [];
    $(article)
      .find("div.mec-single-event-category dd.mec-events-event-categories a")
      .each((_, catEl) => {
        const label = $(catEl)
          .clone()
          .children()
          .remove()
          .end()
          .text()
          .trim();
        if (label) categories.push(label);
      });

    if (title) {
      events.push({ title, date, categories });
    }
  });

  const hasNext =
    $("link[rel=next]").length > 0 ||
    $(".pagination .next").length > 0 ||
    $('a:contains("Siguiente")').length > 0;

  return { events, hasNext };
}

async function fetchAllGasteizHoyCategories(
  year: number
): Promise<Map<string, string[]>> {
  const map = new Map<string, string[]>();
  let page = 1;

  while (page <= 10) {
    const { events, hasNext } = await fetchGasteizHoyPage(page, year);
    for (const ev of events) {
      const key = `${normalizeTitle(ev.title)}|${ev.date}`;
      map.set(key, ev.categories);
    }
    if (!hasNext || events.length === 0) break;
    page++;
  }

  return map;
}

/**
 * La etiqueta que GasteizHoy pone a todo lo que es de la fiesta no aporta nada:
 * el registro ya declara `category: "Fiestas"` para esta fuente, y una etiqueta
 * que lleva el título de la edición en vez de decir qué es el evento solo estorba.
 * Se filtra por patrón y no por texto exacto porque el año cambia solo, y un
 * `!== "La Blanca 2026"` se quedaba obsoleto con la edición siguiente.
 */
const ETIQUETA_GENERICA = /^La Blanca\b/;

function matchCategory(
  title: string,
  date: string,
  categoryMap: Map<string, string[]>
): string {
  const key = `${normalizeTitle(title)}|${date}`;
  const cats = categoryMap.get(key);
  if (cats && cats.length > 0) {
    const propias = cats.filter((c) => !ETIQUETA_GENERICA.test(c));
    return propias.join(", ") || cats[0];
  }
  return "";
}

export async function scrapeFiestasBlanca(): Promise<FiestaBlanca[]> {
  const now = Date.now();
  if (cache && now - lastFetch < CACHE_TTL) return cache;

  const isBuild = process.env.NEXT_PHASE === "phase-production-build";

  try {
    const allRaw = await fetchMunicipalCalendar({ calendariosID: CALENDARIO_ID });

    const seen = new Set<string>();
    const fiestas = allRaw
      .filter((e) => {
        if (e.isCancelado) return false;
        const key = `${e.titulo}|${e.fechaInicio}|${e.horaInicio}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .map(mapEvent)
      .sort((a, b) => {
        const cmp = a.date.localeCompare(b.date);
        if (cmp !== 0) return cmp;
        return a.timeStart.localeCompare(b.timeStart);
      });

    // El año se lee de las fechas que acaba de devolver el calendario, y por eso
    // la página de GasteizHoy va **después**: su URL lleva el año dentro, así que
    // no hay a quién preguntárselo hasta que la primera consulta ha respondido.
    // Fuera de temporada el calendario no devuelve nada, y entonces no hay ni año
    // ni fiestas ni nada que enrichir, que es la respuesta correcta.
    const year = blancaEditionYear(fiestas.map((f) => f.date));
    const categoryMap =
      isBuild || year === null
        ? new Map<string, string[]>()
        : await fetchAllGasteizHoyCategories(year).catch(
            () => new Map<string, string[]>()
          );

    for (const f of fiestas) {
      f.category = matchCategory(f.title, f.date, categoryMap);
    }

    cache = fiestas;
    lastFetch = now;
    return fiestas;
  } catch (error) {
    console.error("Error scraping Fiestas de la Blanca:", error);
    if (cache) return cache;
    return [];
  }
}
