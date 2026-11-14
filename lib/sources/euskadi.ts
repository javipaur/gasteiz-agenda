import * as cheerio from "cheerio";
import { DegradedSourceReadError, type SourceRunContext } from "../source-degraded";

const EUSKADI_BASE = "https://api.euskadi.eus/culture/events/v1.0/events/upcoming";
const ELEMENTS = 100;

/**
 * Techo de seguridad, y no el número de páginas que se piden.
 *
 * Cuántas páginas hay lo dice la propia API en `totalItems`, y hasta ahora se
 * ignoraba: `MAX_PAGES = 5` pedía cinco y callaba. Medido el 14 de noviembre de
 * 2026, `totalItems` era **490**, así que el corte no llegaba a morder por 10
 * eventos —pero el día que la fuente pasara de 500, del 501 en adelante
 * desaparecía de la agenda sin un error, sin un log y con la salud en 37/37.
 * El mismo modo de fallo que este repo lleva corrigiendo desde el principio.
 *
 * El techo sigue existiendo, porque una respuesta con `totalItems` absurdo no
 * puede traducirse en mil peticiones: se pide hasta aquí y lo que quede se dice
 * en voz alta.
 */
const MAX_PAGINAS_SEGURIDAD = 100;

/**
 * Cuántas páginas se piden a la vez.
 *
 * Antes eran todas en un `Promise.all`, y con el techo en cinco no importaba.
 * Con el techo en cien, un `Promise.all` sobre cien fetches abre cien conexiones
 * a la vez y convierte una fuente lenta en un pico. En lotes de cuatro el pico
 * está acotado y el total sigue siendo una fracción del de una petición en serie.
 */
const PAGINAS_EN_PARALELO = 4;

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
    // espera a que llegue. Sin plazo, una de las páginas que pagina este scraper
    // —hoy las que diga `totalItems`— basta para que `Promise.allSettled` en
    // `lib/agenda.ts` no vuelva nunca y la agenda entera se quede esperando.
    signal: AbortSignal.timeout(20000),
  });
  /*
   * Un fallo HTTP no es "no hay eventos": es "no se pudo leer la fuente".
   *
   * Antes esto devolvía `{ items: [], totalItems: 0 }` y la promesa se cumplía,
   * así que `lib/agenda.ts` la contaba como fuente sana y el ledger trataba todos
   * sus eventos como ausentes en esa importación. Para tener ausencias controladas,
   * una respuesta no OK debe dejar la fuente como fallida (rechazada), no como
   * vacía y sana.
   */
  if (!res.ok) {
    throw new Error(`[euskadi] ${res.status} ${res.statusText} en la página ${page}`);
  }
  const data = await res.json();
  const items = Array.isArray(data?.items) ? data.items : null;
  if (!items) {
    throw new Error(
      `[euskadi] respuesta inesperada en la página ${page}: falta la lista de items`
    );
  }
  const totalItemsNum = Number(data?.totalItems);
  const totalItems = Number.isFinite(totalItemsNum) && totalItemsNum >= 0
    ? totalItemsNum
    : items.length;
  // Una página intermedia vacía con más páginas declaradas indica lectura incompleta.
  if (items.length === 0 && page > 1 && totalItems > (page - 1) * ELEMENTS) {
    throw new Error(
      `[euskadi] la página ${page} llegó vacía pero totalItems=${totalItems} indica más datos`
    );
  }
  return { items, totalItems };
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

/**
 * Pide un conjunto de páginas en lotes, no todas a la vez.
 *
 * El orden de los resultados importa poco —después se deduplica por `id`—, pero
 * se conserva el de las páginas para que el log y el conteo sean legibles.
 */
async function fetchPaginas(
  paginas: number[]
): Promise<{ items: any[]; totalItems: number }[]> {
  const resultados: { items: any[]; totalItems: number }[] = [];
  for (let i = 0; i < paginas.length; i += PAGINAS_EN_PARALELO) {
    const lote = paginas.slice(i, i + PAGINAS_EN_PARALELO);
    resultados.push(...(await Promise.all(lote.map(fetchEuskadiPage))));
  }
  return resultados;
}

export async function scrapeEuskadi(ctx?: SourceRunContext): Promise<EuskadiEvent[]> {
  try {
    const first = await fetchEuskadiPage(1);
    if (first.items.length === 0) {
      if (first.totalItems > 0) {
        throw new Error(
          `[euskadi] la API declara ${first.totalItems} eventos pero la página 1 llegó vacía`
        );
      }
      return [];
    }

    // Cuántas páginas hay lo dice la API, no una constante. `declaradas` es lo
    // que promete `totalItems`; `totalPages` es lo que se pide de verdad, que
    // solo se queda corto si se alcanza el techo de seguridad.
    const declaradas = Math.max(1, Math.ceil(first.totalItems / ELEMENTS));
    const totalPages = Math.min(MAX_PAGINAS_SEGURIDAD, declaradas);

    if (declaradas > MAX_PAGINAS_SEGURIDAD) {
      console.warn(
        `[euskadi] ${first.totalItems} eventos declarados: se piden ${totalPages} de ${declaradas} páginas. ` +
          `Lo que quede fuera no entra en la agenda.`
      );
    }

    const resto = await fetchPaginas(
      Array.from({ length: totalPages - 1 }, (_, i) => i + 2)
    );

    const seen = new Set<string>();
    const eventos: EuskadiEvent[] = [];
    let recibidos = 0;
    for (const page of [first, ...resto]) {
      recibidos += page.items.length;
      for (const e of page.items) {
        const map = mapEvento(e);
        if (seen.has(map.id)) continue;
        seen.add(map.id);
        eventos.push(map);
      }
    }

    /*
     * La otra mitad del silencio: que la API diga una cosa y sirva otra.
     *
     * Si se piden todas las páginas declaradas y aun así llegan menos ítems que
     * `totalItems`, algo se ha quedado por el camino —una página que devuelve
     * menos de lo que promete, un `totalItems` que cuenta otra cosa—. No es un
     * error: la agenda se sirve igual con lo que ha llegado. Pero no se calla.
     *
     * Con la API real no salta: medido el 14 de noviembre de 2026, `totalItems`
     * era 490 y las páginas 1 a 5 sirven 100+100+100+100+90 = 490.
     */
    const incompletoPorConteo = recibidos < first.totalItems;
    if (incompletoPorConteo) {
      console.warn(
        `[euskadi] declaraba ${first.totalItems} eventos y ha servido ${recibidos} en ${totalPages} páginas`
      );
    }

    // Lectura parcial/capada: servir lo obtenido, pero no contar como sana para el
    // ledger en modo estricto (ausencias fuera de lo leído no son confirmables).
    if (ctx?.strict && (declaradas > MAX_PAGINAS_SEGURIDAD || incompletoPorConteo)) {
      throw new DegradedSourceReadError(
        "euskadi",
        declaradas > MAX_PAGINAS_SEGURIDAD
          ? `paginación capada en ${totalPages}/${declaradas} páginas`
          : `lectura incompleta ${recibidos}/${first.totalItems}`,
        eventos
      );
    }

    return eventos;
  } catch (error) {
    // Propaga para que `aggregate` marque la fuente como fallida y el ledger no
    // convierta una caída en ausencias falsas de todos sus eventos.
    console.error(`[euskadi] ${error instanceof Error ? error.message : String(error)}`);
    throw error;
  }
}