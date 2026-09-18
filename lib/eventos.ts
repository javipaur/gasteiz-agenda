import { scrapeFever } from "./sources/fever";
import { scrapeRula } from "./sources/rula";
import { scrapeGasteizHoy } from "./sources/gasteizhoy";
import { scrapeVamEvents } from "./sources/vam";
import { scrapeMunicipalCalendar } from "./sources/municipal";
import { scrapeEuskadi } from "./sources/euskadi";
import { getCachedOrFetch } from "./cache";
import { logger } from "./axiom/server";

const CACHE_TTL = 5 * 60 * 1000;
const memCache = new Map<string, { data: any[]; timestamp: number }>();

export type Evento = {
  id: string;
  title: string;
  date: string;
  image?: string;
  location: string;
  link: string;
  category?: string;
  source?: string;
  time?: string;
  description?: string;
  price?: string;
  rating?: number;
  popularity?: number;
};

function normalizeEvento(e: any): Evento {
  return {
    id: e.id || crypto.randomUUID(),
    title: e.title || "Sin título",
    date: e.date || e.startDate || "",
    image: e.image?.startsWith("http") ? e.image : undefined,
    location: e.location || e.place || "Vitoria-Gasteiz",
    link: e.link || "",
    category: e.category || "",
    source: e.source || "desconocido",
    time: e.time || "",
    description: e.description || "",
    price: typeof e.price === "string" ? e.price : undefined,
    rating: typeof e.rating === "number" ? e.rating : undefined,
    popularity: typeof e.popularity === "number" ? e.popularity : undefined,
  };
}

async function fetchAllSources(): Promise<any[]> {
  const [fever, rula, gasteizhoy, vam, municipal, euskadi] = await Promise.allSettled([
    scrapeFever(),
    scrapeRula(),
    scrapeGasteizHoy(),
    scrapeVamEvents(),
    scrapeMunicipalCalendar(),
    scrapeEuskadi(),
  ]);

  const sources = [
    ["fever", fever],
    ["rula", rula],
    ["gasteizhoy", gasteizhoy],
    ["vam", vam],
    ["vitoria-gasteiz", municipal],
    ["euskadi", euskadi],
  ];

  for (const [name, result] of sources as Array<[string, PromiseSettledResult<unknown>]>) {
    if (result.status === "rejected") {
      logger.warn("scraping_failed", {
        source: name,
        error:
          result.reason instanceof Error ? result.reason.message : String(result.reason),
        stack: result.reason instanceof Error ? result.reason.stack : undefined,
      });
    }
  }

  const allEvents: any[] = [];

  if (fever.status === "fulfilled") {
    allEvents.push(...fever.value.map((e) => normalizeEvento({ ...e, source: "fever" })));
  }
  if (rula.status === "fulfilled") {
    allEvents.push(...rula.value.map((e) => normalizeEvento({ ...e, source: "rula" })));
  }
  if (gasteizhoy.status === "fulfilled") {
    allEvents.push(...gasteizhoy.value.map((e) => normalizeEvento({ ...e, source: "gasteizhoy" })));
  }
  if (vam.status === "fulfilled") {
    allEvents.push(...vam.value.map((e) => normalizeEvento({ ...e, source: "vam" })));
  }
  if (municipal.status === "fulfilled") {
    allEvents.push(...municipal.value.map((e) => normalizeEvento({ ...e, source: "vitoria-gasteiz" })));
  }
  if (euskadi.status === "fulfilled") {
    allEvents.push(...euskadi.value.map((e) => normalizeEvento({ ...e, source: "euskadi" })));
  }

  return allEvents;
}

export async function getProximosEventos(options?: {
  startDate?: string;
  endDate?: string;
}): Promise<Evento[]> {
  const cacheKey = "proximos";
  const now = Date.now();
  const cached = memCache.get(cacheKey);
  if (cached && now - cached.timestamp < CACHE_TTL) {
    let result = cached.data;
    if (options?.startDate) {
      const filterStart = new Date(options.startDate);
      if (!isNaN(filterStart.getTime())) {
        const filterEnd = options.endDate
          ? new Date(options.endDate)
          : new Date(filterStart);
        filterEnd.setHours(23, 59, 59, 999);
        result = result.filter((e) => {
          const d = new Date(e.date);
          return d >= filterStart && d <= filterEnd;
        });
      }
    }
    return result;
  }

  const allEvents = await getCachedOrFetch("eventos-proximos", CACHE_TTL, fetchAllSources);

  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);

  const seen = new Set<string>();
  const deduped = allEvents
    .filter((e) => {
      const fecha = new Date(e.date);
      return !isNaN(fecha.getTime()) && fecha >= hoy;
    })
    .filter((e) => {
      const key = `${e.title}|${e.date}`.toLowerCase().trim();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  memCache.set(cacheKey, { data: deduped, timestamp: now });

  let result = deduped;
  if (options?.startDate) {
    const filterStart = new Date(options.startDate);
    if (!isNaN(filterStart.getTime())) {
      const filterEnd = options.endDate
        ? new Date(options.endDate)
        : new Date(filterStart);
      filterEnd.setHours(23, 59, 59, 999);
      result = result.filter((e) => {
        const d = new Date(e.date);
        return d >= filterStart && d <= filterEnd;
      });
    }
  }

  return result;
}
