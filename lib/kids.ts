import { getCachedOrFetch } from "./cache";
import { scrapeMunicipalCalendar } from "./sources/municipal";
import { eventSlug } from "./slug";
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
    .map((e) => {
      const title = e.title ?? "Evento sin título";
      const date = e.date ?? new Date().toISOString();
      const link = e.link && e.link !== "#" ? e.link : "";
      // `Evento` es `AgendaEvento` desde la T4, así que `slug` es obligatorio y
      // `id` tiene que valer lo mismo. Este módulo entero se borra en la T7.
      const slug = eventSlug({ title, date, link });
      return {
        id: slug,
        slug,
        title,
        date,
        image:
          typeof e.image === "string" && e.image.startsWith("http")
            ? e.image
            : undefined,
        location: e.location ?? "Vitoria-Gasteiz",
        link,
        category: "Infantil",
        source: "vitoria-gasteiz",
      };
    })
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
}

export function getKidsEventos(): Promise<Evento[]> {
  return getCachedOrFetch("kids-eventos-mood", 5 * 60 * 1000, fetchKidsEventos);
}
