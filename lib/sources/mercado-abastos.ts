import type { RawLike } from "../source-data";

/**
 * Mercado de Abastos de Vitoria-Gasteiz, vía la API REST de WordPress.
 *
 * No necesita Puppeteer: el sitio lleva The Events Calendar, que expone
 * `/wp-json/tribe/events/v1/events` con los eventos ya normalizados
 * (fechas ISO con hora de Europe/Madrid, imagen, url y taxonomias). Es el
 * scraper más limpio del registro por eso: ni cheerio ni navegador.
 */

const BASE_URL = "https://mercadoabastos.eus";
const API_URL = `${BASE_URL}/wp-json/tribe/events/v1/events`;
const VENUE = "Mercado de Abastos";
const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

type TecImage = {
  url?: string;
  sizes?: Record<string, { url?: string }>;
};

type TecEvent = {
  title?: string | { rendered?: string };
  content?: { rendered?: string };
  excerpt?: { rendered?: string };
  start_date?: string;
  end_date?: string;
  url?: string;
  website?: string;
  image?: TecImage | null;
  categories?: { name?: string }[];
  tags?: { name?: string }[];
  venue?: { venue?: string; address?: string };
  cancelled?: boolean;
};

const CACHE_TTL = 1000 * 60 * 60;

/**
 * Vacia la cache del modulo. La usan los tests, que si no comparten la primera
 * respuesta entre casos, y sirve para forzar un re scrape desde codigo.
 */
export function invalidateMercadoAbastos(): void {
  cache = null;
  lastFetch = 0;
}

/**
 * `RawLike` deja `title` y `date` como opcionales porque no todos los scrapers
 * los traen; aquí `normalize` los garantiza siempre, y estrechar el tipo evita
 * tener que comparar por `|| ""` al ordenar o comprobar `?.` en cada lectura.
 */
type EventoConFecha = RawLike & { title: string; date: string; time: string };

let cache: EventoConFecha[] | null = null;
let lastFetch = 0;

const stripHtml = (html?: string): string =>
  (html || "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#8217;|&rsquo;/g, "'")
    .replace(/&#8211;|&ndash;/g, "-")
    .replace(/\s+/g, " ")
    .trim();

/**
 * La API devuelve "YYYY-MM-DD HH:mm:ss" en hora de Europe/Madrid, sin
 * offset. Se interpreta como hora local del servidor, igual que hace
 * `parseFechaISO` en `lib/sources/senderismo.ts`, y se devuelve en ISO UTC.
 */
function parseStartDate(value?: string): Date | null {
  if (!value) return null;
  const m = value.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})/);
  if (!m) return null;
  const d = new Date(
    Number(m[1]),
    Number(m[2]) - 1,
    Number(m[3]),
    Number(m[4]),
    Number(m[5]),
  );
  return isNaN(d.getTime()) ? null : d;
}

function normalize(raw: TecEvent): EventoConFecha | null {
  const title =
    typeof raw.title === "string" ? raw.title : raw.title?.rendered || "";
  if (!title.trim()) return null;

  const start = parseStartDate(raw.start_date);
  if (!start) return null;

  const end = parseStartDate(raw.end_date);
  const taxonomy = [...(raw.categories || []), ...(raw.tags || [])]
    .map((c) => c.name)
    .filter((n): n is string => Boolean(n));

  const image =
    raw.image?.sizes?.medium?.url || raw.image?.sizes?.large?.url || raw.image?.url;

  return {
    title: title.trim(),
    date: start.toISOString(),
    time: `${String(start.getHours()).padStart(2, "0")}:${String(
      start.getMinutes(),
    ).padStart(2, "0")}`,
    dateEnd: end && end.getTime() !== start.getTime() ? end.toISOString() : undefined,
    description:
      stripHtml(raw.content?.rendered) || stripHtml(raw.excerpt?.rendered) || undefined,
    image: image || undefined,
    location: raw.venue?.venue || VENUE,
    venue: raw.venue?.venue || VENUE,
    link: raw.website || raw.url || undefined,
    category: taxonomy[0],
    cancelled: raw.cancelled || undefined,
  };
}

export async function scrapeMercadoAbastos(): Promise<EventoConFecha[]> {
  const now = Date.now();
  if (cache && now - lastFetch < CACHE_TTL) return cache;

  // Ventana ancha a propósito: el mercado publica con poca antelación y
  // algún evento entra días antes de celebrarse. Sin `status` el endpoint
  // incluye borradores, así que se filtra por la respuesta ya publicada.
  const url = `${API_URL}?per_page=50&start_date=2020-01-01&end_date=2030-12-31`;

  try {
    const resp = await fetch(url, {
      headers: { "User-Agent": USER_AGENT, "Accept": "application/json" },
      // El `catch` de abajo ya sabe qué hacer si esto falla; lo que no puede es
      // esperar sin límite a que falle. `Promise.allSettled` en `lib/agenda.ts`
      // solo vuelve cuando han vuelto las 28.
      signal: AbortSignal.timeout(20000),
    });
    if (!resp.ok) {
      console.error(`[mercado-abastos] HTTP ${resp.status}, se devuelve la cache`);
      return cache || [];
    }

    const payload = (await resp.json()) as { events?: TecEvent[] };
    const events = Array.isArray(payload.events) ? payload.events : [];
    const normalized = events
      .map(normalize)
      .filter((e): e is EventoConFecha => e !== null)
      .sort((a, b) => a.date.localeCompare(b.date));

    if (normalized.length === 0) {
      console.warn("[mercado-abastos] la API respondio sin eventos, se conserva la cache");
      return cache || [];
    }

    cache = normalized;
    lastFetch = now;
    return normalized;
  } catch (error) {
    console.error("[mercado-abastos] fallo el scrape", error);
    return cache || [];
  }
}
