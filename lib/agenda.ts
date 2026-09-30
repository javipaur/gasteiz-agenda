import { getCachedOrFetch } from "./cache";
import { eventSlug, localDateKey } from "./slug";
import { normalizeCategory } from "./categories";
import { SOURCE_REGISTRY, type RawLike, type SourceEntry } from "./source-registry";
import { logger } from "./axiom/server";

/**
 * Lo que se ve cuando nadie dice dónde es el evento. Vive en una constante
 * porque `app/evento/[slug]/page.tsx` la usa como señal para decidir si añade la
 * localidad al texto, así que el valor no puede repartirse en dos literales.
 */
const SIN_LUGAR = "Vitoria-Gasteiz";

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
  category: string;
  source: string;
  kind?: string;
  tags?: string[];
  cancelled?: boolean;
  price?: string;
  rating?: number;
};

function normalizeRaw(raw: RawLike, entry: SourceEntry): AgendaEvento | null {
  const title = (raw.title || "").trim();
  if (!title || title === "Sin título") return null;

  const date = raw.date || "";
  if (!date || isNaN(new Date(date).getTime())) return null;

  const link = raw.link && raw.link !== "#" ? raw.link : (raw.url && raw.url !== "#" ? raw.url : "");
  const slug = eventSlug({ title, date, link });
  const category = normalizeCategory(entry.category ?? raw.category);

  return {
    id: slug,
    slug,
    title,
    date,
    dateEnd: raw.dateEnd || undefined,
    time: (raw.time || raw.timeStart || "").trim() || undefined,
    image: raw.image?.startsWith("http") ? raw.image : undefined,
    location: (raw.location || raw.venue || "").trim() || SIN_LUGAR,
    link,
    description: raw.description?.trim() || undefined,
    category,
    source: entry.id,
    kind: entry.kind,
    tags: entry.tags && entry.tags.length ? [...entry.tags] : undefined,
    cancelled: raw.cancelled || undefined,
    price: typeof raw.price === "string" ? raw.price : undefined,
    rating: typeof raw.rating === "number" ? raw.rating : undefined,
  };
}

function dedupeKey(ev: AgendaEvento): string {
  // La fecha va por `localDateKey` y no por `ev.date.slice(0, 10)` porque la
  // cadena cruda es UTC y el día que ve el usuario es el local: un
  // `new Date(2027, 0, 15).toISOString()` es `...T23:00:00.000Z` del día 14 en
  // Europe/Madrid, así que el prefijo ISO señalaría el día equivocado y la misma
  // pareja de eventos deduplicaría en Dokploy y no en local. Al ser el mismo
  // normalizador que usa `eventSlug`, las dos claves no pueden divergir.
  return `${ev.title.toLowerCase().trim()}|${localDateKey(ev.date)}`;
}

export async function aggregate(entries: readonly SourceEntry[]): Promise<AgendaEvento[]> {
  // Regla de desempate, en este orden y sin excepciones:
  //   1. menor `priority` gana
  //   2. a igual prioridad, gana el que va antes en SOURCE_REGISTRY
  // Array.prototype.sort es estable en V8, así que ordenar por priority basta
  // para que el orden del array sea el desempate. El array está ordenado a mano
  // por grupo: municipal, oficiales, consolidadas, agregadoras.
  const ordered = [...entries].sort((a, b) => a.priority - b.priority);

  const settled = await Promise.allSettled(ordered.map((e) => e.run()));

  const collected: AgendaEvento[] = [];
  settled.forEach((result, i) => {
    const entry = ordered[i];
    if (result.status === "rejected") {
      logger.warn("scraping_failed", {
        source: entry.id,
        error: result.reason instanceof Error ? result.reason.message : String(result.reason),
      });
      return;
    }
    for (const raw of result.value) {
      const ev = normalizeRaw(raw, entry);
      if (ev) collected.push(ev);
    }
  });

  const byKey = new Map<string, AgendaEvento>();
  for (const ev of collected) {
    const key = dedupeKey(ev);
    const winner = byKey.get(key);
    if (!winner) {
      byKey.set(key, ev);
      continue;
    }
    // Las fuentes municipales suelen venir sin imagen y las comerciales con,
    // así que se la robamos al perdedor antes de descartarlo. `location` es el
    // caso especial: `normalizeRaw` la deja siempre rellena, así que el hueco se
    // reconoce comparando con el valor por defecto, no por falsy.
    if (!winner.image && ev.image) winner.image = ev.image;
    if (!winner.description && ev.description) winner.description = ev.description;
    if (winner.location === SIN_LUGAR && ev.location !== SIN_LUGAR) {
      winner.location = ev.location;
    }
  }

  // Los cancelados se van después del dedupe, no antes: manda la fuente que
  // gana, que es la que más se fía de la ficha. Antes se filtraban aquí mismo,
  // solo que únicamente para La Blanca; sin este filtro un concierto anulado
  // aparece en pantalla igual que uno que va a celebrarse, porque no hay badge
  // de cancelado en ninguna tarjeta y lo único que leería el campo es el
  // JSON-LD, que además declara lo contrario de lo que ve el usuario.
  return [...byKey.values()]
    .filter((ev) => !ev.cancelled)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
}

async function fetchAllAgenda(): Promise<AgendaEvento[]> {
  return aggregate(SOURCE_REGISTRY);
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

export function findBySlug(
  eventos: readonly AgendaEvento[],
  slug: string
): AgendaEvento | undefined {
  return eventos.find((ev) => ev.slug === slug);
}

export async function getEventoBySlug(
  slug: string
): Promise<{ evento: AgendaEvento; related: AgendaEvento[] } | null> {
  const eventos = await getAgendaEventos({ includePast: true });
  const evento = findBySlug(eventos, slug);
  if (!evento) return null;

  const related: AgendaEvento[] = eventos.filter(
    (ev) =>
      ev.slug !== slug &&
      ev.category === evento.category &&
      new Date(ev.date) >= new Date()
  );

  if (related.length < 6) {
    for (const ev of eventos) {
      if (related.length >= 6) break;
      if (ev.slug !== slug && !related.includes(ev) && new Date(ev.date) >= new Date()) {
        related.push(ev);
      }
    }
  }

  return { evento, related };
}
