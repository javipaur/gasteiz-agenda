import { getCachedOrFetch } from "./cache";
import { scrapeMunicipalCalendar } from "./sources/municipal";
import type { Evento } from "./eventos";

type FuenteEvento = {
  id?: string;
  title?: string;
  date?: string;
  image?: string;
  location?: string;
  link?: string;
};

async function fetchKidsEventos(): Promise<Evento[]> {
  const raw = (await scrapeMunicipalCalendar({ dest: ["infantil"] }).catch(
    () => []
  )) as FuenteEvento[];
  return raw
    .map((e) => ({
      id: e.id ?? crypto.randomUUID(),
      title: e.title ?? "Evento sin título",
      date: e.date ?? new Date().toISOString(),
      image:
        typeof e.image === "string" && e.image.startsWith("http")
          ? e.image
          : undefined,
      location: e.location ?? "Vitoria-Gasteiz",
      link: e.link && e.link !== "#" ? e.link : "",
      category: "Infantil",
      source: "vitoria-gasteiz",
    }))
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
}

export function getKidsEventos(): Promise<Evento[]> {
  return getCachedOrFetch("kids-eventos-mood", 5 * 60 * 1000, fetchKidsEventos);
}