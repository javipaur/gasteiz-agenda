import { getCachedOrFetch } from "./cache";
import { eventSlug } from "./slug";
import { scrapeFever } from "./sources/fever";
import { scrapeRula } from "./sources/rula";
import { scrapeGasteizHoy } from "./sources/gasteizhoy";
import { scrapeVamEvents } from "./sources/vam";
import { scrapeMunicipalCalendar } from "./sources/municipal";
import { scrapeEuskadi } from "./sources/euskadi";
import { scrapeAllConciertos } from "./sources/conciertos";
import { scrapeSenderismo } from "./sources/senderismo";
import { scrapeBuscametasCalendario } from "./sources/buscametas";
import { scrapeFiestasBlanca } from "./sources/fiestas-blanca";

export type AgendaEvento = {
  id: string;
  slug: string;
  title: string;
  date: string;
  dateEnd?: string;
  time?: string;
  image?: string;
  location: string;
  link: string;
  description?: string;
  category?: string;
  source?: string;
  cancelled?: boolean;
};

type RawEvento = {
  title?: string;
  date?: string;
  dateEnd?: string;
  time?: string;
  image?: string;
  location?: string;
  venue?: string;
  link?: string;
  description?: string;
  category?: string;
  cancelled?: boolean;
};

function normalizeRaw(raw: RawEvento, source: string, fallbackCategory?: string): AgendaEvento | null {
  const title = (raw?.title || "").trim();
  if (!title || title === "Sin título") return null;

  const date = raw.date || "";
  if (!date || isNaN(new Date(date).getTime())) return null;

  const link = raw.link && raw.link !== "#" ? raw.link : "";

  return {
    id: `${source}-${eventSlug({ title, date, link })}`,
    slug: eventSlug({ title, date, link }),
    title,
    date,
    dateEnd: raw.dateEnd || undefined,
    time: raw.time || undefined,
    image: raw.image?.startsWith("http") ? raw.image : undefined,
    location: (raw.location || raw.venue || "").trim() || "Vitoria-Gasteiz",
    link,
    description: raw.description?.trim() || undefined,
    category: raw.category || fallbackCategory,
    source,
    cancelled: raw.cancelled || undefined,
  };
}

async function fetchAllAgenda(): Promise<AgendaEvento[]> {
  const [
    fever,
    rula,
    gasteizhoy,
    vam,
    municipal,
    euskadi,
    conciertos,
    senderismo,
    carreras,
    fiestasBlanca,
  ] = await Promise.allSettled([
    scrapeFever(),
    scrapeRula(),
    scrapeGasteizHoy(),
    scrapeVamEvents(),
    scrapeMunicipalCalendar(),
    scrapeEuskadi(),
    scrapeAllConciertos(),
    scrapeSenderismo(),
    scrapeBuscametasCalendario(),
    scrapeFiestasBlanca(),
  ]);

  const eventos: AgendaEvento[] = [];

  const push = (list: RawEvento[], source: string, cat?: string) => {
    for (const raw of list) {
      const ev = normalizeRaw(raw, source, cat);
      if (ev) eventos.push(ev);
    }
  };

  if (fever.status === "fulfilled") push(fever.value, "fever");
  if (rula.status === "fulfilled") push(rula.value, "rula");
  if (gasteizhoy.status === "fulfilled") push(gasteizhoy.value, "gasteizhoy");
  if (vam.status === "fulfilled") push(vam.value, "vam");
  if (municipal.status === "fulfilled")
    push(municipal.value, "vitoria-gasteiz");
  if (euskadi.status === "fulfilled") push(euskadi.value, "euskadi");
  if (conciertos.status === "fulfilled") {
    push(
      conciertos.value.map((c) => ({
        ...c,
        category: "conciertos",
        location: c.venue || c.location,
      })),
      "jimmy-jazz-gasteiz"
    );
  }
  if (senderismo.status === "fulfilled")
    push(senderismo.value, "euskadi", "senderismo");
  if (carreras.status === "fulfilled")
    push(carreras.value, "buscametas", "deporte");
  if (fiestasBlanca.status === "fulfilled") {
    push(
      fiestasBlanca.value
        .filter((f) => !f.cancelled)
        .map((f) => ({
          title: f.title,
          date: f.date,
          dateEnd: f.dateEnd,
          time: f.timeStart,
          image: f.image,
          location: f.location,
          link: f.url,
          description: "",
          category: f.category || "La Blanca",
        })),
      "fiestas-blanca",
      "La Blanca"
    );
  }

  const seen = new Set<string>();
  return eventos
    .filter((ev) => {
      const key = `${ev.title}|${ev.slug}`.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );
}

export async function getAgendaEventos(options?: {
  days?: number;
  includePast?: boolean;
}): Promise<AgendaEvento[]> {
  let eventos = await getCachedOrFetch<AgendaEvento[]>(
    "agenda-all",
    5 * 60 * 1000,
    fetchAllAgenda
  );

  if (!options?.includePast) {
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    eventos = eventos.filter((ev) => new Date(ev.date) >= hoy);
  }

  if (options?.days) {
    const limit = new Date();
    limit.setDate(limit.getDate() + options.days);
    eventos = eventos.filter((ev) => new Date(ev.date) <= limit);
  }

  return eventos;
}

export async function getEventoBySlug(
  slug: string
): Promise<{ evento: AgendaEvento; related: AgendaEvento[] } | null> {
  const eventos = await getAgendaEventos({ includePast: true });
  const idx = eventos.findIndex((ev) => ev.slug === slug);
  if (idx === -1) return null;

  const evento = eventos[idx];
  const related = eventos
    .filter(
      (ev) =>
        ev.slug !== slug &&
        ev.category === evento.category &&
        new Date(ev.date) >= new Date()
    )
    .slice(0, 6);

  if (related.length < 3) {
    for (const ev of eventos) {
      if (related.length >= 6) break;
      if (
        ev.slug !== slug &&
        !related.includes(ev) &&
        new Date(ev.date) >= new Date()
      ) {
        related.push(ev);
      }
    }
  }

  return { evento, related };
}
