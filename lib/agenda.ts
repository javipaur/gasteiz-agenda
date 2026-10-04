import { getCachedOrFetch } from "./cache";
import { agendaLink, agendaSlug, localDateKey } from "./slug";
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

/**
 * Cómo se construyó el agregado que hay en caché ahora mismo.
 *
 * Existe porque `aggregate` usa `Promise.allSettled`: si 15 de 28 scrapers fallan,
 * lo único que sale es un `logger.warn` y el agregado se devuelve más corto. Quien
 * lo consume —la web, la API, el digest del push— no tiene forma de distinguir
 * "hoy hay 400 eventos" de "hoy solo han respondido 13 fuentes". Un motor de
 * búsqueda que llamara a esta API contestaría con la mitad de la agenda y con
 * toda la confianza, que es exactamente el modo de fallo que este repo ya corrigió
 * una vez en `municipal`, `rula`, `farmacias` y `search`: una lista vacía que no
 * dice que está vacía.
 *
 * Con esto, quien lo sirva puede decirlo. `sources` se llama así y no `fuentes`
 * porque el resto del identificador está en castellano y la mitad de los campos de
 * `AgendaEvento` lo están también; el nombre inglés es el que usa la documentación
 * de MCP para este tipo de dato.
 */
export type AgendaMeta = {
  /** Cuándo se construyó el agregado, en ISO. Es la construcción, no la lectura. */
  scrapedAt: string;
  /** Cuántas fuentes hay en el registro que se han consultado. */
  sourcesTotal: number;
  /** Cuántas han respondido, aunque sea con lista vacía. */
  sourcesOk: number;
  /** Las que no han respondido, con el motivo. */
  sourcesFallidas: { id: string; error: string }[];
};

/** Lo que se guarda en la caché `agenda-all`. */
type AgendaCacheada = { eventos: AgendaEvento[]; meta: AgendaMeta };

function normalizeRaw(raw: RawLike, entry: SourceEntry): AgendaEvento | null {
  const title = (raw.title || "").trim();
  if (!title || title === "Sin título") return null;

  // `dateIso` manda sobre `date` porque hay fuentes cuyo `date` no es parseable y
  // no puede cambiarse: el móvil de `buscametas-inscripciones` la parte con
  // `split('/')`, así que la ruta tiene que servir `dd/mm/yyyy`. Con
  // `new Date("04/10/2026")` V8 devuelve el 9 de abril, que no es un error de
  // formato sino una lectura equivocada en silencio. La comprobación de validez va
  // contra la fecha **resuelta**, no contra `raw.date`: si `dateIso` tampoco
  // parsea, el evento se descarta igual y esta puerta no se convierte en un
  // atajo para fabricar fechas.
  const date = raw.dateIso || raw.date || "";
  if (!date || isNaN(new Date(date).getTime())) return null;

  const link = agendaLink(raw);
  // El slug lo resuelve `agendaSlug`, no `eventSlug` a pelo: la normalización
  // (trim del título, `#` como enlace vacío) tiene que ser la misma en todos los
  // sitios que lo calculan —la migración de favoritos, las tarjetas de La Blanca,
  // su JSON-LD— y por eso vive en `lib/slug.ts` y no aquí. Aquí se decide el
  // `id`; en ningún otro sitio se vuelve a decidir.
  //
  // Se le pasa `{ ...raw, date }` y no `raw` a propósito: `agendaSlug` lee
  // `raw.date`, que en una fuente con las dos fechas es la que no parsea, y el
  // evento aparecería en octubre con un slug que dice abril. O sea que el slug
  // tiene que derivarse de la misma fecha que el campo `date`, y el único sitio
  // que sabe cuál es esa fecha es este.
  const slug = agendaSlug({ ...raw, date });
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

/**
 * El agregado, y junto a él cómo se construyó.
 *
 * El que hay dos funciones y no una con un parámetro `conMeta` es para no tocar los
 * quince tests que llaman a `aggregate` esperando un array, y porque la firma corta
 * es la que se usa en el 99% de los sitios. Quien necesite saber si el agregado está
 * completo llama a esta.
 */
export async function aggregateConMeta(
  entries: readonly SourceEntry[]
): Promise<{ eventos: AgendaEvento[]; meta: AgendaMeta }> {
  // Regla de desempate, en este orden y sin excepciones:
  //   1. menor `priority` gana
  //   2. a igual prioridad, gana el que va antes en SOURCE_REGISTRY
  // Array.prototype.sort es estable en V8, así que ordenar por priority basta
  // para que el orden del array sea el desempate. El array está ordenado a mano
  // por grupo: municipal, oficiales, consolidadas, agregadoras.
  const ordered = [...entries].sort((a, b) => a.priority - b.priority);

  const settled = await Promise.allSettled(
    ordered.map((e) => {
      // Solo las fuentes que declaran `cacheTtlMs` tienen capa propia. Las demás
      // las cubre el `agenda-all` de 5 min de abajo, y meterlas aquí sin que lo
      // pidan sería cambiarle el ritmo de frescura a 27 fuentes por el problema de
      // una.
      if (!e.cacheTtlMs) return e.run();
      return getCachedOrFetch(`source:${e.id}`, e.cacheTtlMs, e.run);
    })
  );

  const collected: AgendaEvento[] = [];
  const sourcesFallidas: { id: string; error: string }[] = [];
  settled.forEach((result, i) => {
    const entry = ordered[i];
    if (result.status === "rejected") {
      const error =
        result.reason instanceof Error ? result.reason.message : String(result.reason);
      logger.warn("scraping_failed", { source: entry.id, error });
      sourcesFallidas.push({ id: entry.id, error });
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
  // de cancelado en ninguna tarjeta y lo único que leería el campo sería el
  // JSON-LD, que además declara lo contrario de lo que ve el usuario.
  const eventos = [...byKey.values()]
    .filter((ev) => !ev.cancelled)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  return {
    eventos,
    meta: {
      // El instante de la **construcción**, que es lo que se guarda en la caché. Si
      // se tomara al leer, un `agenda-all` de cinco minutos daría siempre "ahora" y
      // el campo no diría nada.
      scrapedAt: new Date().toISOString(),
      sourcesTotal: ordered.length,
      sourcesOk: ordered.length - sourcesFallidas.length,
      sourcesFallidas,
    },
  };
}

export async function aggregate(
  entries: readonly SourceEntry[]
): Promise<AgendaEvento[]> {
  return (await aggregateConMeta(entries)).eventos;
}

async function fetchAllAgenda(): Promise<AgendaCacheada> {
  return aggregateConMeta(SOURCE_REGISTRY);
}

/**
 * El valor cacheado de `agenda-all`.
 *
 * **La clave lleva versión a propósito.** La caché de `lib/cache.ts` es un fichero
 * JSON en `tmpdir()`, así que sobrevive a un reinicio de Node y en Dokploy
 * sobrevive entre peticiones. Cambiar la forma del valor sin cambiar la clave
 * haría que el primer hit tras el despliegue leyera el fichero viejo —un array
 * pelado— y `cacheada.eventos` sería `undefined`, con un TypeError en la home.
 * Subir a `v2` es más barato que guardar un `typeof` y una rama por cada lectura.
 */
async function getAgendaCacheada(): Promise<AgendaCacheada> {
  return getCachedOrFetch<AgendaCacheada>("agenda-all-v2", 5 * 60 * 1000, fetchAllAgenda);
}

export async function getAgendaEventos(options?: {
  days?: number;
  includePast?: boolean;
}): Promise<AgendaEvento[]> {
  const { eventos } = await getAgendaCacheada();
  let lista = eventos;

  if (!options?.includePast) {
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    lista = lista.filter((ev) => new Date(ev.date) >= hoy);
  }

  if (options?.days) {
    const limit = new Date();
    limit.setDate(limit.getDate() + options.days);
    lista = lista.filter((ev) => new Date(ev.date) <= limit);
  }

  return lista;
}

/**
 * Cómo se construyó el agregado que se está sirviendo ahora, sin refetch.
 *
 * Comparte la clave `agenda-all-v2` con `getAgendaEventos`, así que leer la salud no
 * dispara un scrape que no dispara ya la agenda. Es lo que hace este par de
 * funciones coherente: preguntar "¿están las 28 fuentes?" no puede ser más caro que
 * cargar la home.
 */
export async function getAgendaSalud(): Promise<AgendaMeta> {
  const { meta } = await getAgendaCacheada();
  return meta;
}

export function findBySlug(
  eventos: readonly AgendaEvento[],
  slug: string
): AgendaEvento | undefined {
  return eventos.find((ev) => ev.slug === slug);
}

/**
 * Los eventos agrupados por el día que ve el usuario, en orden de día.
 *
 * Vive aquí y no dentro de la página porque **la clave es el punto entero de este
 * fichero**: agrupar por `toISOString().slice(0, 10)` es agrupar por el día UTC, y
 * en Europe/Madrid la medianoche local son las 22:00 o las 23:00 del día
 * anterior. `scrapeSenderismo` emite exactamente eso —`new Date(y, m-1,
 * d).toISOString()`— así que con la clave UTC **todas las salidas de senderismo, y
 * todo evento entre las 00:00 y las 02:00, aparecían bajo el encabezado del día
 * anterior**: la página seleccionaba bien el mes, con getters locales, y luego
 * mostraba cada evento un día antes de la fecha que el usuario ve en la tarjeta.
 *
 * No es que el día estuviera mal en un sitio y bien en otro: `dedupeKey` de este
 * mismo fichero ya usa `localDateKey` desde hace tiempo, con un comentario que
 * explica por qué. Aquí la regla simplemente no se aplicó.
 *
 * Ordena las claves, y no confía en que le lleguen ordenadas. `aggregate` las
 * entrega por fecha, así que copiar ese orden sería dejar una precondición
 * invisible: el mismo grupo con la misma información saldría reordenado según quién
 * llame, y eso se descubre en la pantalla y no en un test. La clave es `YYYY-MM-DD`
 * —de ancho fijo y lexicográficamente creciente—, así que ordenar por cadena es
 * ordenar por fecha. Una fecha ilegible va a `"sin-fecha"`, que empieza por "s" y
 * queda al final.
 */
export function agruparPorDiaLocal(
  eventos: readonly AgendaEvento[]
): Map<string, AgendaEvento[]> {
  const porDia = new Map<string, AgendaEvento[]>();
  for (const ev of eventos) {
    const clave = localDateKey(ev.date);
    const grupo = porDia.get(clave);
    if (grupo) grupo.push(ev);
    else porDia.set(clave, [ev]);
  }
  return new Map([...porDia.entries()].sort(([a], [b]) => a.localeCompare(b)));
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
