import { scrapeFever, FeverEvent } from "./sources/fever";
import { scrapeRula, RulaEvent } from "./sources/rula";
import { scrapeGasteizHoy, GasteizHoyEvent } from "./sources/gasteizhoy";
import { scrapeVamEvents, VamEvent } from "./sources/vam";
import { scrapeMunicipalCalendar, MunicipialEvento } from "./sources/municipal";
import { scrapeEuskadi, EuskadiEvent } from "./sources/euskadi";

const CACHE_TTL = 5 * 60 * 1000;
const cache = new Map<string, { data: any[]; timestamp: number }>();

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
  };
}

export async function getProximosEventos(options?: {
  startDate?: string;
  endDate?: string;
}): Promise<Evento[]> {
  const cacheKey = "proximos";
  const now = Date.now();
  const cached = cache.get(cacheKey);
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

  const [fever, rula, gasteizhoy, vam, municipal, euskadi] = await Promise.allSettled([
    scrapeFever(),
    scrapeRula(),
    scrapeGasteizHoy(),
    scrapeVamEvents(),
    scrapeMunicipalCalendar(),
    scrapeEuskadi(),
  ]);

  const allEvents: any[] = [];

  if (fever.status === "fulfilled") {
    allEvents.push(...fever.value.map((e) => ({ ...e, source: "fever" })));
  }
  if (rula.status === "fulfilled") {
    allEvents.push(...rula.value.map((e) => ({ ...e, source: "rula" })));
  }
  if (gasteizhoy.status === "fulfilled") {
    allEvents.push(...gasteizhoy.value.map((e) => ({ ...e, source: "gasteizhoy" })));
  }
  if (vam.status === "fulfilled") {
    allEvents.push(...vam.value.map((e) => ({ ...e, source: "vam" })));
  }
  if (municipal.status === "fulfilled") {
    allEvents.push(...municipal.value.map((e) => ({ ...e, source: "vitoria-gasteiz" })));
  }
  if (euskadi.status === "fulfilled") {
    allEvents.push(...euskadi.value.map((e) => ({ ...e, source: "euskadi" })));
  }

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

  cache.set(cacheKey, { data: deduped, timestamp: now });

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
