import * as cheerio from "cheerio";

const EUSKADI_BASE = "https://api.euskadi.eus/culture/events/v1.0/events/upcoming";
const ELEMENTS = 100;
const MAX_PAGES = 5;

export type EuskadiEvent = {
  id: string;
  title: string;
  date: string;
  dateEnd?: string;
  time?: string;
  image?: string;
  location: string;
  link: string;
  category: string;
  source: string;
  description?: string;
  price?: string;
  lat?: number;
  lng?: number;
};

function htmlToText(html?: string): string {
  if (!html) return "";
  const $ = cheerio.load(html);
  return $("body").text().replace(/\s+/g, " ").trim();
}

function extractStartTime(raw?: string): string | undefined {
  const m = (raw || "").match(/(\d{1,2})[:.](\d{2})/);
  if (!m) return undefined;
  return `${m[1].padStart(2, "0")}:${m[2]}`;
}

export async function fetchEuskadiPage(page: number): Promise<{
  items: any[];
  totalItems: number;
}> {
  const url = `${EUSKADI_BASE}?_elements=${ELEMENTS}&_page=${page}&municipalityNoraCode=46&provinceNoraCode=1`;
  const res = await fetch(url, {
    next: { revalidate: 3600 },
    // `revalidate` cachea la respuesta cuando llega; no dice nada de cuánto se
    // espera a que llegue. Sin plazo, una de las cinco páginas que pagina este
    // scraper basta para que `Promise.allSettled` en `lib/agenda.ts` no vuelva
    // nunca y la agenda entera se quede esperando.
    signal: AbortSignal.timeout(20000),
  });
  /*
   * Antes esto era `if (!res.ok) return { items: [], totalItems: 0 };` sin decir
   * nada, y era la única fuente del registro sin una sola línea de log en ningún
   * camino de fallo.
   *
   * Con eso, un 500 de Euskadi llegaba a `lib/agenda.ts` como una promesa
   * **cumplida** con lista vacía, así que contaba como `sourcesOk` y
   * `/api/v1/salud` contestaba `37/37, completa: true` mientras la fuente no
   * aportaba nada. No es que la degradación fuera difícil de ver: es que no había
   * nada que ver.
   *
   * Se dice con `console.error` y no propagando, porque el contrato de esta fuente
   * es devolver lista y no tirar —igual que `jimmyjazz.ts:112`—. Lo que no es
   * aceptable es que no lo diga nadie.
   */
  if (!res.ok) {
    console.error(`[euskadi] ${res.status} ${res.statusText} en la página ${page}`);
    return { items: [], totalItems: 0 };
  }
  const data = await res.json();
  return {
    items: Array.isArray(data?.items) ? data.items : [],
    totalItems: Number(data?.totalItems) || 0,
  };
}

function mapEvento(e: any): EuskadiEvent {
  return {
    id: e.id?.trim() || crypto.randomUUID(),
    title: e.nameEs?.trim() || "Sin título",
    date: e.startDate?.trim() || "",
    dateEnd:
      e.endDate && e.endDate !== e.startDate ? e.endDate.trim() : undefined,
    time: extractStartTime(e.openingHoursEs),
    image: e.images?.length ? e.images[0].imageUrl : undefined,
    location: e.placeEs?.trim() || e.establishmentEs?.trim() || "Desconocido",
    link: e.sourceUrlEs?.startsWith("http") ? e.sourceUrlEs : "",
    category: e.typeEs?.toLowerCase()?.trim() || "evento",
    source: "euskadi",
    description: htmlToText(e.descriptionEs) || undefined,
    price: e.priceEs?.trim() || undefined,
    lat:
      e.municipalityLatitude && !Number.isNaN(Number(e.municipalityLatitude))
        ? Number(e.municipalityLatitude)
        : undefined,
    lng:
      e.municipalityLongitude && !Number.isNaN(Number(e.municipalityLongitude))
        ? Number(e.municipalityLongitude)
        : undefined,
  };
}

export async function scrapeEuskadi(): Promise<EuskadiEvent[]> {
  try {
    const first = await fetchEuskadiPage(1);
    if (first.items.length === 0) return [];

    const totalPages = Math.min(
      MAX_PAGES,
      Math.max(1, Math.ceil(first.totalItems / ELEMENTS))
    );

    const pages = await Promise.all(
      Array.from({ length: totalPages - 1 }, (_, i) => fetchEuskadiPage(i + 2))
    );

    const seen = new Set<string>();
    const eventos: EuskadiEvent[] = [];
    for (const page of [first, ...pages]) {
      for (const e of page.items) {
        const map = mapEvento(e);
        if (seen.has(map.id)) continue;
        seen.add(map.id);
        eventos.push(map);
      }
    }
    return eventos;
  } catch (error) {
    console.error(`[euskadi] ${error instanceof Error ? error.message : String(error)}`);
    return [];
  }
}