import * as cheerio from "cheerio";

const BASE_URL =
  "https://www.vitoria-gasteiz.org/wb021/was/CalendarioServlet";

const CALENDARIO_ID = 513;

const GASTEIZHOY_URL =
  "https://www.gasteizhoy.com/la-blanca-2026-fiestas-de-vitoria/";

// Fiestas de la Virgen Blanca 2026: 15 jul to 9 ago
const FIESTAS_START = new Date("2026-07-15");
const FIESTAS_END = new Date("2026-08-10");

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

async function fetchGasteizHoyPage(
  page: number
): Promise<{ events: GasteizHoyEvent[]; hasNext: boolean }> {
  const url =
    page === 1
      ? GASTEIZHOY_URL
      : `${GASTEIZHOY_URL}page/${page}/`;

  const res = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36",
    },
    signal: AbortSignal.timeout(15000),
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
    const date = `2026-${monthNum}-${dateDay.padStart(2, "0")}`;

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

async function fetchAllGasteizHoyCategories(): Promise<
  Map<string, string[]>
> {
  const map = new Map<string, string[]>();
  let page = 1;

  while (page <= 10) {
    const { events, hasNext } = await fetchGasteizHoyPage(page);
    for (const ev of events) {
      const key = `${normalizeTitle(ev.title)}|${ev.date}`;
      map.set(key, ev.categories);
    }
    if (!hasNext || events.length === 0) break;
    page++;
  }

  return map;
}

function matchCategory(
  title: string,
  date: string,
  categoryMap: Map<string, string[]>
): string {
  const key = `${normalizeTitle(title)}|${date}`;
  const cats = categoryMap.get(key);
  if (cats && cats.length > 0) {
    return cats.filter((c) => c !== "La Blanca 2026").join(", ") || cats[0];
  }
  return "";
}

function toTimestamp(date: Date): number {
  return date.getTime();
}

async function fetchDay(dayStart: Date): Promise<any[]> {
  const dayEnd = new Date(dayStart);
  dayEnd.setHours(23, 59, 59, 999);

  const params = new URLSearchParams({
    accion: "buscar",
    idioma: "es",
    claveArea: "",
    claveTema: "",
    calendariosID: String(CALENDARIO_ID),
    t: "",
    fd: String(toTimestamp(dayStart)),
    fh: String(toTimestamp(dayEnd)),
    deCM: "false",
    f: "",
    moEx: "false",
  });

  const res = await fetch(`${BASE_URL}?${params}`, {
    headers: {
      "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36",
    },
    signal: AbortSignal.timeout(15000),
  });

  if (!res.ok) return [];

  const data = await res.json();
  return data.actividades?.resultados || [];
}

export async function scrapeFiestasBlanca(): Promise<FiestaBlanca[]> {
  const now = Date.now();
  if (cache && now - lastFetch < CACHE_TTL) return cache;

  try {
    const allRaw: any[] = [];
    const current = new Date(FIESTAS_START);

    while (current <= FIESTAS_END) {
      const results = await fetchDay(current);
      allRaw.push(...results);
      current.setDate(current.getDate() + 1);
    }

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

    const categoryMap = await fetchAllGasteizHoyCategories();
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
